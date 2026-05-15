import { NextRequest, NextResponse } from "next/server";
import { fetchArxivPaper, ingestPaper, extractTextFromPdfBuffer, assertPdfBuffer } from "@/lib/paper-ingest";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { buildAcademicCritiqueSeats, buildGapAnalysisSeats } from "@/lib/core/council-academic";
import { createCouncilSession } from "@/lib/core/council";
import { applyEntitlementResponse, checkEntitlement, quotaDenied } from "@/lib/entitlements";
import { createCouncilAnonymousAccess, attachCouncilSessionCookie } from "@/lib/core/council-access";
import type { CouncilSeat } from "@/lib/core/council-types";
import { DEFAULT_GEMMA_MODEL } from "@/lib/llm/gemma-models";
import { recordUploadedFile } from "@/lib/uploaded-files";
import {
  attachIngestedDocumentToPaperAsset,
  computeBufferChecksum,
  markPaperAssetProcessingFailed,
  markPaperAssetProcessingStarted,
  resolvePaperAsset,
} from "@/lib/paper-assets";
import { resolvePaperTopicSelection } from "@/lib/paper-topics";
import { getPdfLimitsForRequest, PDF_TIER_LIMITS } from "@/lib/pdf-limits";
import { toSafeError } from "@/lib/utils/text";
import { ensureAnonymousVisitorIdentity } from "@/lib/anonymous-access";

