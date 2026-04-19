/**
 * council-db.ts — DB interaction, row mappers, schema migrations, and utility helpers
 * for the Council debate engine.
 */

import { nanoid } from "nanoid";
import { db } from "./db";
import { ensureAccountSchema } from "./account-db";
import type { AgenticRuntimeClass } from "../core/council-types";
import type {
  CouncilSeat,
  CouncilSession,
  CouncilSessionStatus,
  CouncilTurn,
  CouncilConclusion,
  CouncilEvidence,
  CouncilEvidenceSource,
  DissentItem,
  ActionItem,
} from "../core/council-types";
import { DEFAULT_GEMMA_MODEL } from "../llm/gemma-models";

// ─── Schema singleton ──────────────────────────────────────────────────────────

let councilSchemaReady: Promise<void> | null = null;

export async function ensureCouncilSchema() {
  if (!councilSchemaReady) {
    councilSchemaReady = (async () => {
      await ensureAccountSchema();
      await db.query(`
        CREATE TABLE IF NOT EXISTS council_sessions (
          id               TEXT PRIMARY KEY,
          title            TEXT NOT NULL,
          topic            TEXT NOT NULL,
          context          TEXT,
          goal             TEXT,
          status           TEXT NOT NULL DEFAULT 'pending',
          rounds           INTEGER NOT NULL DEFAULT 1,
          moderator_model  TEXT NOT NULL DEFAULT '${DEFAULT_GEMMA_MODEL}',
          seats            JSONB NOT NULL DEFAULT '[]',
          workspace_id     TEXT REFERENCES workspaces(id),
          created_by_user_id TEXT REFERENCES users(id),
          owner_agent_id   UUID,
          created_at       TIMESTAMPTZ DEFAULT NOW(),
          started_at       TIMESTAMPTZ,
          heartbeat_at     TIMESTAMPTZ,
          concluded_at     TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS council_turns (
          id            TEXT PRIMARY KEY,
          session_id    TEXT NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
          round         INTEGER NOT NULL,
          role          TEXT NOT NULL,
          model         TEXT NOT NULL,
          content       TEXT NOT NULL,
          input_tokens  INTEGER DEFAULT 0,
          output_tokens INTEGER DEFAULT 0,
          created_at    TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS council_conclusions (
          id            TEXT PRIMARY KEY,
          session_id    TEXT NOT NULL UNIQUE REFERENCES council_sessions(id) ON DELETE CASCADE,
          summary       TEXT NOT NULL,
          consensus     TEXT,
          dissent       TEXT,
          action_items  JSONB NOT NULL DEFAULT '[]',
          veto          TEXT,
          created_at    TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS council_evidence (
          id            TEXT PRIMARY KEY,
          session_id    TEXT NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
          round         INTEGER NOT NULL,
          role          TEXT NOT NULL,
          model         TEXT NOT NULL,
          tool          TEXT NOT NULL,
          runtime_class TEXT NOT NULL DEFAULT 'strict_runtime',
          status        TEXT NOT NULL DEFAULT 'requested',
          args          JSONB NOT NULL DEFAULT '{}'::jsonb,
          result        TEXT NOT NULL DEFAULT '',
          source_refs   JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at    TIMESTAMPTZ DEFAULT NOW(),
          updated_at    TIMESTAMPTZ
        );

        ALTER TABLE council_conclusions ADD COLUMN IF NOT EXISTS confidence TEXT;
        ALTER TABLE council_conclusions ADD COLUMN IF NOT EXISTS confidence_reason TEXT;
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS divergence_level TEXT;

        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS context TEXT;
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS goal TEXT;
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id);
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id);
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS owner_agent_id UUID;
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS owner_api_key_id TEXT;
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS owner_user_email TEXT;
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS access_token_hash TEXT;
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS last_error TEXT;
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS run_attempts INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

        CREATE INDEX IF NOT EXISTS idx_council_turns_session ON council_turns(session_id, round, created_at);
        CREATE INDEX IF NOT EXISTS idx_council_sessions_status ON council_sessions(status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_council_sessions_workspace_id ON council_sessions(workspace_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_council_sessions_created_by_user_id ON council_sessions(created_by_user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_council_sessions_owner_api_key_id ON council_sessions(owner_api_key_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_council_sessions_owner_user_email ON council_sessions(owner_user_email, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_council_evidence_session ON council_evidence(session_id, round, created_at);
      `);
    })().catch((error) => {
      councilSchemaReady = null;
      throw error;
    });
  }
  await councilSchemaReady;
}

