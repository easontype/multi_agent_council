import { NextRequest, NextResponse } from "next/server";
import { fetchArxivPaper, ingestPaper, extractTextFromPdfBuffer } from "@/lib/paper-ingest";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    // Support both JSON and multipart/form-data (PDF upload)
    let arxivId: string | undefined;
    let pdfUrl: string | undefined;
    let text: string | undefined;
    let title: string | undefined;
    let libraryId: string | undefined;
    let uploadedPdfBuffer: Buffer | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      arxivId = form.get("arxivId") as string | undefined ?? undefined;
      pdfUrl = form.get("pdfUrl") as string | undefined ?? undefined;
      text = form.get("text") as string | undefined ?? undefined;
      title = form.get("title") as string | undefined ?? undefined;
      libraryId = form.get("libraryId") as string | undefined ?? undefined;
      const file = form.get("file") as File | null;
      if (file) {
        uploadedPdfBuffer = Buffer.from(await file.arrayBuffer());
        if (!title) title = file.name.replace(/\.pdf$/i, "");
      }
    } else {
      const body = await req.json();
      ({ arxivId, pdfUrl, text, title, libraryId } = body);
    }

    let paperTitle = title ?? "Untitled Paper";
    let paperText = "";
    let sourceUrl = "";

    if (uploadedPdfBuffer) {
      paperText = await extractTextFromPdfBuffer(uploadedPdfBuffer);
      sourceUrl = "upload";
    } else if (arxivId) {
      const result = await fetchArxivPaper(arxivId);
      paperTitle = result.title;
      paperText = result.text;
      sourceUrl = result.url;
    } else if (pdfUrl) {
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      paperText = await extractTextFromPdfBuffer(buffer);
      sourceUrl = pdfUrl;
    } else if (text) {
      paperText = text;
      sourceUrl = "manual";
    } else {
      return NextResponse.json({ error: "provide arxivId, pdfUrl, or text" }, { status: 400 });
    }

    if (!paperText.trim()) throw new Error("Could not extract text from paper");

    const result = await ingestPaper({ text: paperText, title: paperTitle, sourceUrl, libraryId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