export async function POST(req: NextRequest) {
  const account = await resolveAuthAccountContext();
  const anonymousVisitor = account ? null : ensureAnonymousVisitorIdentity(req);
  const quota = await checkEntitlement(req, "web_analyze", anonymousVisitor ?? undefined);
  if (!quota.ok) return quotaDenied(quota.error, quota.retryAfterSeconds, quota.anonymousVisitorIdToSet);

  const pdfLimits = await getPdfLimitsForRequest();

  const contentType = req.headers.get("content-type") ?? "";
  let arxivId: string | undefined;
  let mode: "critique" | "gap" = "critique";
  let rounds = 1;
  let customSeats: CouncilSeat[] = [];
  let uploadedBuffer: Buffer | undefined;
  let uploadTitle: string | undefined;
  let topicPresetId: string | undefined;
  let requestedTopic: string | undefined;
  let requestedGoal: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    arxivId = (form.get("arxivId") as string) || undefined;
    mode = form.get("mode") === "gap" ? "gap" : "critique";
    rounds = form.get("rounds") === "2" ? 2 : 1;
    topicPresetId = (form.get("topicPresetId") as string) || undefined;
    requestedTopic = (form.get("topic") as string) || undefined;
    requestedGoal = (form.get("goal") as string) || undefined;
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
      if (file.size > pdfLimits.maxBytes) {
        const limitMb = pdfLimits.maxBytes / 1024 / 1024;
        const upgradeTip = pdfLimits.tier === "free"
          ? ` Upgrade to Pro for up to ${PDF_TIER_LIMITS.pro.maxBytes / 1024 / 1024} MB.`
          : "";
        return NextResponse.json(
          { error: `PDF exceeds the ${limitMb} MB limit for your plan.${upgradeTip}` },
          { status: 413 },
        );
      }
      uploadedBuffer = Buffer.from(await file.arrayBuffer());
      try {
        assertPdfBuffer(uploadedBuffer);
      } catch (error) {
        return applyEntitlementResponse(
          NextResponse.json(
            { error: error instanceof Error ? error.message : "File does not appear to be a valid PDF" },
            { status: 400 },
          ),
          quota,
        );
      }
      uploadTitle = file.name.replace(/\.pdf$/i, "");
    }
  } else {
    const body = await req.json();
    arxivId = body.arxivId?.trim() || undefined;
    mode = body.mode === "gap" ? "gap" : "critique";
    rounds = body.rounds === 2 ? 2 : 1;
    topicPresetId = typeof body.topicPresetId === "string" ? body.topicPresetId : undefined;
    requestedTopic = typeof body.topic === "string" ? body.topic : undefined;
    requestedGoal = typeof body.goal === "string" ? body.goal : undefined;
    if (Array.isArray(body.customSeats)) {
      // Sanitize each custom seat — strip model to prevent cost abuse, cap systemPrompt to limit prompt injection
      customSeats = (body.customSeats as Record<string, unknown>[]).map((s) => ({
        role:         typeof s.role === "string"         ? s.role.slice(0, 80)           : "",
        model:        DEFAULT_GEMMA_MODEL,
        systemPrompt: typeof s.systemPrompt === "string" ? s.systemPrompt.slice(0, 1000) : "",
        bias:         typeof s.bias === "string"         ? s.bias.slice(0, 200)          : undefined,
        tools:        Array.isArray(s.tools) ? (s.tools as string[]).filter((t) => typeof t === "string") : undefined,
        library_id:   typeof s.library_id === "string"  ? s.library_id                  : undefined,
        team:         typeof s.team === "string"         ? s.team                        : undefined,
      }));
    }
  }

  if (!arxivId && !uploadedBuffer) {
    return NextResponse.json({ error: "Provide arxivId or upload a PDF" }, { status: 400 });
  }

  // 1. Ingest paper
  let paperTitle: string;
  let paperText: string;
  let sourceUrl: string;
  let markerPdfBuffer: Buffer | undefined;
  let sourceKind: "arxiv" | "upload";
  const topicSelection = resolvePaperTopicSelection({
    topicPresetId: topicPresetId ?? "methodology",
    topic: requestedTopic,
    goal: requestedGoal,
  });

  try {
    if (uploadedBuffer) {
      const parsed = await extractTextFromPdfBuffer(uploadedBuffer);
      if (parsed.pageCount > pdfLimits.maxPages) {
        const upgradeTip = pdfLimits.tier === "free"
          ? ` Upgrade to Pro for up to ${PDF_TIER_LIMITS.pro.maxPages} pages.`
          : "";
        return NextResponse.json(
          { error: `PDF has ${parsed.pageCount} pages, exceeding the ${pdfLimits.maxPages}-page limit for your plan.${upgradeTip}` },
          { status: 413 },
        );
      }
      paperText = parsed.text;
      paperTitle = uploadTitle ?? "Uploaded Paper";
      sourceUrl = "upload";
      markerPdfBuffer = uploadedBuffer;
      sourceKind = "upload";
    } else {
      const result = await fetchArxivPaper(arxivId!);
      paperTitle = result.title;
      paperText = result.text;
      sourceUrl = result.url;
      markerPdfBuffer = result.pdfBuffer;
      sourceKind = "arxiv";
    }
  } catch (err) {
    if (err instanceof Error && err.message === "File does not appear to be a valid PDF") {
      return applyEntitlementResponse(NextResponse.json({ error: err.message }, { status: 400 }), quota);
    }
    return applyEntitlementResponse(
      NextResponse.json({ error: toSafeError(err, 'paper upload fetch') }, { status: 502 }),
      quota,
    );
  }

  if (!paperText.trim()) {
    return NextResponse.json({ error: "Could not extract text from paper" }, { status: 422 });
  }

  const paperAbstract = paperText.slice(0, 600).trim();
  const checksumSha256 = computeBufferChecksum(markerPdfBuffer);
  const paperAssetResolution = await resolvePaperAsset({
    workspaceId: account?.workspaceId,
    ownerUserEmail: account?.email ?? undefined,
    anonymousIdHash: anonymousVisitor?.idHash,
    title: paperTitle,
    abstract: paperAbstract,
    arxivId: arxivId ?? null,
    sourceKind,
    sourceLocator: sourceKind === "arxiv" ? arxivId ?? null : sourceUrl,
    checksumSha256,
  });

  // 2. Ingest into RAG library when the asset has no primary library yet
  let libraryId: string;
  let documentId: string | undefined;
  let cacheStatus: "ready" | "processing";
  try {
    if (paperAssetResolution.asset.primary_library_id && paperAssetResolution.asset.document_id) {
      libraryId = paperAssetResolution.asset.primary_library_id;
      documentId = paperAssetResolution.asset.document_id;
      cacheStatus = "ready";
    } else {
      await markPaperAssetProcessingStarted(paperAssetResolution.asset.id);
      const ingested = await ingestPaper({
        text: paperText,
        title: paperTitle,
        sourceUrl,
        sourceType: uploadedBuffer ? "local_doc" : "academic",
        pdfBuffer: markerPdfBuffer,
      });
      const asset = await attachIngestedDocumentToPaperAsset({
        paperAssetId: paperAssetResolution.asset.id,
        ingestResult: ingested,
        title: paperTitle,
        abstract: paperAbstract,
        arxivId: arxivId ?? null,
        checksumSha256,
      });
      libraryId = asset.primary_library_id || ingested.libraryId;
      documentId = asset.document_id || ingested.documentId;
      cacheStatus = "processing";
    }
  } catch (err) {
    await markPaperAssetProcessingFailed(paperAssetResolution.asset.id, err).catch(() => {});
    if (err instanceof Error && err.message === "File does not appear to be a valid PDF") {
      return applyEntitlementResponse(NextResponse.json({ error: err.message }, { status: 400 }), quota);
    }
    return applyEntitlementResponse(
      NextResponse.json({ error: toSafeError(err, 'paper upload ingest') }, { status: 500 }),
      quota,
    );
  }

  if (uploadedBuffer && uploadTitle && documentId) {
    void recordUploadedFile({
      workspaceId: account?.workspaceId,
      createdByUserId: account?.userId,
      filename: `${uploadTitle}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: uploadedBuffer.byteLength,
      buffer: uploadedBuffer,
      sourceRoute: "/api/papers/upload",
      documentId,
      libraryId,
    }).catch(() => {});
  }

  // 3. Build seats with library binding
  const rawSeats: CouncilSeat[] = customSeats.length
    ? customSeats
    : mode === "gap"
      ? buildGapAnalysisSeats(DEFAULT_GEMMA_MODEL)
      : buildAcademicCritiqueSeats(DEFAULT_GEMMA_MODEL);

  const seats: CouncilSeat[] = rawSeats.map((seat) => ({ ...seat, library_id: libraryId }));

  if (!seats.length) {
    return NextResponse.json({ error: "Select at least one review agent" }, { status: 400 });
  }

  // 4. Create council session
  const anonymousAccess = account ? null : createCouncilAnonymousAccess();

  let sessionId: string;
  try {
    const session = await createCouncilSession({
      title: paperTitle,
      topic: topicSelection.topic,
      context: `Source: ${sourceUrl}. Library: ${libraryId}`,
      goal: topicSelection.goal || (mode === "gap"
        ? "Identify research gaps, missing elements, and opportunities for improvement."
        : "Provide rigorous multi-perspective academic critique."),
      paperAssetId: paperAssetResolution.asset.id,
      seats,
      rounds,
      workspaceId: account?.workspaceId,
      createdByUserId: account?.userId,
      ownerUserEmail: account?.email ?? undefined,
      accessTokenHash: anonymousAccess?.tokenHash,
    });
    sessionId = session.id;
  } catch (err) {
    return NextResponse.json({ error: toSafeError(err, 'paper upload session') }, { status: 500 });
  }

  const response = NextResponse.json({
    sessionId,
    paperTitle,
    paperAbstract,
    paperAssetId: paperAssetResolution.asset.id,
    cacheStatus,
    reusedAsset: paperAssetResolution.reusedAsset,
  }, { status: 201 });

  if (anonymousAccess) {
    attachCouncilSessionCookie(response, sessionId, anonymousAccess.plaintextToken);
  }

  return applyEntitlementResponse(response, quota);
}
