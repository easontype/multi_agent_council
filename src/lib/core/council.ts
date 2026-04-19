/**
 * Council - multi-agent structured debate engine.
 *
 * Flow:
 *   Round 1: each seat sees only the topic
 *   Round 2: each seat sees topic + round 1 turns
 *   Moderator: sees topic + all turns and returns structured JSON
 *
 * Sessions are resumable. Existing turns are reused unless the caller forces a restart.
 * Running sessions are reclaimed when they become stale (no heartbeat for a while).
 */

import { nanoid } from "nanoid";
import { runLLM, streamLLM } from "../llm/claude";
import { db } from "../db/db";
import { getAgenticRuntimeClass, runAgenticRuntime } from "../agents/agentic-runtime";
import type { OllamaMessage } from "../llm/ollama";

// No-op Discord reporter for standalone deployment
const createCouncilDiscordReporter = (_opts: unknown) => ({
  handleEvent: (_event: unknown) => {},
  flush: async () => {},
});

// ─── Re-export all types so existing consumers keep working ───────────────────
export type {
  CouncilSeat,
  DivergenceReport,
  CouncilSessionStatus,
  CouncilSession,
  CouncilTurn,
  CouncilConclusion,
  CouncilEvidenceSource,
  CouncilEvidence,
  CouncilPlanInput,
  CouncilPlan,
  CouncilCreateInput,
  CouncilRunOptions,
  CouncilEvent,
  CouncilEventHandler,
} from "./council-types";
export { MODERATOR_ROUND } from "./council-types";

import type {
  CouncilSeat,
  CouncilSession,
  CouncilTurn,
  CouncilConclusion,
  CouncilEvidenceSource,
  CouncilEvidence,
  CouncilPlan,
  CouncilPlanInput,
  CouncilCreateInput,
  CouncilRunOptions,
  CouncilEvent,
  CouncilEventHandler,
  DivergenceReport,
} from "./council-types";
import { MODERATOR_ROUND } from "./council-types";

import {
  ensureCouncilSchema,
  sanitizeText,
  clamp,
  normalizeSeats,
  mapSessionRow,
  mapConclusionRow,
  mapEvidenceRow,
  mapTurnRow,
  setSessionRunning,
  touchSessionHeartbeat,
  setSessionFinished,
  clearSessionArtifacts,
  createEvidenceEntry,
  finalizeEvidenceEntry,
  saveTurn,
  saveConclusion,
  isSessionStale,
} from "../db/council-db";

import {
  buildRound1Prompt,
  MODERATOR_SYSTEM_PROMPT,
  extractFirstJsonObject,
  normalizeConclusion,
  extractEvidenceSources,
  buildSeatRuntimePrompt,
  buildTemplateSeats,
  buildHeuristicPlan,
  shouldUsePlannerClassifier,
  classifyPlanWithLLM,
} from "../prompts/council-prompts";
import { normalizeSeatTurnContent } from "../prompts/council-turn-normalizer";
import { buildBoundedModeratorPrompt, buildBoundedRound2Prompt } from "../prompts/council-bounded-prompts";

// ─── Module-level constants ────────────────────────────────────────────────────

// Deduplicate schema init: same promise is reused across all public fns.
// On failure the promise is cleared so the next call can retry.
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

const DEFAULT_MODERATOR_MODEL = "gemma-4-31b-it";
const DEFAULT_SEAT_MODEL = "gemma-4-31b-it";
const DEFAULT_PLAN_CLASSIFIER_MODEL = "gemma-4-31b-it";
const DEFAULT_DIVERGENCE_CLASSIFIER_MODEL = "gemma-4-31b-it";
const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;
const HEARTBEAT_WRITE_INTERVAL_MS = 1_500;
const MODERATOR_MAX_TOKENS = 1_200;
const MODERATOR_JSON_RETRY_MAX_TOKENS = 900;
const DIVERGENCE_CLASSIFIER_MAX_TOKENS = 220;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Internal helpers that need the module-level constants ─────────────────────

function _mapSessionRow(row: Record<string, unknown>) {
  return mapSessionRow(row, DEFAULT_MODERATOR_MODEL);
}

function _normalizeSeats(rawSeats: unknown) {
  return normalizeSeats(rawSeats, DEFAULT_SEAT_MODEL);
}

// ─── Seat turn runner ──────────────────────────────────────────────────────────

