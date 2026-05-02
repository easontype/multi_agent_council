import { NextRequest, NextResponse } from "next/server";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { fetchArxivPaper, ingestPaper, extractTextFromPdfBuffer } from "@/lib/paper-ingest";
import { recordUploadedFile } from "@/lib/uploaded-files";
import { enforceAnonymousWebQuota } from "@/lib/web-quota";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const quota = await enforceAnonymousWebQuota(req, "paper_ingest", [
      { limit: 6, windowSeconds: 10 * 60, label: "10 minutes" },
      { limit: 15, windowSeconds: 24 * 60 * 60, label: "day" },
    ]);
    if (!quota.ok) {
      return NextResponse.json(
        { error: quota.error },
        {
          status: 429,
          headers: quota.retryAfterSeconds
            ? { "Retry-After": String(quota.retryAfterSeconds) }
            : undefined,
        },
      );
    }

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
        if (file.size > MAX_UPLOAD_BYTES) {
          return NextResponse.json(
            { error: "PDF upload exceeds the 20 MB limit" },
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
      paperText = await extractTextFromPdfBuffer(uploadedPdfBuffer);
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
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      paperText = await extractTextFromPdfBuffer(buffer);
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
