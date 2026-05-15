import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";

export const COUNCIL_ANON_COOKIE = "council_anon";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface AnonymousVisitorIdentity {
  plaintextId: string;
  idHash: string;
  needsSetCookie: boolean;
}

function resolveCookieSecureFlag(): boolean {
  if (process.env.NODE_ENV !== "production") return false;

  const configuredAppUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL;

  if (!configuredAppUrl) return false;

  try {
    const hostname = new URL(configuredAppUrl).hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

export function hashAnonymousVisitorId(plaintextId: string): string {
  return createHash("sha256").update(plaintextId).digest("hex");
}

export function ensureAnonymousVisitorIdentity(req: Pick<NextRequest, "cookies">): AnonymousVisitorIdentity {
  const existing = req.cookies.get(COUNCIL_ANON_COOKIE)?.value?.trim();
  if (existing) {
    return {
      plaintextId: existing,
      idHash: hashAnonymousVisitorId(existing),
      needsSetCookie: false,
    };
  }

  const plaintextId = randomBytes(24).toString("base64url");
  return {
    plaintextId,
    idHash: hashAnonymousVisitorId(plaintextId),
    needsSetCookie: true,
  };
}

export function buildAnonymousVisitorSetCookie(plaintextId: string): string {
  const parts = [
    `${COUNCIL_ANON_COOKIE}=${plaintextId}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    `Expires=${new Date(Date.now() + COOKIE_MAX_AGE_SECONDS * 1000).toUTCString()}`,
    "HttpOnly",
    "SameSite=Strict",
  ];

  if (resolveCookieSecureFlag()) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