async function runSeatTurn(
  session: CouncilSession,
  seat: CouncilSeat,
  round: number,
  prompt: string,
  onEvent: CouncilEventHandler,
  touchHeartbeat: () => Promise<void>
): Promise<CouncilTurn> {
  onEvent({ type: "turn_start", round, role: seat.role, model: seat.model });
  const runtimeClass = getAgenticRuntimeClass(seat.model);
  const pendingEvidence: Array<{ id: string; tool: string; args: Record<string, unknown> }> = [];
  let runtimeResult: Awaited<ReturnType<typeof runAgenticRuntime>>;

  try {
    const libraryTag = seat.library_id ? `council:lib:${seat.library_id}` : undefined;

    runtimeResult = await runAgenticRuntime({
      prompt,
      systemPrompt: buildSeatRuntimePrompt(seat, session.seats, round),
      model: seat.model,
      toolAgentId: session.owner_agent_id,
      runtimeId: `council:${session.id}:${seat.role}`,
      role: "worker",
      allowedTools: seat.tools,
      maxTokens: round === 1 ? 800 : 500,
      toolArgOverrides: libraryTag ? {
        rag_query: { tag: libraryTag },
        semantic_search: { tag: libraryTag },
        fetch_paper: { library_id: seat.library_id },
      } : undefined,
      onTextDelta: async (delta) => {
        onEvent({ type: "turn_delta", round, role: seat.role, delta });
        await touchHeartbeat();
      },
      onToolCall: async (tool, args) => {
        onEvent({ type: "tool_call", round, role: seat.role, tool, args });
        const evidence = await createEvidenceEntry({
          session_id: session.id,
          round,
          role: seat.role,
          model: seat.model,
          tool,
          runtime_class: runtimeClass,
          args,
        });
        pendingEvidence.push({ id: evidence.id, tool, args });
        await touchHeartbeat();
      },
      onToolResult: async (tool, result) => {
        const evidence = pendingEvidence.shift();
        const sourceRefs = evidence
          ? extractEvidenceSources(evidence.tool, evidence.args, result)
          : [];
        if (evidence) {
          await finalizeEvidenceEntry(evidence.id, {
            status: "completed",
            result,
            sourceRefs,
          });
        }
        onEvent({
          type: "tool_result",
          round,
          role: seat.role,
          tool,
          result: result.slice(0, 800),
          sourceRefs,
          runtimeClass,
        });
        await touchHeartbeat();
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Promise.all(
      pendingEvidence.map((evidence) => finalizeEvidenceEntry(evidence.id, {
        status: "failed",
        result: message,
        sourceRefs: [],
      })),
    );
    throw error;
  }

  const turn = await saveTurn({
    session_id: session.id,
    round,
    role: seat.role,
    model: seat.model,
    content: runtimeResult.text.trim()
      ? normalizeSeatTurnContent(runtimeResult.text, round)
      : "[No final response]",
    input_tokens: runtimeResult.inputTokens,
    output_tokens: runtimeResult.outputTokens,
  });

  await touchHeartbeat();
  onEvent({ type: "turn_done", turn });
  return turn;
}

// ─── Moderator turn runner ─────────────────────────────────────────────────────

export async function runModeratorTurn(
  session: CouncilSession,
  allTurns: CouncilTurn[],
  onEvent: CouncilEventHandler,
  touchHeartbeat: () => Promise<void>
): Promise<CouncilConclusion> {
  onEvent({ type: "moderator_start" });

  // Count distinct real URLs cited per role — quality signal, not quantity of tool calls.
  // A rag_query returning nothing still counted before; now only actual URIs matter.
  const evidenceCounts: Record<string, number> = {};
  try {
    const { rows } = await db.query(
      `SELECT ce.role, COUNT(DISTINCT sr->>'uri') AS cited_uris
       FROM council_evidence ce,
            LATERAL jsonb_array_elements(ce.source_refs) AS sr
       WHERE ce.session_id = $1
         AND ce.status = 'completed'
         AND sr->>'uri' IS NOT NULL
         AND sr->>'uri' <> ''
       GROUP BY ce.role`,
      [session.id]
    );
    for (const row of rows as Array<{ role: string; cited_uris: string }>) {
      evidenceCounts[row.role] = Number(row.cited_uris);
    }
  } catch {
    // Non-fatal — proceed without evidence counts
  }

  const prompt = buildBoundedModeratorPrompt(session, allTurns, evidenceCounts);
  let raw = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const messages: OllamaMessage[] = [
    { role: "system", content: MODERATOR_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];

  for await (const delta of streamLLM(
    prompt,
    MODERATOR_SYSTEM_PROMPT,
    session.moderator_model,
    messages,
    (usage) => {
      inputTokens = usage.inputTokens;
      outputTokens = usage.outputTokens;
    },
    MODERATOR_MAX_TOKENS,
  )) {
    raw += delta;
    await touchHeartbeat();
  }

  // If the first pass produced no valid JSON, do one non-streaming retry with a stricter prompt.
  let finalRaw = raw;
  if (!extractFirstJsonObject(raw)) {
    try {
      const retryPrompt = [
        "The following is a debate synthesis that was not formatted as JSON. Convert it to the required JSON shape.",
        "Output ONLY the JSON object, no prose, no markdown fences.",
        "",
        "Required shape:",
        '{ "summary": "...", "consensus": "...", "dissent": [{"question": "...", "seats": {"RoleName": "position"}}], "action_items": [{"action": "...", "priority": "blocking|recommended|optional"}], "veto": "...", "confidence": "high|medium|low", "confidence_reason": "..." }',
        "",
        "Text to convert:",
        raw.trim(),
      ].join("\n");
      const retried = await runLLM(
        retryPrompt,
        "You are a strict JSON formatter. Output JSON only.",
        session.moderator_model,
        MODERATOR_JSON_RETRY_MAX_TOKENS,
      );
      if (extractFirstJsonObject(retried)) {
        finalRaw = retried;
      }
    } catch {
      // Non-fatal — use the original raw as fallback
    }
  }

  await saveTurn({
    session_id: session.id,
    round: MODERATOR_ROUND,
    role: "Moderator",
    model: session.moderator_model,
    content: finalRaw.trim(),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });

  if (finalRaw.trim()) {
    onEvent({ type: "moderator_delta", delta: finalRaw.trim() });
  }

  const parsed = normalizeConclusion(finalRaw);
  const conclusion = await saveConclusion({
    session_id: session.id,
    summary: parsed.summary,
    consensus: parsed.consensus,
    dissent: parsed.dissent,
    action_items: parsed.action_items,
    veto: parsed.veto,
    confidence: parsed.confidence,
    confidence_reason: parsed.confidence_reason,
  });

  await touchHeartbeat();
  onEvent({ type: "conclusion", conclusion });
  return conclusion;
}

// ─── Divergence classifier ─────────────────────────────────────────────────────

async function classifyDivergence(round1Turns: CouncilTurn[]): Promise<DivergenceReport> {
  const formatted = round1Turns.map((t) => `### ${t.role}\n${t.content}`).join("\n\n");
  const prompt = [
    "Read these Round 1 debate positions and classify the level of disagreement.",
    'Return JSON only: { "level": "none|low|moderate|high", "summary": "one sentence", "proceed_to_round2": true|false }',
    "- none: all seats reach the same conclusion (round 2 unnecessary)",
    "- low: different framing, same direction (round 2 optional, skip it)",
    "- moderate: genuine disagreement on key points (round 2 valuable)",
    "- high: fundamental opposition with unresolved contradictions (round 2 essential)",
    "",
    "Round 1 positions:",
    formatted,
  ].join("\n");
  try {
    const raw = await runLLM(
      prompt,
      "You are a strict debate classifier. Output JSON only. No prose, no fences.",
      DEFAULT_DIVERGENCE_CLASSIFIER_MODEL,
      DIVERGENCE_CLASSIFIER_MAX_TOKENS,
    );
    const jsonText = extractFirstJsonObject(raw);
    if (!jsonText) throw new Error("no JSON");
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const level = (["none", "low", "moderate", "high"] as const).includes(String(parsed.level) as DivergenceReport["level"])
      ? (String(parsed.level) as DivergenceReport["level"])
      : "moderate";
    return {
      level,
      summary: sanitizeText(parsed.summary) || "Classification complete.",
      proceed_to_round2: level === "moderate" || level === "high",
    };
  } catch {
    return { level: "moderate", summary: "Classification unavailable.", proceed_to_round2: true };
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function planCouncil(input: CouncilPlanInput): Promise<CouncilPlan> {
  const heuristic = buildHeuristicPlan(input, DEFAULT_SEAT_MODEL, DEFAULT_MODERATOR_MODEL);
  if (!shouldUsePlannerClassifier(input, heuristic)) {
    return heuristic;
  }

  const classified = await classifyPlanWithLLM(input, DEFAULT_PLAN_CLASSIFIER_MODEL);
  if (!classified) {
    return {
      ...heuristic,
      reasoning: [...heuristic.reasoning, "planner=fallback_heuristic"],
    };
  }

  const preferredModel = sanitizeText(input.preferredModel) || DEFAULT_SEAT_MODEL;
  const seatCount = input.maxSeats
    ? clamp(input.maxSeats, 2, 5)
    : classified.complexity === "high"
      ? 5
      : classified.complexity === "medium"
        ? 4
        : 3;

  return {
    shouldUseCouncil: classified.shouldUseCouncil,
    template: classified.template,
    complexity: classified.complexity,
    title: heuristic.title,
    rounds: classified.complexity === "low" ? 1 : 2,
    moderator_model: DEFAULT_MODERATOR_MODEL,
    seats: buildTemplateSeats(classified.template, preferredModel, seatCount),
    reasoning: [...heuristic.reasoning, ...classified.reasoning],
  };
}

export async function createCouncilSession(input: CouncilCreateInput): Promise<CouncilSession> {
  await getSchemaReady();
  const topic = sanitizeText(input.topic);
  if (!topic) throw new Error("topic required");

  const planned = input.autoPlan || !input.seats?.length
    ? await planCouncil({
        topic,
        context: input.context,
        goal: input.goal,
        preferredModel: input.preferredModel,
        maxSeats: input.maxSeats,
      })
    : null;

  const seats = input.seats?.length
    ? normalizeSeats(input.seats, sanitizeText(input.preferredModel) || DEFAULT_SEAT_MODEL)
    : planned?.seats ?? [];
  if (!seats.length) throw new Error("at least one valid seat required");

  const title = sanitizeText(input.title) || planned?.title || topic.slice(0, 80);
  const rounds = clamp(input.rounds ?? planned?.rounds ?? 1, 1, 2);
  const moderatorModel = sanitizeText(input.moderator_model) || planned?.moderator_model || DEFAULT_MODERATOR_MODEL;
  const ownerAgentId = sanitizeText(input.ownerAgentId);
  const ownerUserEmail = sanitizeText(input.ownerUserEmail).toLowerCase() || null;
  const accessTokenHash = sanitizeText(input.accessTokenHash) || null;
  const id = nanoid();

  const { rows } = await db.query(
    `INSERT INTO council_sessions (
       id, title, topic, context, goal, rounds, moderator_model, seats, owner_agent_id, owner_user_email, access_token_hash
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      id,
      title,
      topic,
      sanitizeText(input.context) || null,
      sanitizeText(input.goal) || null,
      rounds,
      moderatorModel,
      JSON.stringify(seats),
      UUID_RE.test(ownerAgentId) ? ownerAgentId : null,
      ownerUserEmail,
      accessTokenHash,
    ]
  );

  return _mapSessionRow(rows[0] as Record<string, unknown>);
}

export async function runCouncilSession(
  sessionId: string,
  onEvent: CouncilEventHandler,
  options: CouncilRunOptions = {}
): Promise<void> {
  await getSchemaReady();
  const resume = options.resume ?? true;
  const forceRestart = options.forceRestart ?? false;
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;

  const existingSession = await getSession(sessionId);
  if (!existingSession) throw new Error(`Council session ${sessionId} not found`);

  if (existingSession.status === "concluded" && !forceRestart) {
    throw new Error("Session already concluded");
  }

  if (existingSession.status === "running" && !isSessionStale(existingSession, staleAfterMs) && !forceRestart) {
    throw new Error("Session already running");
  }

  if (forceRestart || !resume) {
    await clearSessionArtifacts(sessionId);
  }

  await setSessionRunning(sessionId);
  const session = await getSession(sessionId);
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
    const existingTurns = forceRestart || !resume ? [] : await getSessionTurns(sessionId);
    const existingConclusion = forceRestart || !resume ? null : await getSessionConclusion(sessionId);

    const allTurns: CouncilTurn[] = existingTurns.filter((turn) => turn.round !== MODERATOR_ROUND);

    const round1Existing = existingTurns.filter((turn) => turn.round === 1);
    if (round1Existing.length < session.seats.length) {
      emitEvent({ type: "round_start", round: 1 });
      const doneRoles = new Set(round1Existing.map((turn) => turn.role));
      const round1Prompt = buildRound1Prompt(session);
      const newRound1Turns = await Promise.all(
        session.seats
          .filter((seat) => !doneRoles.has(seat.role))
          .map((seat) => runSeatTurn(session, seat, 1, round1Prompt, emitEvent, touchHeartbeat))
      );
      allTurns.push(...newRound1Turns);
    }

    const round1Turns = allTurns
      .filter((turn) => turn.round === 1)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (session.rounds >= 2) {
      const round2Existing = existingTurns.filter((turn) => turn.round === 2);
      const round2AlreadyComplete = round2Existing.length >= session.seats.length;

      if (!round2AlreadyComplete) {
        // Classify divergence only when this is a fresh run (not resuming mid-round-2).
        let divergence: DivergenceReport;
        if (round2Existing.length === 0) {
          divergence = await classifyDivergence(round1Turns);
          emitEvent({
            type: "divergence_check",
            level: divergence.level,
            summary: divergence.summary,
            proceed_to_round2: divergence.proceed_to_round2,
          });
          // Persist so the UI can show it even after reload
          try {
            await db.query(
              `UPDATE council_sessions SET divergence_level = $1, updated_at = NOW() WHERE id = $2`,
              [divergence.level, sessionId]
            );
          } catch { /* non-fatal */ }
        } else {
          // Partial round-2 already started — skip re-classifying, just continue
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

          // Seats that already ran in a previous (partial) attempt, sorted chronologically
          // so later seats in this run can see them in the sequential prompt.
          const round2TurnsSoFar: CouncilTurn[] = [...round2Existing].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          // Sequential: each seat sees all Round 2 turns that came before it,
          // enabling genuine cross-argument within the same round.
          for (const seat of session.seats) {
            if (doneRoles.has(seat.role)) continue;
            const round2Prompt = buildBoundedRound2Prompt(session, round1Turns, round2TurnsSoFar);
            const turn = await runSeatTurn(session, seat, 2, round2Prompt, emitEvent, touchHeartbeat);
            round2TurnsSoFar.push(turn);
            allTurns.push(turn);
          }

          // Warn if high divergence persisted — moderator synthesis may be forced
          if (divergence.level === "high") {
            emitEvent({
              type: "high_divergence_warning",
              message: "Fundamental disagreement detected in Round 1. Moderator synthesis may reflect forced consensus — review the dissent section carefully.",
            });
          }
        }
      }
    }

    if (!existingConclusion) {
      await runModeratorTurn(session, allTurns, emitEvent, touchHeartbeat);
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

export async function getSession(id: string): Promise<CouncilSession | null> {
  await getSchemaReady();
  const { rows } = await db.query(`SELECT * FROM council_sessions WHERE id = $1`, [id]);
  return rows[0] ? _mapSessionRow(rows[0] as Record<string, unknown>) : null;
}

export async function listSessions(ownerUserEmail?: string | null): Promise<(CouncilSession & { has_veto: boolean })[]> {
  await getSchemaReady();
  const normalizedOwnerUserEmail = sanitizeText(ownerUserEmail).toLowerCase();
  const params: unknown[] = [];
  const where = normalizedOwnerUserEmail
    ? `WHERE s.owner_user_email = $1`
    : "";
  if (normalizedOwnerUserEmail) {
    params.push(normalizedOwnerUserEmail);
  }

  const { rows } = await db.query(
    `SELECT s.id, s.title, s.topic, s.context, s.goal, s.status, s.rounds, s.moderator_model, s.seats,
            s.owner_agent_id, s.created_at, s.started_at, s.heartbeat_at, s.concluded_at,
            s.last_error, s.run_attempts, s.updated_at, s.divergence_level,
            (c.veto IS NOT NULL AND c.veto <> '') AS has_veto
     FROM council_sessions s
     LEFT JOIN council_conclusions c ON c.session_id = s.id
     ${where}
     ORDER BY s.created_at DESC`
    ,
    params,
  );
  return rows.map((row) => ({
    ..._mapSessionRow(row as Record<string, unknown>),
    has_veto: Boolean((row as Record<string, unknown>).has_veto),
  }));
}

export async function getSessionTurns(sessionId: string): Promise<CouncilTurn[]> {
  await getSchemaReady();
  const { rows } = await db.query(
    `SELECT * FROM council_turns WHERE session_id = $1 ORDER BY round, created_at`,
    [sessionId]
  );
  return rows.map((row) => mapTurnRow(row as Record<string, unknown>));
}

export async function getSessionConclusion(sessionId: string): Promise<CouncilConclusion | null> {
  await getSchemaReady();
  const { rows } = await db.query(`SELECT * FROM council_conclusions WHERE session_id = $1`, [sessionId]);
  return rows[0] ? mapConclusionRow(rows[0] as Record<string, unknown>) : null;
}

export async function getSessionEvidence(sessionId: string): Promise<CouncilEvidence[]> {
  await getSchemaReady();
  const { rows } = await db.query(
    `SELECT * FROM council_evidence WHERE session_id = $1 ORDER BY round, created_at`,
    [sessionId],
  );
  return rows.map((row) => mapEvidenceRow(row as Record<string, unknown>));
}

export async function getCouncilSessionBundle(sessionId: string) {
  const [session, turns, conclusion, evidence] = await Promise.all([
    getSession(sessionId),
    getSessionTurns(sessionId),
    getSessionConclusion(sessionId),
    getSessionEvidence(sessionId),
  ]);

  return { session, turns, conclusion, evidence };
}
