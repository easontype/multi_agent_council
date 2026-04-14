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
      id                 TEXT PRIMARY KEY,
      key_hash           TEXT NOT NULL UNIQUE,
      name               TEXT NOT NULL,
      email              TEXT,
      tier               TEXT NOT NULL DEFAULT 'free',
      daily_limit        INTEGER NOT NULL DEFAULT 10,
      used_today         INTEGER NOT NULL DEFAULT 0,
      reset_date         DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      last_used_at       TIMESTAMPTZ,
      revoked_at         TIMESTAMPTZ,
      stripe_session_id  TEXT UNIQUE
    )
  `);
  // Add stripe_session_id if table already exists (migration)
  await db.query(`
    ALTER TABLE council_api_keys
    ADD COLUMN IF NOT EXISTS stripe_session_id TEXT UNIQUE
  `).catch(() => {/* ignore if already exists */});
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

// ─── Pending Keys (pre-generated before Stripe payment) ──────────────────────

async function ensurePendingKeySchema(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS council_pending_keys (
      id                TEXT PRIMARY KEY,
      plaintext_key     TEXT NOT NULL,
      key_hash          TEXT NOT NULL UNIQUE,
      name              TEXT NOT NULL,
      email             TEXT,
      stripe_session_id TEXT NOT NULL UNIQUE,
      expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
      claimed           BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
}

/**
 * Pre-generate a Pro API key before the Stripe session is confirmed.
 * The plaintext key is stored temporarily (2h) so the success page can retrieve it.
 */
export async function reserveProKeyForSession(
  stripeSessionId: string,
  name: string,
  email?: string
): Promise<{ id: string; plaintextKey: string }> {
  await ensurePendingKeySchema();

  const id = nanoid();
  const rawBytes = randomBytes(32).toString("hex");
  const plaintextKey = `cak_${rawBytes}`;
  const keyHash = hashKey(plaintextKey);

  await db.query(
    `INSERT INTO council_pending_keys
       (id, plaintext_key, key_hash, name, email, stripe_session_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, plaintextKey, keyHash, name, email ?? null, stripeSessionId]
  );

  return { id, plaintextKey };
}

/**
 * Called from the Stripe webhook: promote the pending key to a real Pro key.
 * Idempotent — safe to call multiple times for the same session.
 */
export async function activateProKeyForSession(stripeSessionId: string): Promise<void> {
  await ensurePendingKeySchema();
  await ensureApiKeySchema();

  const { rows } = await db.query(
    `SELECT id, key_hash, name, email FROM council_pending_keys
     WHERE stripe_session_id = $1`,
    [stripeSessionId]
  );

  if (!rows.length) {
    // No pending key — webhook arrived before checkout API (unlikely). Create fresh.
    return;
  }

  const row = rows[0] as { id: string; key_hash: string; name: string; email: string | null };

  // Upsert into main table
  await db.query(
    `INSERT INTO council_api_keys
       (id, key_hash, name, email, tier, daily_limit, stripe_session_id)
     VALUES ($1, $2, $3, $4, 'pro', 500, $5)
     ON CONFLICT (stripe_session_id) DO NOTHING`,
    [row.id, row.key_hash, row.name, row.email, stripeSessionId]
  );
}

/**
 * Called from the success page: return the plaintext key (once only).
 * Marks it as claimed so it can't be retrieved again.
 */
export async function claimPendingKey(stripeSessionId: string): Promise<{
  found: boolean;
  alreadyClaimed?: boolean;
  expired?: boolean;
  plaintextKey?: string;
  id?: string;
  name?: string;
}> {
  await ensurePendingKeySchema();

  // Atomic UPDATE: only succeeds if the row exists AND claimed = FALSE.
  // Prevents double-claim race conditions without needing a separate SELECT.
  const { rows } = await db.query(
    `UPDATE council_pending_keys
     SET claimed = TRUE
     WHERE stripe_session_id = $1 AND claimed = FALSE
     RETURNING id, plaintext_key, name, expires_at`,
    [stripeSessionId]
  );

  if (!rows.length) {
    // Either not found, or already claimed — distinguish the two cases.
    const check = await db.query(
      `SELECT claimed FROM council_pending_keys WHERE stripe_session_id = $1`,
      [stripeSessionId]
    );
    if (!check.rows.length) return { found: false };
    return { found: true, alreadyClaimed: true };
  }

  const row = rows[0] as {
    id: string;
    plaintext_key: string;
    name: string;
    expires_at: Date;
  };

  // Enforce expiry (expires_at was never checked before — security regression fix).
  if (new Date(row.expires_at) < new Date()) {
    return { found: true, alreadyClaimed: false, expired: true };
  }

  return {
    found: true,
    alreadyClaimed: false,
    plaintextKey: row.plaintext_key,
    id: row.id,
    name: row.name,
  };
}
