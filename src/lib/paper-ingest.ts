/**
 * paper-ingest.ts — Fetch and ingest academic papers into the RAG document store.
 * Supports: arXiv ID, DOI (via Unpaywall), direct PDF URL, raw text paste.
 */

import { db } from "./db";
import { nanoid } from "nanoid";

export interface IngestResult {
  documentId: string;
  libraryId: string;
  title: string;
  wordCount: number;
  source: string;
}


/** Fetch plain text from an arXiv paper by ID (e.g. "2301.07041") */
export async function fetchArxivPaper(arxivId: string): Promise<{ title: string; text: string; url: string }> {
  const cleanId = arxivId.replace(/^arxiv:/i, "").trim();
  // Fetch abstract page for metadata
  const abstractUrl = `https://arxiv.org/abs/${cleanId}`;
  const pdfUrl = `https://arxiv.org/pdf/${cleanId}`;

  // Try to get title from abstract page
  let title = `arXiv:${cleanId}`;
  try {
    const res = await fetch(abstractUrl, { headers: { "User-Agent": "Council-Academic/1.0" } });
    const html = await res.text();
    const titleMatch = html.match(/<h1 class="title mathjax"[^>]*>\s*<span[^>]*>Title:<\/span>\s*([\s\S]*?)<\/h1>/);
    if (titleMatch) title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
  } catch { /* fallback to ID */ }

  // Fetch PDF and extract text
  const pdfRes = await fetch(pdfUrl, { headers: { "User-Agent": "Council-Academic/1.0" } });
  if (!pdfRes.ok) throw new Error(`Failed to fetch arXiv PDF: ${pdfRes.status}`);
  const buffer = await pdfRes.arrayBuffer();
  const text = await extractTextFromPdfBuffer(Buffer.from(buffer));

  return { title, text, url: pdfUrl };
}

/** Extract text from a PDF buffer using pdf-parse */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid SSR issues
  // @ts-ignore — pdf-parse types are incomplete
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text as string;
}

/** Ingest a paper into the document store and return libraryId for Council */
export async function ingestPaper(params: {
  text: string;
  title: string;
  sourceUrl: string;
  libraryId?: string;
}): Promise<IngestResult> {
  const libraryId = params.libraryId ?? `paper:${nanoid(10)}`;
  const tag = `council:lib:${libraryId}`;

  await ensureDocumentSchema();

  const insertRes = await db.query(
    `INSERT INTO documents (title, content, tags, source_url, done)
     VALUES ($1, $2, $3::jsonb, $4, false)
     RETURNING id::text`,
    [
      params.title,
      params.text.replace(/\0/g, "").slice(0, 200_000), // strip null bytes, cap at 200k chars
      JSON.stringify([tag]),
      params.sourceUrl,
    ]
  );
  const insertedId: string = (insertRes.rows[0] as Record<string, string>).id;

  // Trigger embedding (non-blocking)
  triggerEmbedding(insertedId).catch(() => {});

  return {
    documentId: insertedId,
    libraryId,
    title: params.title,
    wordCount: params.text.split(/\s+/).length,
    source: params.sourceUrl,
  };
}

async function ensureDocumentSchema() {
  // The documents/document_chunks tables are managed by the platform schema.
  // We only ensure the GIN index exists for tag-based filtering.
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin(tags);
  `);
}

async function triggerEmbedding(documentId: string) {
  // Import rag handlers lazily to avoid circular deps
  const { handlers } = await import("./tools/handlers/rag");
  await handlers.embed_documents("system", { limit: 5 }, 0);
}