// ─── Text/data utilities ───────────────────────────────────────────────────────

export function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeToolRefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => sanitizeText(item)).filter(Boolean))];
}

export function normalizeJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeSeat(raw: unknown, fallbackModel: string): CouncilSeat | null {
  if (!raw || typeof raw !== "object") return null;
  const role = sanitizeText((raw as Record<string, unknown>).role);
  const model = sanitizeText((raw as Record<string, unknown>).model) || fallbackModel;
  const systemPrompt = sanitizeText((raw as Record<string, unknown>).systemPrompt);
  const bias = sanitizeText((raw as Record<string, unknown>).bias) || undefined;
  const tools = normalizeToolRefs((raw as Record<string, unknown>).tools);
  const library_id = sanitizeText((raw as Record<string, unknown>).library_id) || undefined;
  if (!role || !systemPrompt) return null;
  return {
    role,
    model,
    systemPrompt,
    bias,
    tools: tools.length ? tools : undefined,
    library_id,
  };
}

export function normalizeSeats(rawSeats: unknown, fallbackModel: string): CouncilSeat[] {
  if (!Array.isArray(rawSeats)) return [];
  return rawSeats
    .map((seat) => normalizeSeat(seat, fallbackModel))
    .filter((seat): seat is CouncilSeat => Boolean(seat));
}

// ─── Row mappers ───────────────────────────────────────────────────────────────

export function mapSessionRow(row: Record<string, unknown>, defaultModeratorModel: string): CouncilSession {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    topic: String(row.topic ?? ""),
    context: row.context ? String(row.context) : null,
    goal: row.goal ? String(row.goal) : null,
    status: (row.status as CouncilSessionStatus) ?? "pending",
    rounds: Number(row.rounds ?? 1),
    moderator_model: String(row.moderator_model ?? defaultModeratorModel),
    seats: normalizeSeats(row.seats, DEFAULT_GEMMA_MODEL),
    workspace_id: row.workspace_id ? String(row.workspace_id) : null,
    created_by_user_id: row.created_by_user_id ? String(row.created_by_user_id) : null,
    owner_agent_id: row.owner_agent_id ? String(row.owner_agent_id) : null,
    owner_api_key_id: row.owner_api_key_id ? String(row.owner_api_key_id) : null,
    created_at: String(row.created_at ?? ""),
    started_at: row.started_at ? String(row.started_at) : null,
    heartbeat_at: row.heartbeat_at ? String(row.heartbeat_at) : null,
    concluded_at: row.concluded_at ? String(row.concluded_at) : null,
    last_error: row.last_error ? String(row.last_error) : null,
    run_attempts: Number(row.run_attempts ?? 0),
    updated_at: row.updated_at ? String(row.updated_at) : null,
    divergence_level: row.divergence_level ? String(row.divergence_level) : null,
    is_public: Boolean(row.is_public ?? false),
  };
}

export function mapConclusionRow(row: Record<string, unknown>): CouncilConclusion {
  const rawConfidence = row.confidence ? String(row.confidence).toLowerCase() : null;
  const confidence: CouncilConclusion["confidence"] =
    rawConfidence === "high" || rawConfidence === "medium" || rawConfidence === "low"
      ? rawConfidence
      : null;

  return {
    id: String(row.id),
    session_id: String(row.session_id),
    summary: String(row.summary ?? ""),
    consensus: row.consensus ? String(row.consensus) : null,
    dissent: parseStoredDissent(row.dissent),
    action_items: parseStoredActionItems(row.action_items),
    veto: row.veto ? String(row.veto) : null,
    confidence,
    confidence_reason: row.confidence_reason ? String(row.confidence_reason) : null,
    created_at: String(row.created_at ?? ""),
  };
}

