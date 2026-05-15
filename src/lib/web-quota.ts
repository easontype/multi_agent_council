import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db/db";
import { getAuthenticatedCouncilOwnerEmail } from "@/lib/core/council-access";

interface QuotaWindow {
  limit: number;
  windowSeconds: number;
  label: string;
}

export interface WebQuotaResult {
  ok: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

type WebQuotaActor =
  | { kind: "user"; key: string }
  | { kind: "anonymous"; key: string };

let webQuotaSchemaReady: Promise<void> | null = null;

async function ensureWebQuotaSchema(): Promise<void> {
  if (!webQuotaSchemaReady) {
    webQuotaSchemaReady = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS web_rate_limits (
          scope       TEXT NOT NULL,
          identifier  TEXT NOT NULL,
          window_key  TEXT NOT NULL,
          count       INTEGER NOT NULL DEFAULT 1,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (scope, identifier, window_key)
        );

        CREATE INDEX IF NOT EXISTS idx_web_rate_limits_updated_at
          ON web_rate_limits(updated_at DESC);
      `);
    })().catch((error) => {
      webQuotaSchemaReady = null;
      throw error;
    });
  }

  await webQuotaSchemaReady;
}

function getRequestIp(req: NextRequest): string {
  // Priority 1: Cloudflare sets this header authoritatively — clients cannot spoof it
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  // Priority 2: Trusted proxy (e.g. Railway, Render, Nginx) sets X-Real-IP directly;
  // most platforms strip or override client-supplied values for this header
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // Priority 3: X-Forwarded-For — take the LAST IP added by the trusted proximate hop,
  // not the first (which a client can inject). If there is only one entry it is still
  // client-controlled when there is no upstream proxy, so this is a best-effort fallback.
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
    const last = ips[ips.length - 1];
    if (last) return last;
  }

  return "unknown";
}

function buildAnonymousFingerprint(req: NextRequest): string {
  const ip = getRequestIp(req);
  const userAgent = req.headers.get("user-agent")?.trim().slice(0, 160) || "unknown";
  return `${ip}|${userAgent}`;
}

function hashAnonymousFingerprint(fingerprint: string): string {
  return createHash("sha256").update(fingerprint).digest("hex");
}

async function resolveWebQuotaActor(req: NextRequest): Promise<WebQuotaActor> {
  const ownerEmail = await getAuthenticatedCouncilOwnerEmail();
  if (ownerEmail) {
    return { kind: "user", key: `user:${ownerEmail}` };
  }

  const fingerprint = buildAnonymousFingerprint(req);
  return {
    kind: "anonymous",
    key: `anon:${hashAnonymousFingerprint(fingerprint)}`,
  };
}

async function consumeQuotaWindow(
  actorKey: string,
  scope: string,
  bucket: string,
  limit: number,
): Promise<boolean> {
  const { rows } = await db.query(
    `INSERT INTO web_rate_limits (scope, identifier, window_key, count, updated_at)
     VALUES ($1, $2, $3, 1, NOW())
     ON CONFLICT (scope, identifier, window_key)
     DO UPDATE SET count = web_rate_limits.count + 1,
                   updated_at = NOW()
     WHERE web_rate_limits.count < $4
     RETURNING count`,
    [scope, actorKey, bucket, limit],
  );

  return rows.length > 0;
}

export async function enforceAnonymousWebQuota(
  req: NextRequest,
  action: string,
  windows: QuotaWindow[],
): Promise<WebQuotaResult> {
  const actor = await resolveWebQuotaActor(req);
  await ensureWebQuotaSchema();

  const now = Date.now();
  for (const window of windows) {
    const windowMs = window.windowSeconds * 1000;
    const scope = `${action}:${window.windowSeconds}`;
    const bucket = String(Math.floor(now / windowMs));
    const ok = await consumeQuotaWindow(actor.key, scope, bucket, window.limit);

    if (!ok) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now % windowMs)) / 1000));
      return {
        ok: false,
        error: `${actor.kind === "user" ? "User" : "Anonymous"} usage limit reached for ${action}: ${window.limit} per ${window.label}.`,
        retryAfterSeconds,
      };
    }
  }

  return { ok: true };
}
