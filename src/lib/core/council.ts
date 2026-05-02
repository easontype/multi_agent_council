/**
 * Council — multi-agent structured debate engine.
 *
 * This file is the public façade. Execution logic lives in:
 *   turn-executor.ts       — runSeatTurn + evidence helpers
 *   moderator-runner.ts    — runModeratorTurn
 *   divergence-classifier.ts — classifyDivergence
 *   session-orchestrator.ts  — runCouncilSession
 */

import { nanoid } from "nanoid";
import { db } from "../db/db";

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
  CouncilSession,
  CouncilTurn,
  CouncilConclusion,
  CouncilEvidence,
  CouncilPlan,
  CouncilPlanInput,
  CouncilCreateInput,
} from "./council-types";

import {
  ensureCouncilSchema,
  normalizeSeats,
  mapSessionRow,
  mapConclusionRow,
  mapEvidenceRow,
  mapTurnRow,
} from "../db/council-db";
import { sanitizeText, clamp } from "../utils/text";
import {
  buildTemplateSeats,
  buildHeuristicPlan,
  shouldUsePlannerClassifier,
  classifyPlanWithLLM,
} from "../prompts/council-prompts";
import { DEFAULT_GEMMA_MODEL } from "../llm/gemma-models";

// ─── Re-export execution API ───────────────────────────────────────────────────
export { runCouncilSession } from "./session-orchestrator";
export { runModeratorTurn } from "./moderator-runner";

// ─── Module-level constants ────────────────────────────────────────────────────
const DEFAULT_MODERATOR_MODEL = DEFAULT_GEMMA_MODEL;
const DEFAULT_SEAT_MODEL = DEFAULT_GEMMA_MODEL;
const DEFAULT_PLAN_CLASSIFIER_MODEL = DEFAULT_GEMMA_MODEL;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Deduplicate schema init: same promise reused across all public fns.
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

function _mapSessionRow(row: Record<string, unknown>) {
  return mapSessionRow(row, DEFAULT_MODERATOR_MODEL);
}

function _normalizeSeats(rawSeats: unknown) {
  return normalizeSeats(rawSeats, DEFAULT_SEAT_MODEL);
}

// ─── Plan ──────────────────────────────────────────────────────────────────────

export async function planCouncil(input: CouncilPlanInput): Promise<CouncilPlan> {
  const heuristic = buildHeuristicPlan(input, DEFAULT_SEAT_MODEL, DEFAULT_MODERATOR_MODEL);
  if (!shouldUsePlannerClassifier(input, heuristic)) {
    return heuristic;
  }

  const classified = await classifyPlanWithLLM(input, DEFAULT_PLAN_CLASSIFIER_MODEL);
  if (!classified) {
    return { ...heuristic, reasoning: [...heuristic.reasoning, "planner=fallback_heuristic"] };
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

// ─── Session CRUD ──────────────────────────────────────────────────────────────

export async function createCouncilSession(input: CouncilCreateInput): Promise<CouncilSession> {
  await getSchemaReady();
  const topic = sanitizeText(input.topic);
  if (!topic) throw new Error("topic required");

  const planned =
    input.autoPlan || !input.seats?.length
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
    : (planned?.seats ?? []);
  if (!seats.length) throw new Error("at least one valid seat required");

  const title = sanitizeText(input.title) || planned?.title || topic.slice(0, 80);
  const rounds = clamp(input.rounds ?? planned?.rounds ?? 1, 1, 2);
  const moderatorModel =
    sanitizeText(input.moderator_model) || planned?.moderator_model || DEFAULT_MODERATOR_MODEL;
  const workspaceId = sanitizeText(input.workspaceId) || null;
  const createdByUserId = sanitizeText(input.createdByUserId) || null;
  const paperAssetId = sanitizeText(input.paperAssetId) || null;
  const ownerAgentId = sanitizeText(input.ownerAgentId);
  const ownerApiKeyId = sanitizeText(input.ownerApiKeyId) || null;
  const ownerUserEmail = sanitizeText(input.ownerUserEmail).toLowerCase() || null;
  const accessTokenHash = sanitizeText(input.accessTokenHash) || null;
  const id = nanoid();

  const { rows } = await db.query(
    `INSERT INTO council_sessions (
       id, title, topic, context, goal, paper_asset_id, rounds, moderator_model, seats, workspace_id,
       created_by_user_id, owner_agent_id, owner_api_key_id, owner_user_email, access_token_hash
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      id,
      title,
      topic,
      sanitizeText(input.context) || null,
      sanitizeText(input.goal) || null,
      paperAssetId,
      rounds,
      moderatorModel,
      JSON.stringify(seats),
      workspaceId,
      createdByUserId,
      UUID_RE.test(ownerAgentId) ? ownerAgentId : null,
      ownerApiKeyId,
      ownerUserEmail,
      accessTokenHash,
    ],
  );

  return _mapSessionRow(rows[0] as Record<string, unknown>);
}

export async function getSession(id: string): Promise<CouncilSession | null> {
  await getSchemaReady();
  const { rows } = await db.query(`SELECT * FROM council_sessions WHERE id = $1`, [id]);
  return rows[0] ? _mapSessionRow(rows[0] as Record<string, unknown>) : null;
}

export async function listSessions(
  input: { workspaceId?: string | null; ownerUserEmail?: string | null } = {},
): Promise<(CouncilSession & { has_veto: boolean })[]> {
  await getSchemaReady();
  const normalizedWorkspaceId = sanitizeText(input.workspaceId);
  const normalizedOwnerUserEmail = sanitizeText(input.ownerUserEmail).toLowerCase();
  const params: unknown[] = [];
  let where = "";
  if (normalizedWorkspaceId) {
    where = `WHERE s.workspace_id = $1`;
    params.push(normalizedWorkspaceId);
  } else if (normalizedOwnerUserEmail) {
    where = `WHERE s.owner_user_email = $1`;
    params.push(normalizedOwnerUserEmail);
  }

  const { rows } = await db.query(
    `SELECT s.id, s.title, s.topic, s.context, s.goal, s.paper_asset_id, s.status, s.rounds, s.moderator_model, s.seats,
            s.workspace_id, s.created_by_user_id, s.owner_agent_id, s.owner_api_key_id, s.created_at,
            s.started_at, s.heartbeat_at, s.concluded_at, s.last_error, s.run_attempts, s.updated_at,
            s.divergence_level,
            (c.veto IS NOT NULL AND c.veto <> '') AS has_veto
     FROM council_sessions s
     LEFT JOIN council_conclusions c ON c.session_id = s.id
     ${where}
     ORDER BY s.created_at DESC`,
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
    [sessionId],
  );
  return rows.map((row) => mapTurnRow(row as Record<string, unknown>));
}

export async function getSessionConclusion(sessionId: string): Promise<CouncilConclusion | null> {
  await getSchemaReady();
  const { rows } = await db.query(
    `SELECT * FROM council_conclusions WHERE session_id = $1`,
    [sessionId],
  );
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