function parseStoredDissent(raw: unknown): DissentItem[] | null {
  if (!raw) return null;
  // Stored as JSON string in TEXT column
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { return [{ question: raw, seats: {} }]; }
  }
  if (Array.isArray(parsed)) {
    const items = (parsed as unknown[])
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;
        const question = sanitizeText(obj.question);
        if (!question) return null;
        const seats: Record<string, string> = {};
        if (obj.seats && typeof obj.seats === "object" && !Array.isArray(obj.seats)) {
          for (const [k, v] of Object.entries(obj.seats as Record<string, unknown>)) {
            const val = sanitizeText(v);
            if (k && val) seats[k] = val;
          }
        }
        return { question, seats };
      })
      .filter((item): item is DissentItem => item !== null);
    return items.length ? items : null;
  }
  return null;
}

function parseStoredActionItems(raw: unknown): ActionItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((item) => {
      if (!item) return null;
      if (typeof item === "object" && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        const action = sanitizeText(obj.action);
        if (!action) return null;
        const p = sanitizeText(obj.priority).toLowerCase();
        const priority: ActionItem["priority"] =
          p === "blocking" || p === "recommended" || p === "optional" ? p : "recommended";
        return { action, priority };
      }
      // Legacy string
      const action = sanitizeText(item);
      if (!action) return null;
      return { action, priority: "recommended" as const };
    })
    .filter((item): item is ActionItem => item !== null);
}

export function mapEvidenceSource(raw: unknown): CouncilEvidenceSource | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const label = sanitizeText(value.label);
  if (!label) return null;
  return {
    label,
    uri: sanitizeText(value.uri) || null,
    snippet: sanitizeText(value.snippet) || null,
  };
}

