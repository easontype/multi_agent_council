import { NextRequest, NextResponse } from "next/server";
import { fetchArxivPaper, ingestPaper, extractTextFromPdfBuffer } from "@/lib/paper-ingest";
import { buildAcademicCritiqueSeats, buildGapAnalysisSeats } from "@/lib/council-academic";
import { createCouncilSession } from "@/lib/council";
import { enforceAnonymousWebQuota } from "@/lib/web-quota";
import { getAuthenticatedCouncilOwnerEmail, createCouncilAnonymousAccess, attachCouncilSessionCookie } from "@/lib/council-access";
import type { CouncilSeat } from "@/lib/council-types";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // Rate limit
  const quota = await enforceAnonymousWebQuota(req, "web_analyze", [
    { limit: 3, windowSeconds: 10 * 60, label: "10 minutes" },
    { limit: 10, windowSeconds: 24 * 60 * 60, label: "day" },
  ]);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error }, {
      status: 429,
      headers: quota.retryAfterSeconds ? { "Retry-After": String(quota.retryAfterSeconds) } : undefined,
    });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let arxivId: string | undefined;
  let mode: "critique" | "gap" = "critique";
  let rounds = 1;
  let customSeats: CouncilSeat[] = [];
  let uploadedBuffer: Buffer | undefined;
  let uploadTitle: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    arxivId = (form.get("arxivId") as string) || undefined;
    mode = form.get("mode") === "gap" ? "gap" : "critique";
    rounds = form.get("rounds") === "2" ? 2 : 1;
    const customSeatsRaw = form.get("customSeats");
    if (typeof customSeatsRaw === "string") {
      try {
        const parsed = JSON.parse(customSeatsRaw);
        if (Array.isArray(parsed)) {
          customSeats = parsed as CouncilSeat[];
        }
      } catch {
        customSeats = [];
      }
    }
    const file = form.get("file") as File | null;
    if (file) {
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json({ error: "PDF exceeds 20 MB limit" }, { status: 413 });
      }
      uploadedBuffer = Buffer.from(await file.arrayBuffer());
      uploadTitle = file.name.replace(/\.pdf$/i, "");
    }
  } else {
    const body = await req.json();
    arxivId = body.arxivId?.trim() || undefined;
    mode = body.mode === "gap" ? "gap" : "critique";
    rounds = body.rounds === 2 ? 2 : 1;
    if (Array.isArray(body.customSeats)) {
      customSeats = body.customSeats as CouncilSeat[];
    }
  }

  if (!arxivId && !uploadedBuffer) {
    return NextResponse.json({ error: "Provide arxivId or upload a PDF" }, { status: 400 });
  }

  // 1. Ingest paper
  let paperTitle: string;
  let paperText: string;
  let sourceUrl: string;

  try {
    if (uploadedBuffer) {
      const { extractTextFromPdfBuffer: extract } = await import("@/lib/paper-ingest");
      paperText = await extract(uploadedBuffer);
      paperTitle = uploadTitle ?? "Uploaded Paper";
      sourceUrl = "upload";
    } else {
      const result = await fetchArxivPaper(arxivId!);
      paperTitle = result.title;
      paperText = result.text;
      sourceUrl = result.url;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch paper";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!paperText.trim()) {
    return NextResponse.json({ error: "Could not extract text from paper" }, { status: 422 });
  }

  // 2. Ingest into RAG library
  let libraryId: string;
  try {
    const ingested = await ingestPaper({ text: paperText, title: paperTitle, sourceUrl });
    libraryId = ingested.libraryId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to ingest paper";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 3. Build seats with library binding
  const rawSeats: CouncilSeat[] = customSeats.length
    ? customSeats
    : mode === "gap"
      ? buildGapAnalysisSeats("claude-sonnet-4-6")
      : buildAcademicCritiqueSeats("claude-sonnet-4-6");

  const seats: CouncilSeat[] = rawSeats.map((seat) => ({ ...seat, library_id: libraryId }));

  if (!seats.length) {
    return NextResponse.json({ error: "Select at least one review agent" }, { status: 400 });
  }

  // 4. Create council session
  const ownerUserEmail = await getAuthenticatedCouncilOwnerEmail();
  const anonymousAccess = ownerUserEmail ? null : createCouncilAnonymousAccess();

  let sessionId: string;
  try {
    const session = await createCouncilSession({
      title: paperTitle,
      topic: `Academic peer review of: ${paperTitle}`,
      context: `Source: ${sourceUrl}. Library: ${libraryId}`,
      goal: mode === "gap"
        ? "Identify research gaps, missing elements, and opportunities for improvement."
        : "Provide rigorous multi-perspective academic critique.",
      seats,
      rounds,
      ownerUserEmail: ownerUserEmail ?? undefined,
      accessTokenHash: anonymousAccess?.tokenHash,
    });
    sessionId = session.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create session";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const response = NextResponse.json({
    sessionId,
    paperTitle,
    paperAbstract: paperText.slice(0, 600).trim(),
  }, { status: 201 });

  if (anonymousAccess) {
    attachCouncilSessionCookie(response, sessionId, anonymousAccess.plaintextToken);
  }

  return response;
}
