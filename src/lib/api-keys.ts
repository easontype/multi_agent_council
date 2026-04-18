/**
 * Council API key management.
 *
 * Key format: cak_<32 random hex chars>
 * Only the SHA-256 hash is stored in the main key table.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";

export async function ensureApiKeySchema(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS council_api_keys (
      id                      TEXT PRIMARY KEY,
      key_hash                TEXT NOT NULL UNIQUE,
      name                    TEXT NOT NULL,
      email                   TEXT,
      tier                    TEXT NOT NULL DEFAULT 'free',
      daily_limit             INTEGER NOT NULL DEFAULT 10,
      used_today              INTEGER NOT NULL DEFAULT 0,
      reset_date              DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at              TIMESTAMPTZ DEFAULT NOW(),
      last_used_at            TIMESTAMPTZ,
      revoked_at              TIMESTAMPTZ,
      stripe_session_id       TEXT UNIQUE,
      stripe_subscription_id  TEXT UNIQUE
    )
  `);

  await db
    .query(`ALTER TABLE council_api_keys ADD COLUMN IF NOT EXISTS stripe_session_id TEXT UNIQUE`)
    .catch(() => {});

  await db
    .query(`ALTER TABLE council_api_keys ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE`)
    .catch(() => {});
}

function hashKey(plaintextKey: string): string {
  return createHash("sha256").update(plaintextKey).digest("hex");
}

function getPendingKeyEncryptionSecret(): string {
  const secret = process.env.API_KEYS_ENCRYPTION_SECRET ?? process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "API_KEYS_ENCRYPTION_SECRET or AUTH_SECRET must be configured to protect pending API keys"
    );
  }

  return secret;
}

function encryptPendingPlaintextKey(plaintextKey: string): string {
  const key = createHash("sha256").update(getPendingKeyEncryptionSecret()).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

function decryptPendingPlaintextKey(encryptedValue: string): string {
  const [version, ivHex, authTagHex, ciphertextHex] = encryptedValue.split(":");

  if (version !== "v1" || !ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Invalid pending API key payload");
  }

  const key = createHash("sha256").update(getPendingKeyEncryptionSecret()).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

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

  const consumeAttempt = await db.query(
    `UPDATE council_api_keys
     SET used_today = CASE
         WHEN reset_date < CURRENT_DATE THEN 1
         ELSE used_today + 1
       END,
       reset_date = CASE
         WHEN reset_date < CURRENT_DATE THEN CURRENT_DATE
         ELSE reset_date
       END,
       last_used_at = NOW()
     WHERE key_hash = $1
       AND revoked_at IS NULL
       AND CASE
         WHEN reset_date < CURRENT_DATE THEN 0
         ELSE used_today
       END < daily_limit
     RETURNING id, tier`,
    [keyHash]
  );

  if (consumeAttempt.rows.length) {
    const row = consumeAttempt.rows[0] as { id: string; tier: string };
    return { valid: true, keyId: row.id, tier: row.tier };
  }

  const { rows } = await db.query(
    `SELECT id, tier, daily_limit, used_today, revoked_at
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
    revoked_at: Date | null;
  };

  if (row.revoked_at) {
    return { valid: false, error: "API key has been revoked" };
  }

  if (row.used_today >= row.daily_limit) {
    return {
      valid: false,
      error: `Daily limit of ${row.daily_limit} requests reached. Resets tomorrow.`,
    };
  }

  return { valid: false, error: "API key validation failed" };
}

/**
 * Check that a key exists and is not revoked, WITHOUT consuming the daily quota.
 * Use this for read-only or polling endpoints.
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
  await db.query(`UPDATE council_api_keys SET revoked_at = NOW() WHERE id = $1`, [id]);
}

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

  await db
    .query(`
      ALTER TABLE council_pending_keys
      ALTER COLUMN plaintext_key DROP NOT NULL
    `)
    .catch(() => {
      /* ignore if already nullable */
    });
}

/**
 * Pre-generate a Pro API key before the Stripe session is confirmed.
 * The plaintext value is encrypted at rest and can only be recovered once.
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
  const encryptedPlaintextKey = encryptPendingPlaintextKey(plaintextKey);

  await db.query(
    `INSERT INTO council_pending_keys
       (id, plaintext_key, key_hash, name, email, stripe_session_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, encryptedPlaintextKey, keyHash, name, email ?? null, stripeSessionId]
  );

  return { id, plaintextKey };
}

/**
 * Called from the Stripe webhook: promote the pending key to a real Pro key.
 * Idempotent and safe to call multiple times for the same session.
 */
export async function activateProKeyForSession(
  stripeSessionId: string,
  subscriptionId?: string | null
): Promise<void> {
  await ensurePendingKeySchema();
  await ensureApiKeySchema();

  const { rows } = await db.query(
    `SELECT id, key_hash, name, email FROM council_pending_keys
     WHERE stripe_session_id = $1`,
    [stripeSessionId]
  );

  if (!rows.length) {
    return;
  }

  const row = rows[0] as {
    id: string;
    key_hash: string;
    name: string;
    email: string | null;
  };

  await db.query(
    `INSERT INTO council_api_keys
       (id, key_hash, name, email, tier, daily_limit, stripe_session_id, stripe_subscription_id)
     VALUES ($1, $2, $3, $4, 'pro', 500, $5, $6)
     ON CONFLICT (stripe_session_id) DO NOTHING`,
    [row.id, row.key_hash, row.name, row.email, stripeSessionId, subscriptionId ?? null]
  );
}

export async function revokeKeysBySubscription(subscriptionId: string): Promise<void> {
  await ensureApiKeySchema();
  await db.query(
    `UPDATE council_api_keys SET revoked_at = NOW()
     WHERE stripe_subscription_id = $1 AND revoked_at IS NULL`,
    [subscriptionId]
  );
}

/**
 * Called from the success page: return the plaintext key once.
 * The pending row is atomically marked as claimed and the encrypted blob is cleared.
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

  const { rows } = await db.query(
    `WITH claimable AS (
       SELECT id, plaintext_key, name
       FROM council_pending_keys
       WHERE stripe_session_id = $1
         AND claimed = FALSE
         AND expires_at > NOW()
       FOR UPDATE
     ),
     claimed_key AS (
       UPDATE council_pending_keys AS pending
       SET claimed = TRUE,
           plaintext_key = NULL
       FROM claimable
       WHERE pending.id = claimable.id
       RETURNING claimable.id, claimable.plaintext_key, claimable.name
     )
     SELECT id, plaintext_key, name FROM claimed_key`,
    [stripeSessionId]
  );

  if (!rows.length) {
    const check = await db.query(
      `SELECT claimed, expires_at
       FROM council_pending_keys
       WHERE stripe_session_id = $1`,
      [stripeSessionId]
    );

    if (!check.rows.length) {
      return { found: false };
    }

    const existingRow = check.rows[0] as {
      claimed: boolean;
      expires_at: Date | string;
    };

    if (new Date(existingRow.expires_at) <= new Date()) {
      return { found: true, alreadyClaimed: false, expired: true };
    }

    if (existingRow.claimed) {
      return { found: true, alreadyClaimed: true };
    }

    return { found: true, alreadyClaimed: true };
  }

  const row = rows[0] as {
    id: string;
    plaintext_key: string;
    name: string;
  };

  return {
    found: true,
    alreadyClaimed: false,
    plaintextKey: decryptPendingPlaintextKey(row.plaintext_key),
    id: row.id,
    name: row.name,
  };
}