export function mapEvidenceRow(row: Record<string, unknown>): CouncilEvidence {
  const sourceRefs = Array.isArray(row.source_refs)
    ? row.source_refs.map((item) => mapEvidenceSource(item)).filter((item): item is CouncilEvidenceSource => Boolean(item))
    : [];

  return {
    id: String(row.id),
    session_id: String(row.session_id),
    round: Number(row.round ?? 0),
    role: String(row.role ?? ""),
    model: String(row.model ?? ""),
    tool: String(row.tool ?? ""),
    runtime_class: "strict_runtime",
    status: row.status === "failed" ? "failed" : row.status === "completed" ? "completed" : "requested",
    args: normalizeJsonRecord(row.args),
    result: String(row.result ?? ""),
    source_refs: sourceRefs,
    created_at: String(row.created_at ?? ""),
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

export function mapTurnRow(row: Record<string, unknown>): CouncilTurn {
  return {
    id: String(row.id),
    session_id: String(row.session_id),
    round: Number(row.round ?? 0),
    role: String(row.role ?? ""),
    model: String(row.model ?? ""),
    content: String(row.content ?? ""),
    input_tokens: Number(row.input_tokens ?? 0),
    output_tokens: Number(row.output_tokens ?? 0),
    created_at: String(row.created_at ?? ""),
  };
}

// ─── Session state mutations ───────────────────────────────────────────────────

export async function setSessionRunning(id: string) {
  await db.query(
    `UPDATE council_sessions
     SET status = 'running',
         started_at = NOW(),
         heartbeat_at = NOW(),
         concluded_at = NULL,
         last_error = NULL,
         run_attempts = COALESCE(run_attempts, 0) + 1,
         updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

export async function touchSessionHeartbeat(id: string) {
  await db.query(
    `UPDATE council_sessions SET heartbeat_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

export async function setSessionFinished(id: string, status: Extract<CouncilSessionStatus, "concluded" | "failed">, error?: string | null) {
  await db.query(
    `UPDATE council_sessions
     SET status = $1,
         concluded_at = NOW(),
         heartbeat_at = NOW(),
         last_error = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [status, error ?? null, id]
  );
}

export async function clearSessionArtifacts(id: string) {
  await db.query(`DELETE FROM council_conclusions WHERE session_id = $1`, [id]);
  await db.query(`DELETE FROM council_evidence WHERE session_id = $1`, [id]);
  await db.query(`DELETE FROM council_turns WHERE session_id = $1`, [id]);
  await db.query(
    `UPDATE council_sessions
     SET status = 'pending',
         started_at = NULL,
         heartbeat_at = NULL,
         concluded_at = NULL,
         last_error = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

// ─── Evidence entries ──────────────────────────────────────────────────────────

export async function createEvidenceEntry(entry: {
  session_id: string;
  round: number;
  role: string;
  model: string;
  tool: string;
  runtime_class: AgenticRuntimeClass;
  args: Record<string, unknown>;
}): Promise<CouncilEvidence> {
  const id = nanoid();
  const { rows } = await db.query(
    `INSERT INTO council_evidence (id, session_id, round, role, model, tool, runtime_class, status, args, result, source_refs)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'requested',$8,'','[]'::jsonb)
     RETURNING *`,
    [
      id,
      entry.session_id,
      entry.round,
      entry.role,
      entry.model,
      entry.tool,
      entry.runtime_class,
      JSON.stringify(entry.args),
    ],
  );
  return mapEvidenceRow(rows[0] as Record<string, unknown>);
}

export async function finalizeEvidenceEntry(
  id: string,
  updates: {
    status: "completed" | "failed";
    result: string;
    sourceRefs?: CouncilEvidenceSource[];
  },
): Promise<void> {
  await db.query(
    `UPDATE council_evidence
     SET status = $1,
         result = $2,
         source_refs = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [
      updates.status,
      updates.result.slice(0, 12000),
      JSON.stringify(updates.sourceRefs ?? []),
      id,
    ],
  );
}

// ─── Turn + Conclusion persistence ────────────────────────────────────────────

export async function saveTurn(turn: Omit<CouncilTurn, "id" | "created_at">): Promise<CouncilTurn> {
  const id = nanoid();
  const { rows } = await db.query(
    `INSERT INTO council_turns (id, session_id, round, role, model, content, input_tokens, output_tokens)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [id, turn.session_id, turn.round, turn.role, turn.model, turn.content, turn.input_tokens, turn.output_tokens]
  );
  return mapTurnRow(rows[0] as Record<string, unknown>);
}

export async function saveConclusion(data: Omit<CouncilConclusion, "id" | "created_at">): Promise<CouncilConclusion> {
  const id = nanoid();
  const { rows } = await db.query(
    `INSERT INTO council_conclusions (id, session_id, summary, consensus, dissent, action_items, veto, confidence, confidence_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (session_id) DO UPDATE
     SET summary = EXCLUDED.summary,
         consensus = EXCLUDED.consensus,
         dissent = EXCLUDED.dissent,
         action_items = EXCLUDED.action_items,
         veto = EXCLUDED.veto,
         confidence = EXCLUDED.confidence,
         confidence_reason = EXCLUDED.confidence_reason
     RETURNING *`,
    [id, data.session_id, data.summary, data.consensus, data.dissent, JSON.stringify(data.action_items), data.veto, data.confidence ?? null, data.confidence_reason ?? null]
  );
  return mapConclusionRow(rows[0] as Record<string, unknown>);
}

// ─── Stale session check ───────────────────────────────────────────────────────

export function isSessionStale(session: CouncilSession, staleAfterMs: number) {
  if (session.status !== "running") return false;
  const heartbeatAt = session.heartbeat_at ? new Date(session.heartbeat_at).getTime() : 0;
  if (!heartbeatAt) return true;
  return Date.now() - heartbeatAt > staleAfterMs;
}
