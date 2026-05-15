import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db/db";
import { getAuthenticatedCouncilOwnerEmail } from "@/lib/core/council-access";
import type { AnonymousVisitorIdentity } from "@/lib/anonymous-access";
import { ensureAnonymousVisitorIdentity } from "@/lib/anonymous-access";

interface QuotaWindow {
  limit: number;
  windowSeconds: number;
  label: string;
}

export interface WebQuotaResult {
  ok: boolean;
  error?: string;
  retryAfterSeconds?: number;
  anonymousVisitorIdToSet?: string;
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

// Returns the deployment-injected IP only — never a client-controlled header.
// On Vercel, `x-forwarded-for` is rewritten by the edge to contain the real client
// IP as the FIRST entry (Vercel prepends, not appends). On Cloudflare it is
// `cf-connecting-ip`. On bare Node (local dev) we fall back to "unknown" rather
// than trusting any client-supplied value.
function getRequestIp(req: NextRequest): string {
  // Cloudflare: authoritative, clients cannot inject this header
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  // Vercel / Railway / Render: platform sets X-Real-IP, not the client
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // DO NOT trust X-Forwarded-For — it is client-controllable when there is no
  // upstream proxy that strips/overwrites it. Using it as a rate-limit key allows
  // trivial bypass by rotating the header value.
  return "unknown";
}

// Combines the server-side IP with a stable anonymous session cookie so that
// a single actor behind "unknown" (local dev / bare Node) still gets bucketed
// consistently, while IP rotation alone is not enough to bypass limits.
function buildAnonymousFingerprint(req: NextRequest, anonymousVisitor?: AnonymousVisitorIdentity): string {
  const ip = getRequestIp(req);
  // Include a stable anonymous session cookie as secondary signal.
  // This is NOT security-critical alone, but it makes IP-rotation attacks
  // require also rotating cookies — raising the bar meaningfully.
  const anonSession = (anonymousVisitor ?? ensureAnonymousVisitorIdentity(req)).plaintextId.slice(0, 64);
  return `${ip}|${anonSession}`;
}

function hashAnonymousFingerprint(fingerprint: string): string {
  return createHash("sha256").update(fingerprint).digest("hex");
}

async function resolveWebQuotaActor(
  req: NextRequest,
  anonymousVisitor?: AnonymousVisitorIdentity,
): Promise<WebQuotaActor> {
  const ownerEmail = await getAuthenticatedCouncilOwnerEmail();
  if (ownerEmail) {
    return { kind: "user", key: `user:${ownerEmail}` };
  }

  const fingerprint = buildAnonymousFingerprint(req, anonymousVisitor);
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
  anonymousVisitor?: AnonymousVisitorIdentity,
): Promise<WebQuotaResult> {
  const actor = await resolveWebQuotaActor(req, anonymousVisitor);
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
        anonymousVisitorIdToSet:
          actor.kind === "anonymous" && anonymousVisitor?.needsSetCookie
            ? anonymousVisitor.plaintextId
            : undefined,
      };
    }
  }

  return {
    ok: true,
    anonymousVisitorIdToSet:
      actor.kind === "anonymous" && anonymousVisitor?.needsSetCookie
        ? anonymousVisitor.plaintextId
        : undefined,
  };
}
