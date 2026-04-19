import { nanoid } from "nanoid";
import { db } from "./db";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export interface AccountContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  email: string;
  displayName: string | null;
}

interface UserRow {
  id: string;
  primary_email: string;
  display_name: string | null;
}

interface WorkspaceRow {
  id: string;
}

let accountSchemaReady: Promise<void> | null = null;

function normalizeEmail(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function buildPersonalWorkspaceName(email: string, displayName?: string | null): string {
  const normalizedDisplayName = normalizeText(displayName);
  if (normalizedDisplayName) return `${normalizedDisplayName} Workspace`;

  const emailLocalPart = email.split("@")[0]?.trim() || "Personal";
  return `${emailLocalPart} Workspace`;
}

export async function ensureAccountSchema(): Promise<void> {
  if (!accountSchemaReady) {
    accountSchemaReady = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id             TEXT PRIMARY KEY,
          primary_email  TEXT NOT NULL UNIQUE,
          display_name   TEXT,
          avatar_url     TEXT,
          status         TEXT NOT NULL DEFAULT 'active',
          created_at     TIMESTAMPTZ DEFAULT NOW(),
          updated_at     TIMESTAMPTZ DEFAULT NOW(),
          last_seen_at   TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS workspaces (
          id             TEXT PRIMARY KEY,
          slug           TEXT NOT NULL UNIQUE,
          name           TEXT NOT NULL,
          kind           TEXT NOT NULL DEFAULT 'personal',
          owner_user_id  TEXT REFERENCES users(id),
          created_at     TIMESTAMPTZ DEFAULT NOW(),
          updated_at     TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS workspace_memberships (
          id             TEXT PRIMARY KEY,
          workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role           TEXT NOT NULL DEFAULT 'owner',
          created_at     TIMESTAMPTZ DEFAULT NOW(),
          updated_at     TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (workspace_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_workspaces_owner_user_id
          ON workspaces(owner_user_id);

        CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_id
          ON workspace_memberships(user_id, workspace_id);
      `);
    })().catch((error) => {
      accountSchemaReady = null;
      throw error;
    });
  }

  await accountSchemaReady;
}

export async function ensureUserAccountByEmail(input: {
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<AccountContext> {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("Account email required");
  }

  await ensureAccountSchema();

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    let userRow: UserRow | null = null;
    const existingUser = await client.query(
      `SELECT id, primary_email, display_name
       FROM users
       WHERE primary_email = $1
       FOR UPDATE`,
      [email],
    );

    if (existingUser.rows.length) {
      const displayName = normalizeText(input.displayName);
      const avatarUrl = normalizeText(input.avatarUrl);
      const { rows } = await client.query(
        `UPDATE users
         SET display_name = COALESCE($2, display_name),
             avatar_url = COALESCE($3, avatar_url),
             updated_at = NOW(),
             last_seen_at = NOW()
         WHERE id = $1
         RETURNING id, primary_email, display_name`,
        [existingUser.rows[0].id, displayName, avatarUrl],
      );
      userRow = rows[0] as UserRow;
    } else {
      const userId = nanoid();
      const displayName = normalizeText(input.displayName);
      const avatarUrl = normalizeText(input.avatarUrl);
      const { rows } = await client.query(
        `INSERT INTO users (id, primary_email, display_name, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, primary_email, display_name`,
        [userId, email, displayName, avatarUrl],
      );
      userRow = rows[0] as UserRow;
    }

    const workspaceLookup = await client.query(
      `SELECT id
       FROM workspaces
       WHERE owner_user_id = $1
         AND kind = 'personal'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE`,
      [userRow.id],
    );

    let workspaceRow: WorkspaceRow;
    if (workspaceLookup.rows.length) {
      workspaceRow = workspaceLookup.rows[0] as WorkspaceRow;
      await client.query(
        `UPDATE workspaces
         SET updated_at = NOW(),
             name = COALESCE(name, $2)
         WHERE id = $1`,
        [workspaceRow.id, buildPersonalWorkspaceName(email, userRow.display_name)],
      );
    } else {
      const workspaceId = nanoid();
      const slug = `personal-${userRow.id}`;
      const workspaceName = buildPersonalWorkspaceName(email, userRow.display_name);
      const { rows } = await client.query(
        `INSERT INTO workspaces (id, slug, name, kind, owner_user_id)
         VALUES ($1, $2, $3, 'personal', $4)
         RETURNING id`,
        [workspaceId, slug, workspaceName, userRow.id],
      );
      workspaceRow = rows[0] as WorkspaceRow;
    }

    await client.query(
      `INSERT INTO workspace_memberships (id, workspace_id, user_id, role)
       VALUES ($1, $2, $3, 'owner')
       ON CONFLICT (workspace_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
      [nanoid(), workspaceRow.id, userRow.id],
    );

    await client.query("COMMIT");

    return {
      userId: userRow.id,
      workspaceId: workspaceRow.id,
      role: "owner",
      email: userRow.primary_email,
      displayName: userRow.display_name,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
