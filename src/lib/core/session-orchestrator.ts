import { db } from "../db/db";
import {
  ensureCouncilSchema,
  mapSessionRow,
  mapTurnRow,
  mapConclusionRow,
  setSessionRunning,
  touchSessionHeartbeat,
  setSessionFinished,
  clearSessionArtifacts,
  isSessionStale,
  updateTurnRespondsTo,
} from "../db/council-db";
import { buildRound1Prompt, buildBoundedRound2Prompt } from "../prompts/council-prompts";
import { DEFAULT_GEMMA_MODEL } from "../llm/gemma-models";
import { runSeatTurn, runWithConcurrency } from "./turn-executor";
import { runModeratorTurn } from "./moderator-runner";
import { classifyDivergence } from "./divergence-classifier";
import { clamp } from "../utils/text";
import { MODERATOR_ROUND } from "./council-types";
import type {
  CouncilSession,
  CouncilTurn,
  CouncilConclusion,
  CouncilRunOptions,
  CouncilEvent,
  CouncilEventHandler,
  DivergenceReport,
} from "./council-types";

// No-op Discord reporter for standalone deployment
const createCouncilDiscordReporter = (_opts: unknown) => ({
  handleEvent: (_event: unknown) => {},
  flush: async () => {},
});

function findChallengeTargetRole(content: string, allRoles: string[], selfRole: string): string | null {
  const sectionMatch = content.match(/\*\*Challenge\*\*\s*[-–—]?\s*([\s\S]*?)(?=\n\*\*[A-Z]|$)/i);
  if (!sectionMatch) return null;
  const lower = sectionMatch[1].toLowerCase();
  return allRoles.find(
    (role) =>
      role !== selfRole &&
      role.toLowerCase().split(/\s+/).some((word) => word.length > 3 && lower.includes(word)),
  ) ?? null;
}

const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;
const HEARTBEAT_WRITE_INTERVAL_MS = 1_500;
const ROUND1_CONCURRENCY = clamp(
  Number(process.env.COUNCIL_ROUND1_CONCURRENCY ?? 2) || 2,
  1,
  5,
);

// Deduplicate schema init within this module (same promise reused across calls).
let schemaInit: Promise<void> | null = null;
function getSchemaReady(): Promise<void> {
  if (!schemaInit) {
    schemaInit = ensureCouncilSchema().catch((err) => {
      schemaInit = null;
      throw err;
    });
  }
  return schemaInit;
}

async function fetchSession(id: string): Promise<CouncilSession | null> {
  const { rows } = await db.query(`SELECT * FROM council_sessions WHERE id = $1`, [id]);
  return rows[0] ? mapSessionRow(rows[0] as Record<string, unknown>, DEFAULT_GEMMA_MODEL) : null;
}

async function fetchSessionTurns(sessionId: string): Promise<CouncilTurn[]> {
  const { rows } = await db.query(
    `SELECT * FROM council_turns WHERE session_id = $1 ORDER BY round, created_at`,
    [sessionId],
  );
  return rows.map((row) => mapTurnRow(row as Record<string, unknown>));
}

async function fetchSessionConclusion(sessionId: string): Promise<CouncilConclusion | null> {
  const { rows } = await db.query(
    `SELECT * FROM council_conclusions WHERE session_id = $1`,
    [sessionId],
  );
  return rows[0] ? mapConclusionRow(rows[0] as Record<string, unknown>) : null;
}

