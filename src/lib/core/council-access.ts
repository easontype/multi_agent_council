import { createHash, randomBytes } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const COOKIE_PREFIX = "council_session_";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

interface SessionAccessRecord {
  owner_user_email: string | null;
  access_token_hash: string | null;
  is_public: boolean;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim().toLowerCase() : "";
  return trimmed || null;
}

function resolveCookieSecureFlag(): boolean {
  if (process.env.NODE_ENV !== "production") return false;

  const configuredAppUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL;

  if (!configuredAppUrl) {
    return false;
  }

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

export function buildCouncilSessionCookieName(sessionId: string): string {
  return `${COOKIE_PREFIX}${sessionId}`;
}

export function hashCouncilSessionAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createCouncilAnonymousAccess(): { plaintextToken: string; tokenHash: string } {
  const plaintextToken = randomBytes(24).toString("base64url");
  return {
    plaintextToken,
    tokenHash: hashCouncilSessionAccessToken(plaintextToken),
  };
}

export function attachCouncilSessionCookie(
  response: NextResponse,
  sessionId: string,
  plaintextToken: string,
): void {
  response.cookies.set({
    name: buildCouncilSessionCookieName(sessionId),
    value: plaintextToken,
    httpOnly: true,
    sameSite: "lax",
    secure: resolveCookieSecureFlag(),
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearCouncilSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set({
    name: buildCouncilSessionCookieName(sessionId),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: resolveCookieSecureFlag(),
    path: "/",
    maxAge: 0,
  });
}

export async function getAuthenticatedCouncilOwnerEmail(): Promise<string | null> {
  const session = await auth();
  return normalizeEmail(session?.user?.email);
}

async function getSessionAccessRecord(sessionId: string): Promise<SessionAccessRecord | null> {
  const { rows } = await db.query(
    `SELECT owner_user_email, access_token_hash, is_public
     FROM council_sessions
     WHERE id = $1`,
    [sessionId],
  );

  if (!rows.length) return null;

  const row = rows[0] as SessionAccessRecord;
  return {
    owner_user_email: normalizeEmail(row.owner_user_email),
    access_token_hash: typeof row.access_token_hash === "string" ? row.access_token_hash : null,
    is_public: Boolean(row.is_public),
  };
}

export async function canAccessCouncilSession(req: NextRequest, sessionId: string): Promise<boolean> {
  const access = await getSessionAccessRecord(sessionId);
  if (!access) return false;

  if (access.is_public) return true;

  const ownerEmail = await getAuthenticatedCouncilOwnerEmail();
  if (ownerEmail && access.owner_user_email && ownerEmail === access.owner_user_email) {
    return true;
  }

  const plaintextToken = req.cookies.get(buildCouncilSessionCookieName(sessionId))?.value;
  if (!plaintextToken || !access.access_token_hash) return false;

  return hashCouncilSessionAccessToken(plaintextToken) === access.access_token_hash;
}

export async function isCouncilSessionOwner(req: NextRequest, sessionId: string): Promise<boolean> {
  const access = await getSessionAccessRecord(sessionId);
  if (!access) return false;

  const ownerEmail = await getAuthenticatedCouncilOwnerEmail();
  if (ownerEmail && access.owner_user_email && ownerEmail === access.owner_user_email) return true;

  const plaintextToken = req.cookies.get(buildCouncilSessionCookieName(sessionId))?.value;
  if (!plaintextToken || !access.access_token_hash) return false;

  return hashCouncilSessionAccessToken(plaintextToken) === access.access_token_hash;
}
