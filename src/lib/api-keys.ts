/**
 * api-keys.ts — Council API Key management
 *
 * Key format: cak_<32 random hex chars>
 * Only the SHA-256 hash is stored; the plaintext is returned once at creation.
 */

import { createHash, randomBytes } from "crypto";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";

// ─── Schema ───────────────────────────────────────────────────────────────────

export async function ensureApiKeySchema(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS council_api_keys (
      id           TEXT PRIMARY KEY,
      key_hash     TEXT NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      email        TEXT,
      tier         TEXT NOT NULL DEFAULT 'free',
      daily_limit  INTEGER NOT NULL DEFAULT 10,
      used_today   INTEGER NOT NULL DEFAULT 0,
      reset_date   DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      revoked_at   TIMESTAMPTZ
    )
  `);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashKey(plaintextKey: string): string {
  return createHash("sha256").update(plaintextKey).digest("hex");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateApiKey(
  name: string,
  email?: string
): Promise<{ id: string; plaintextKey: string; keyHash: string }> {
  await ensureApiKeySchema();

  const id = nanoid();
  const rawBytes = randomBytes(32).toString("hex");
  const plaintextKey = `cak_${rawBytes}`;
  const keyHash = hashKey(plaintextKey);

  await db.query(
    `INSERT INTO council_api_keys (id, key_hash, name, email)
     VALUES ($1, $2, $3, $4)`,
    [id, keyHash, name, email ?? null]
  );

  return { id, plaintextKey, keyHash };
}

export async function validateApiKey(plaintextKey: string): Promise<{
  valid: boolean;
  keyId?: string;
  tier?: string;
  error?: string;
}> {
  await ensureApiKeySchema();

  const keyHash = hashKey(plaintextKey);

  const { rows } = await db.query(
    `SELECT id, tier, daily_limit, used_today, reset_date, revoked_at
     FROM council_api_keys
     WHERE key_hash = $1`,
    [keyHash]
  );

  if (!rows.length) {
    return { valid: false, error: "Invalid API key" };
  }

  const row = rows[0] as {
    id: string;
    tier: string;
    daily_limit: number;
    used_today: number;
    reset_date: string; // DATE comes back as string from pg
    revoked_at: Date | null;
  };

  if (row.revoked_at) {
    return { valid: false, error: "API key has been revoked" };
  }

  // Reset daily counter if the reset_date is before today
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const resetDate =
    typeof row.reset_date === "string"
      ? row.reset_date.slice(0, 10)
      : (row.reset_date as unknown as Date).toISOString().slice(0, 10);

  if (resetDate < today) {
    await db.query(
      `UPDATE council_api_keys
       SET used_today = 1, reset_date = CURRENT_DATE, last_used_at = NOW()
       WHERE id = $1`,
      [row.id]
    );
    return { valid: true, keyId: row.id, tier: row.tier };
  }

  // Check daily limit
  if (row.used_today >= row.daily_limit) {
    return {
      valid: false,
      error: `Daily limit of ${row.daily_limit} requests reached. Resets tomorrow.`,
    };
  }

  // Increment counter
  await db.query(
    `UPDATE council_api_keys
     SET used_today = used_today + 1, last_used_at = NOW()
     WHERE id = $1`,
    [row.id]
  );

  return { valid: true, keyId: row.id, tier: row.tier };
}

/**
 * Check that a key exists and is not revoked, WITHOUT consuming the daily quota.
 * Use this for read-only / polling endpoints.
 */
export async function checkApiKey(plaintextKey: string): Promise<{
  valid: boolean;
  keyId?: string;
  tier?: string;
  error?: string;
}> {
  await ensureApiKeySchema();

  const keyHash = hashKey(plaintextKey);

  const { rows } = await db.query(
    `SELECT id, tier, revoked_at FROM council_api_keys WHERE key_hash = $1`,
    [keyHash]
  );

  if (!rows.length) {
    return { valid: false, error: "Invalid API key" };
  }

  const row = rows[0] as { id: string; tier: string; revoked_at: Date | null };

  if (row.revoked_at) {
    return { valid: false, error: "API key has been revoked" };
  }

  return { valid: true, keyId: row.id, tier: row.tier };
}

export async function revokeApiKey(id: string): Promise<void> {
  await ensureApiKeySchema();
  await db.query(
    `UPDATE council_api_keys SET revoked_at = NOW() WHERE id = $1`,
    [id]
  );
}
