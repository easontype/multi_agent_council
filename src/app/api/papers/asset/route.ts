import { NextRequest, NextResponse } from "next/server";
import { fetchArxivPaper, ingestPaper, extractTextFromPdfBuffer } from "@/lib/paper-ingest";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { checkEntitlement, quotaDenied } from "@/lib/entitlements";
import { recordUploadedFile } from "@/lib/uploaded-files";
import {
  attachIngestedDocumentToPaperAsset,
  computeBufferChecksum,
  markPaperAssetProcessingFailed,
  markPaperAssetProcessingStarted,
  resolvePaperAsset,
} from "@/lib/paper-assets";
import { getPdfLimitsForRequest, PDF_TIER_LIMITS } from "@/lib/pdf-limits";

/**
 * POST /api/papers/asset
 *
 * Ingests a paper and creates (or reuses) a PaperAsset.
 * Embedding runs in the background — does NOT create a council session.
 * Used by the /home new-analysis flow before mode selection.
 *
 * Input (multipart/form-data or JSON):
 *   arxivId?: string
 *   file?:    File (PDF, max 20 MB)
 *
 * Output:
 *   { paperAssetId, title, abstract, cacheStatus, reusedAsset }
 */
export async function POST(req: NextRequest) {
  const quota = await checkEntitlement(req, "web_analyze");
  if (!quota.ok) return quotaDenied(quota.error, quota.retryAfterSeconds);

  const pdfLimits = await getPdfLimitsForRequest();

  const contentType = req.headers.get("content-type") ?? "";
  let arxivId: string | undefined;
  let uploadedBuffer: Buffer | undefined;
  let uploadTitle: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    arxivId = (form.get("arxivId") as string) || undefined;
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
      uploadTitle = file.name.replace(/\.pdf$/i, "");
    }
  } else {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    arxivId = typeof body.arxivId === "string" ? body.arxivId.trim() : undefined;
  }

  if (!arxivId && !uploadedBuffer) {
    return NextResponse.json({ error: "Provide arxivId or upload a PDF" }, { status: 400 });
  }

  // 1. Fetch paper content
  let paperTitle: string;
  let paperText: string;
  let sourceUrl: string;
  let markerPdfBuffer: Buffer | undefined;
  let sourceKind: "arxiv" | "upload";

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
    const msg = err instanceof Error ? err.message : "Failed to fetch paper";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!paperText.trim()) {
    return NextResponse.json({ error: "Could not extract text from paper" }, { status: 422 });
  }

  const paperAbstract = paperText.slice(0, 600).trim();
  const account = await resolveAuthAccountContext();
  const checksumSha256 = computeBufferChecksum(markerPdfBuffer);

  // 2. Resolve or create paper asset (deduplication)
  const paperAssetResolution = await resolvePaperAsset({
    workspaceId: account?.workspaceId,
    title: paperTitle,
    abstract: paperAbstract,
    arxivId: arxivId ?? null,
    sourceKind,
    sourceLocator: sourceKind === "arxiv" ? arxivId ?? null : sourceUrl,
    checksumSha256,
  });

  // 3. Ingest into RAG (background embed) if not already done
  let cacheStatus: "ready" | "processing";

  if (paperAssetResolution.asset.primary_library_id && paperAssetResolution.asset.document_id) {
    cacheStatus = "ready";
  } else {
    try {
      await markPaperAssetProcessingStarted(paperAssetResolution.asset.id);
      const ingested = await ingestPaper({
        text: paperText,
        title: paperTitle,
        sourceUrl,
        sourceType: uploadedBuffer ? "local_doc" : "academic",
        pdfBuffer: markerPdfBuffer,
      });
      await attachIngestedDocumentToPaperAsset({
        paperAssetId: paperAssetResolution.asset.id,
        ingestResult: ingested,
        title: paperTitle,
        abstract: paperAbstract,
        arxivId: arxivId ?? null,
        checksumSha256,
      });
      cacheStatus = "processing";

      if (uploadedBuffer && uploadTitle) {
        void recordUploadedFile({
          workspaceId: account?.workspaceId,
          createdByUserId: account?.userId,
          filename: `${uploadTitle}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: uploadedBuffer.byteLength,
          buffer: uploadedBuffer,
          sourceRoute: "/api/papers/asset",
          documentId: ingested.documentId,
          libraryId: ingested.libraryId,
        }).catch(() => {});
      }
    } catch (err) {
      await markPaperAssetProcessingFailed(paperAssetResolution.asset.id, err).catch(() => {});
      const msg = err instanceof Error ? err.message : "Failed to ingest paper";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({
    paperAssetId: paperAssetResolution.asset.id,
    title: paperTitle,
    abstract: paperAbstract,
    cacheStatus,
    reusedAsset: paperAssetResolution.reusedAsset,
  }, { status: 201 });
}
