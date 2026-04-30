/**
 * paper-ingest.ts — Fetch and ingest academic papers into the RAG document store.
 * Supports: arXiv ID, DOI (via Unpaywall), direct PDF URL, raw text paste.
 */

import { db } from "./db/db";
import { nanoid } from "nanoid";
import { createHash } from "crypto";

export interface IngestResult {
  documentId: string;
  libraryId: string;
  title: string;
  wordCount: number;
  source: string;
  reusedDocument: boolean;
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
  const content = sanitizePaperContent(params.text);
  const contentHash = hashPaperContent(content);

  await ensureDocumentSchema();

  const existing = await findExistingDocument(params.sourceUrl, contentHash, content);
  if (existing) {
    const libraryId = params.libraryId ?? existing.libraryId ?? `paper:${nanoid(10)}`;
    const tag = `council:lib:${libraryId}`;
    await addDocumentTag(existing.documentId, tag);
    if (!existing.isReady) {
      await embedDocument(existing.documentId);
    }

    return {
      documentId: existing.documentId,
      libraryId,
      title: existing.title || params.title,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      source: params.sourceUrl,
      reusedDocument: true,
    };
  }

  const libraryId = params.libraryId ?? `paper:${nanoid(10)}`;
  const tag = `council:lib:${libraryId}`;

  const insertRes = await db.query(
    `INSERT INTO documents (title, content, tags, source_url, content_hash, done)
     VALUES ($1, $2, $3::jsonb, $4, $5, false)
     RETURNING id::text`,
    [
      params.title,
      content,
      JSON.stringify([tag]),
      params.sourceUrl,
      contentHash,
    ]
  );
  const insertedId: string = (insertRes.rows[0] as Record<string, string>).id;

  await embedDocument(insertedId);

  return {
    documentId: insertedId,
    libraryId,
    title: params.title,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    source: params.sourceUrl,
    reusedDocument: false,
  };
}

async function ensureDocumentSchema() {
  // The documents/document_chunks tables are managed by the platform schema.
  // We only ensure the indexes/metadata needed by the paper ingest path.
  await db.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;`);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin(tags);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_documents_source_content_hash
    ON documents (source_url, content_hash)
    WHERE content_hash IS NOT NULL;
  `);
}

async function embedDocument(documentId: string) {
  const { embedDocumentById } = await import("@/lib/tools/handlers/rag");
  await embedDocumentById(documentId);
}

function sanitizePaperContent(text: string): string {
  return text.replace(/\0/g, "").slice(0, 200_000);
}

function hashPaperContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function extractLibraryIdFromTags(tags: unknown): string | null {
  const parsedTags = Array.isArray(tags)
    ? tags
    : typeof tags === "string"
      ? (() => {
          try {
            return JSON.parse(tags) as unknown;
          } catch {
            return [];
          }
        })()
      : [];

  if (!Array.isArray(parsedTags)) return null;

  for (const tag of parsedTags) {
    if (typeof tag !== "string") continue;
    const match = tag.match(/^council:lib:(.+)$/);
    if (match?.[1]) return match[1];
  }

  return null;
}

async function findExistingDocument(sourceUrl: string, contentHash: string, content: string): Promise<{
  documentId: string;
  title: string;
  libraryId: string | null;
  isReady: boolean;
} | null> {
  const { rows } = await db.query(
    `SELECT d.id::text,
            d.title,
            d.tags,
            d.content_hash,
            COALESCE(d.done, false) AS done,
            EXISTS (
              SELECT 1 FROM document_chunks c WHERE c.document_id = d.id
            ) AS has_chunks
     FROM documents d
     WHERE d.source_url = $1
       AND (
         d.content_hash = $2
         OR (d.content_hash IS NULL AND d.content = $3)
       )
     ORDER BY created_at ASC NULLS LAST
     LIMIT 1`,
    [sourceUrl, contentHash, content],
  );

  if (!rows.length) return null;

  const row = rows[0] as {
    id: string;
    title: string | null;
    tags: unknown;
    content_hash: string | null;
    done: boolean;
    has_chunks: boolean;
  };
  if (!row.content_hash) {
    await db.query(
      `UPDATE documents
       SET content_hash = $2
       WHERE id = $1 AND content_hash IS NULL`,
      [row.id, contentHash],
    );
  }

  return {
    documentId: row.id,
    title: row.title ?? "",
    libraryId: extractLibraryIdFromTags(row.tags),
    isReady: Boolean(row.done && row.has_chunks),
  };
}

async function addDocumentTag(documentId: string, tag: string): Promise<void> {
  await db.query(
    `UPDATE documents
     SET tags = CASE
       WHEN COALESCE(tags, '[]'::jsonb) ? $2 THEN COALESCE(tags, '[]'::jsonb)
       ELSE COALESCE(tags, '[]'::jsonb) || to_jsonb($2::text)
     END
     WHERE id = $1`,
    [documentId, tag],
  );
}