export async function runCouncilSession(
  sessionId: string,
  onEvent: CouncilEventHandler,
  options: CouncilRunOptions = {},
): Promise<void> {
  await getSchemaReady();
  const resume = options.resume ?? true;
  const forceRestart = options.forceRestart ?? false;
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const preferredLanguage = options.preferredLanguage;

  const existingSession = await fetchSession(sessionId);
  if (!existingSession) throw new Error(`Council session ${sessionId} not found`);

  if (existingSession.status === "concluded" && !forceRestart) {
    throw new Error("Session already concluded");
  }

  if (
    existingSession.status === "running" &&
    !isSessionStale(existingSession, staleAfterMs) &&
    !forceRestart
  ) {
    throw new Error("Session already running");
  }

  if (forceRestart || !resume) {
    await clearSessionArtifacts(sessionId);
  }

  await setSessionRunning(sessionId);
  const session = await fetchSession(sessionId);
  if (!session) throw new Error(`Council session ${sessionId} not found after start`);

  const discordReporter = createCouncilDiscordReporter({
    sessionId,
    title: session.title,
    topic: session.topic,
    goal: session.goal,
    moderatorModel: session.moderator_model,
    seats: session.seats.map((seat) => ({ role: seat.role, model: seat.model })),
  });

  const emitEvent = (event: CouncilEvent) => {
    onEvent(event);
    discordReporter.handleEvent(event);
  };

  let lastHeartbeatWrite = 0;
  const touchHeartbeat = async () => {
    const now = Date.now();
    if (now - lastHeartbeatWrite < HEARTBEAT_WRITE_INTERVAL_MS) return;
    lastHeartbeatWrite = now;
    await touchSessionHeartbeat(sessionId);
  };

  emitEvent({ type: "session_start", sessionId });

  try {
    const existingTurns = forceRestart || !resume ? [] : await fetchSessionTurns(sessionId);
    const existingConclusion =
      forceRestart || !resume ? null : await fetchSessionConclusion(sessionId);

    const allTurns: CouncilTurn[] = existingTurns.filter((turn) => turn.round !== MODERATOR_ROUND);

    // ── Round 1 ──────────────────────────────────────────────────────────────────
    const round1Existing = existingTurns.filter((turn) => turn.round === 1);
    if (round1Existing.length < session.seats.length) {
      emitEvent({ type: "round_start", round: 1 });
      const doneRoles = new Set(round1Existing.map((turn) => turn.role));
      const round1Prompt = buildRound1Prompt(session, preferredLanguage);
      const newRound1Turns = await runWithConcurrency(
        session.seats
          .filter((seat) => !doneRoles.has(seat.role))
          .map(
            (seat) => () =>
              runSeatTurn(session, seat, 1, round1Prompt, emitEvent, touchHeartbeat, preferredLanguage),
          ),
        ROUND1_CONCURRENCY,
      );
      allTurns.push(...newRound1Turns);
    }

    const round1Turns = allTurns
      .filter((turn) => turn.round === 1)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // ── Round 2 ──────────────────────────────────────────────────────────────────
    if (session.rounds >= 2) {
      const round2Existing = existingTurns.filter((turn) => turn.round === 2);
      const round2AlreadyComplete = round2Existing.length >= session.seats.length;

      if (!round2AlreadyComplete) {
        let divergence: DivergenceReport;

        if (round2Existing.length === 0) {
          // Fresh run — classify divergence before starting round 2
          divergence = await classifyDivergence(round1Turns);
          emitEvent({
            type: "divergence_check",
            level: divergence.level,
            summary: divergence.summary,
            proceed_to_round2: divergence.proceed_to_round2,
          });
          try {
            await db.query(
              `UPDATE council_sessions SET divergence_level = $1, updated_at = NOW() WHERE id = $2`,
              [divergence.level, sessionId],
            );
          } catch { /* non-fatal */ }
        } else {
          // Partial round 2 already started — skip re-classifying, just continue
          divergence = { level: "moderate", summary: "", proceed_to_round2: true };
        }

        if (!divergence.proceed_to_round2) {
          emitEvent({
            type: "round2_skipped",
            reason: `Divergence level "${divergence.level}" — seats converged in Round 1, Round 2 skipped.`,
          });
        } else {
          emitEvent({ type: "round_start", round: 2 });
          const doneRoles = new Set(round2Existing.map((turn) => turn.role));
          const round2TurnsSoFar: CouncilTurn[] = [...round2Existing].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );

          // Sequential: each seat sees all Round 2 turns that came before it.
          const allRoles = session.seats.map((s) => s.role);
          for (const seat of session.seats) {
            if (doneRoles.has(seat.role)) continue;
            const round2Prompt = buildBoundedRound2Prompt(
              session, round1Turns, round2TurnsSoFar, preferredLanguage,
            );
            const turn = await runSeatTurn(
              session, seat, 2, round2Prompt, emitEvent, touchHeartbeat, preferredLanguage,
            );

            // Persist which Round 1 turn this seat primarily responds to.
            const targetRole = findChallengeTargetRole(turn.content, allRoles, seat.role);
            if (targetRole) {
              const r1Turn = round1Turns.find((t) => t.role === targetRole);
              if (r1Turn) {
                await updateTurnRespondsTo(turn.id, r1Turn.id).catch(() => {});
                turn.responds_to_turn_id = r1Turn.id;
              }
            }

            round2TurnsSoFar.push(turn);
            allTurns.push(turn);
          }

          if (divergence.level === "high") {
            emitEvent({
              type: "high_divergence_warning",
              message:
                "Fundamental disagreement detected in Round 1. Moderator synthesis may reflect forced consensus — review the dissent section carefully.",
            });
          }
        }
      }
    }

    // ── Moderator ────────────────────────────────────────────────────────────────
    if (!existingConclusion) {
      await runModeratorTurn(session, allTurns, emitEvent, touchHeartbeat, preferredLanguage);
    } else {
      emitEvent({ type: "conclusion", conclusion: existingConclusion });
    }

    await setSessionFinished(sessionId, "concluded", null);
    emitEvent({ type: "session_done", sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setSessionFinished(sessionId, "failed", message);
    emitEvent({ type: "error", message });
    throw error;
  } finally {
    await discordReporter.flush();
  }
}
