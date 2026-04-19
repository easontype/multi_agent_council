import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { ensureAccountSchema } from "@/lib/db/account-db";
import type { EditableReviewAgent, ReviewMode } from "@/lib/review-presets";

export interface TeamTemplateRecord {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  name: string;
  mode: ReviewMode;
  rounds: 1 | 2;
  agents: EditableReviewAgent[];
  createdAt: string;
  updatedAt: string;
}

let teamTemplateSchemaReady: Promise<void> | null = null;

function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMode(value: unknown): ReviewMode {
  return value === "gap" ? "gap" : "critique";
}

function normalizeRounds(value: unknown): 1 | 2 {
  return value === 2 || value === "2" ? 2 : 1;
}

function normalizeAgents(value: unknown): EditableReviewAgent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is EditableReviewAgent => Boolean(item && typeof item === "object"));
}

function mapTeamTemplateRow(row: Record<string, unknown>): TeamTemplateRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    createdByUserId: String(row.created_by_user_id),
    name: String(row.name ?? ""),
    mode: normalizeMode(row.mode),
    rounds: normalizeRounds(row.rounds),
    agents: normalizeAgents(row.agents_json),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function ensureTeamTemplateSchema(): Promise<void> {
  if (!teamTemplateSchemaReady) {
    teamTemplateSchemaReady = (async () => {
      await ensureAccountSchema();
      await db.query(`
        CREATE TABLE IF NOT EXISTS team_templates (
          id                 TEXT PRIMARY KEY,
          workspace_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name               TEXT NOT NULL,
          mode               TEXT NOT NULL,
          rounds             INTEGER NOT NULL DEFAULT 1,
          agents_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at         TIMESTAMPTZ DEFAULT NOW(),
          updated_at         TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_team_templates_workspace_id
          ON team_templates(workspace_id, updated_at DESC);

        CREATE INDEX IF NOT EXISTS idx_team_templates_created_by_user_id
          ON team_templates(created_by_user_id, updated_at DESC);
      `);
    })().catch((error) => {
      teamTemplateSchemaReady = null;
      throw error;
    });
  }

  await teamTemplateSchemaReady;
}

export async function listTeamTemplatesForWorkspace(workspaceId: string): Promise<TeamTemplateRecord[]> {
  await ensureTeamTemplateSchema();

  const { rows } = await db.query(
    `SELECT *
     FROM team_templates
     WHERE workspace_id = $1
     ORDER BY updated_at DESC
     LIMIT 20`,
    [workspaceId],
  );

  return rows.map((row) => mapTeamTemplateRow(row as Record<string, unknown>));
}

export async function upsertTeamTemplate(input: {
  id?: string;
  workspaceId: string;
  createdByUserId: string;
  name: string;
  mode: ReviewMode;
  rounds: 1 | 2;
  agents: EditableReviewAgent[];
}): Promise<TeamTemplateRecord> {
  await ensureTeamTemplateSchema();

  const id = sanitizeText(input.id) || nanoid();
  const name = sanitizeText(input.name);
  if (!name) throw new Error("Template name is required");

  const { rows } = await db.query(
    `INSERT INTO team_templates (
       id, workspace_id, created_by_user_id, name, mode, rounds, agents_json
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name,
         mode = EXCLUDED.mode,
         rounds = EXCLUDED.rounds,
         agents_json = EXCLUDED.agents_json,
         updated_at = NOW()
     WHERE team_templates.workspace_id = EXCLUDED.workspace_id
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.createdByUserId,
      name,
      normalizeMode(input.mode),
      normalizeRounds(input.rounds),
      JSON.stringify(input.agents),
    ],
  );

  if (!rows.length) {
    throw new Error("Template does not belong to the active workspace");
  }

  return mapTeamTemplateRow(rows[0] as Record<string, unknown>);
}

export async function deleteTeamTemplate(id: string, workspaceId: string): Promise<boolean> {
  await ensureTeamTemplateSchema();

  const { rowCount } = await db.query(
    `DELETE FROM team_templates
     WHERE id = $1 AND workspace_id = $2`,
    [sanitizeText(id), workspaceId],
  );

  return Boolean(rowCount);
}
