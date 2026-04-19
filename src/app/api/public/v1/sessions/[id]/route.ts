import { NextRequest, NextResponse } from "next/server";
import { checkApiKey } from "@/lib/api-keys";
import {
  getSession,
  getSessionTurns,
  getSessionConclusion,
  MODERATOR_ROUND,
} from "@/lib/council";

function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── 1. Authenticate ──────────────────────────────────────────────────────
  const token = extractBearerToken(req);
  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <key> header" },
      { status: 401 }
    );
  }

  // For polling we check key validity but do NOT increment the daily counter
  // (only the /analyze endpoint consumes quota). We still verify the key is
  // active and not revoked by doing a lightweight lookup.
  const auth = await checkApiKey(token);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  // ── 2. Fetch session ─────────────────────────────────────────────────────
  const { id } = await params;

  const [session, turns, conclusion] = await Promise.all([
    getSession(id),
    getSessionTurns(id),
    getSessionConclusion(id),
  ]);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // ── 3. Shape response ────────────────────────────────────────────────────
  const publicTurns = turns
    .filter((t) => t.round !== MODERATOR_ROUND)
    .map((t) => ({
      id: t.id,
      round: t.round,
      role: t.role,
      model: t.model,
      content: t.content,
      created_at: t.created_at,
    }));

  const publicConclusion = conclusion
    ? {
        summary: conclusion.summary,
        consensus: conclusion.consensus,
        dissent: conclusion.dissent,
        action_items: conclusion.action_items,
        confidence: conclusion.confidence,
      }
    : null;

  return NextResponse.json({
    sessionId: session.id,
    status: session.status,
    title: session.title,
    conclusion: publicConclusion,
    turns: publicTurns,
  });
}
