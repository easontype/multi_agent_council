import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-keys";
import { fetchArxivPaper, ingestPaper } from "@/lib/paper-ingest";
import {
  buildAcademicCritiqueSeats,
  buildGapAnalysisSeats,
} from "@/lib/core/council-academic";
import { createCouncilSession, runCouncilSession } from "@/lib/core/council";
import type { CouncilSeat } from "@/lib/core/council-types";
import { DEFAULT_GEMMA_MODEL } from "@/lib/llm/gemma-models";

function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

export async function POST(req: NextRequest) {
  // ── 1. Authenticate ──────────────────────────────────────────────────────
  const token = extractBearerToken(req);
  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <key> header" },
      { status: 401 }
    );
  }

  const auth = await validateApiKey(token);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const arxivId = typeof body.arxivId === "string" ? body.arxivId.trim() : null;
  const rawText = typeof body.text === "string" ? body.text.trim() : null;
  const rawTitle = typeof body.title === "string" ? body.title.trim() : null;
  const template = body.template === "gap" ? "gap" : "critique";
  const rounds = body.rounds === 2 ? 2 : 1;
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : DEFAULT_GEMMA_MODEL;

  if (!arxivId && !rawText) {
    return NextResponse.json(
      { error: "Provide either arxivId or text" },
      { status: 400 }
    );
  }

  if (rawText && !rawTitle) {
    return NextResponse.json(
      { error: "title is required when providing text" },
      { status: 400 }
    );
  }

  // ── 3. Ingest paper ──────────────────────────────────────────────────────
  let paperTitle: string;
  let paperText: string;
  let paperUrl: string;

  try {
    if (arxivId) {
      const fetched = await fetchArxivPaper(arxivId);
      paperTitle = fetched.title;
      paperText = fetched.text;
      paperUrl = fetched.url;
    } else {
      paperTitle = rawTitle!;
      paperText = rawText!;
      paperUrl = "text://inline";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch paper";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let ingestResult: Awaited<ReturnType<typeof ingestPaper>>;
  try {
    ingestResult = await ingestPaper({
      text: paperText,
      title: paperTitle,
      sourceUrl: paperUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ingest paper";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // ── 4. Build seats with library_id ───────────────────────────────────────
  const rawSeats: CouncilSeat[] =
    template === "gap"
      ? buildGapAnalysisSeats(model)
      : buildAcademicCritiqueSeats(model);

  const seats: CouncilSeat[] = rawSeats.map((seat) => ({
    ...seat,
    library_id: ingestResult.libraryId,
  }));

  // ── 5. Create council session ────────────────────────────────────────────
  let session: Awaited<ReturnType<typeof createCouncilSession>>;
  try {
    session = await createCouncilSession({
      title: paperTitle,
      topic: `Academic peer review of: ${paperTitle}`,
      context: `Paper ingested from ${paperUrl}. Library ID: ${ingestResult.libraryId}`,
      goal:
        template === "gap"
          ? "Identify gaps, weaknesses, and missing elements in the paper before submission."
          : "Provide a rigorous multi-perspective academic critique of the paper.",
      seats,
      rounds,
      ownerApiKeyId: auth.keyId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create council session";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // ── 6. Fire-and-forget: run session in background ────────────────────────
  void (async () => {
    try {
      await runCouncilSession(session.id, () => {});
    } catch {
      // Silently swallow — caller polls for status
    }
  })();

  // ── 7. Return 202 ────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      sessionId: session.id,
      status: "pending",
      pollUrl: `/api/public/v1/sessions/${session.id}`,
    },
    { status: 202 }
  );
}
