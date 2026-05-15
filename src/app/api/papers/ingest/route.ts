import { NextRequest, NextResponse } from "next/server";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { fetchArxivPaper, ingestPaper, extractTextFromPdfBuffer } from "@/lib/paper-ingest";
import { recordUploadedFile } from "@/lib/uploaded-files";
import { checkEntitlement, quotaDenied } from "@/lib/entitlements";
import { isAllowedExternalUrl } from "@/lib/utils/url-safety";
import { getPdfLimitsForRequest, PDF_TIER_LIMITS } from "@/lib/pdf-limits";

export async function POST(req: NextRequest) {
  try {
    const quota = await checkEntitlement(req, "paper_ingest");
    if (!quota.ok) return quotaDenied(quota.error, quota.retryAfterSeconds);

    const pdfLimits = await getPdfLimitsForRequest();
    const contentType = req.headers.get("content-type") ?? "";

    // Support both JSON and multipart/form-data (PDF upload)
    let arxivId: string | undefined;
    let pdfUrl: string | undefined;
    let text: string | undefined;
    let title: string | undefined;
    let libraryId: string | undefined;
    let uploadedPdfBuffer: Buffer | undefined;
    let uploadedFilename: string | undefined;
    let uploadedMimeType: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      arxivId = form.get("arxivId") as string | undefined ?? undefined;
      pdfUrl = form.get("pdfUrl") as string | undefined ?? undefined;
      text = form.get("text") as string | undefined ?? undefined;
      title = form.get("title") as string | undefined ?? undefined;
      libraryId = form.get("libraryId") as string | undefined ?? undefined;
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
        uploadedPdfBuffer = Buffer.from(await file.arrayBuffer());
        uploadedFilename = file.name;
        uploadedMimeType = file.type || "application/pdf";
        if (!title) title = file.name.replace(/\.pdf$/i, "");
      }
    } else {
      const body = await req.json();
      ({ arxivId, pdfUrl, text, title, libraryId } = body);
    }

    let paperTitle = title ?? "Untitled Paper";
    let paperText = "";
    let sourceUrl = "";
    let sourceType: "local_doc" | "academic" | "web" = "local_doc";
    let markerPdfBuffer: Buffer | undefined;

    if (uploadedPdfBuffer) {
      const parsed = await extractTextFromPdfBuffer(uploadedPdfBuffer);
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
      sourceUrl = "upload";
      sourceType = "local_doc";
      markerPdfBuffer = uploadedPdfBuffer;
    } else if (arxivId) {
      const result = await fetchArxivPaper(arxivId);
      paperTitle = result.title;
      paperText = result.text;
      sourceUrl = result.url;
      sourceType = "academic";
      markerPdfBuffer = result.pdfBuffer;
    } else if (pdfUrl) {
      if (!isAllowedExternalUrl(pdfUrl)) {
        return NextResponse.json({ error: "Invalid or disallowed URL" }, { status: 400 });
      }
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength > pdfLimits.maxBytes) {
        const limitMb = pdfLimits.maxBytes / 1024 / 1024;
        return NextResponse.json(
          { error: `Remote PDF exceeds the ${limitMb} MB limit for your plan.` },
          { status: 413 },
        );
      }
      const parsed = await extractTextFromPdfBuffer(buffer);
      if (parsed.pageCount > pdfLimits.maxPages) {
        return NextResponse.json(
          { error: `PDF has ${parsed.pageCount} pages, exceeding the ${pdfLimits.maxPages}-page limit for your plan.` },
          { status: 413 },
        );
      }
      paperText = parsed.text;
      sourceUrl = pdfUrl;
      sourceType = "web";
      markerPdfBuffer = buffer;
    } else if (text) {
      paperText = text;
      sourceUrl = "manual";
      sourceType = "local_doc";
    } else {
      return NextResponse.json({ error: "provide arxivId, pdfUrl, or text" }, { status: 400 });
    }

    if (!paperText.trim()) throw new Error("Could not extract text from paper");

    const result = await ingestPaper({
      text: paperText,
      title: paperTitle,
      sourceUrl,
      libraryId,
      sourceType,
      pdfBuffer: markerPdfBuffer,
    });
    if (uploadedPdfBuffer && uploadedFilename) {
      const account = await resolveAuthAccountContext();
      void recordUploadedFile({
        workspaceId: account?.workspaceId,
        createdByUserId: account?.userId,
        filename: uploadedFilename,
        mimeType: uploadedMimeType,
        sizeBytes: uploadedPdfBuffer.byteLength,
        buffer: uploadedPdfBuffer,
        sourceRoute: "/api/papers/ingest",
        documentId: result.documentId,
        libraryId: result.libraryId,
      }).catch(() => {});
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
