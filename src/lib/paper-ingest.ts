/**
 * paper-ingest.ts — Fetch and ingest academic papers into the RAG document store.
 * Supports: arXiv ID, DOI (via Unpaywall), direct PDF URL, raw text paste.
 */

import { db } from "./db/db";
import { nanoid } from "nanoid";
import { createHash } from "crypto";

export type IngestSourceType = "local_doc" | "academic" | "web";

export interface IngestResult {
  documentId: string;
  libraryId: string;
  title: string;
  wordCount: number;
  source: string;
  reusedDocument: boolean;
}

export interface FetchArxivPaperResult {
  title: string;
  text: string;
  url: string;
  pdfBuffer: Buffer;
}

interface MarkerSection {
  heading: string;
  level: number;
  startChar: number;
  endChar: number;
}

interface ChunkMarkerUpdate {
  chunkIndex: number;
  sectionHeading: string | null;
  charOffset: number | null;
}

const MARKER_API_BASE = "https://www.datalab.to/api/v1/marker";
const MARKER_POLL_MAX_ATTEMPTS = 20;
const MARKER_POLL_INTERVAL_MS = 1500;
const CHUNK_MATCH_PREFIX = 160;

/** Fetch plain text from an arXiv paper by ID (e.g. "2301.07041") */
export async function fetchArxivPaper(arxivId: string): Promise<FetchArxivPaperResult> {
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
  const pdfBuffer = Buffer.from(buffer);
  const text = await extractTextFromPdfBuffer(pdfBuffer);

  return { title, text, url: pdfUrl, pdfBuffer };
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
  sourceType?: IngestSourceType;
  pdfBuffer?: Buffer;
}): Promise<IngestResult> {
  const content = sanitizePaperContent(params.text);
  const contentHash = hashPaperContent(content);
  const sourceType = params.sourceType ?? inferSourceType(params.sourceUrl);

  await ensureDocumentSchema();

  const existing = await findExistingDocument(params.sourceUrl, contentHash, content);
  if (existing) {
    const libraryId = params.libraryId ?? existing.libraryId ?? `paper:${nanoid(10)}`;
    const tag = `council:lib:${libraryId}`;
    await addDocumentTag(existing.documentId, tag);
    if (!existing.isReady) {
      await embedDocument(existing.documentId);
    }
    if (!existing.markerProcessed) {
      void enrichDocumentWithMarker(existing.documentId, params.pdfBuffer).catch(() => {});
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
    `INSERT INTO documents (title, content, tags, source_url, content_hash, source_type, done)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, false)
     RETURNING id::text`,
    [
      params.title,
      content,
      JSON.stringify([tag]),
      params.sourceUrl,
      contentHash,
      sourceType,
    ]
  );
  const insertedId: string = (insertRes.rows[0] as Record<string, string>).id;

  await embedDocument(insertedId);
  void enrichDocumentWithMarker(insertedId, params.pdfBuffer).catch(() => {});

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

function inferSourceType(sourceUrl: string): IngestSourceType {
  if (sourceUrl === "upload" || sourceUrl === "manual" || sourceUrl === "text://inline") {
    return "local_doc";
  }
  if (/arxiv\.org/i.test(sourceUrl)) {
    return "academic";
  }
  return /^https?:\/\//i.test(sourceUrl) ? "web" : "local_doc";
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
  markerProcessed: boolean;
} | null> {
  const { rows } = await db.query(
    `SELECT d.id::text,
            d.title,
            d.tags,
            d.content_hash,
            COALESCE(d.marker_processed, false) AS marker_processed,
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
    marker_processed: boolean;
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
    markerProcessed: Boolean(row.marker_processed),
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

async function enrichDocumentWithMarker(documentId: string, pdfBuffer?: Buffer): Promise<void> {
  if (!pdfBuffer?.byteLength || !process.env.MARKER_API_KEY) return;

  const markdown = await requestMarkerMarkdown(pdfBuffer);
  if (!markdown.trim()) return;

  const chunkRows = await fetchDocumentChunks(documentId);
  const sections = extractMarkdownSections(markdown);
  const chunkUpdates = mapChunksToMarkdown(markdown, chunkRows, sections);
  const markdownWithAnchors = injectChunkAnchors(markdown, chunkUpdates);

  await persistMarkerEnrichment(documentId, markdownWithAnchors, chunkUpdates);
}

async function requestMarkerMarkdown(pdfBuffer: Buffer): Promise<string> {
  const formData = new FormData();
  const pdfBytes = new Uint8Array(pdfBuffer);
  formData.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "document.pdf");
  formData.append("output_format", "markdown");

  const startRes = await fetch(MARKER_API_BASE, {
    method: "POST",
    headers: { "X-API-Key": process.env.MARKER_API_KEY! },
    body: formData,
  });
  if (!startRes.ok) {
    throw new Error(`marker start failed: ${startRes.status}`);
  }

  const startJson = await startRes.json() as { request_id?: string };
  const requestId = startJson.request_id?.trim();
  if (!requestId) {
    throw new Error("marker request_id missing");
  }

  for (let attempt = 0; attempt < MARKER_POLL_MAX_ATTEMPTS; attempt += 1) {
    await sleep(MARKER_POLL_INTERVAL_MS);

    const pollRes = await fetch(`${MARKER_API_BASE}/${requestId}`, {
      headers: { "X-API-Key": process.env.MARKER_API_KEY! },
    });
    if (!pollRes.ok) {
      throw new Error(`marker poll failed: ${pollRes.status}`);
    }

    const pollJson = await pollRes.json() as {
      status?: string;
      markdown?: string;
      error?: string;
    };

    if (pollJson.status === "complete") {
      return typeof pollJson.markdown === "string" ? pollJson.markdown : "";
    }

    if (pollJson.status === "failed") {
      throw new Error(pollJson.error || "marker processing failed");
    }
  }

  throw new Error("marker polling timed out");
}

async function fetchDocumentChunks(documentId: string): Promise<Array<{ chunk_index: number; content: string }>> {
  const { rows } = await db.query(
    `SELECT chunk_index, content
     FROM document_chunks
     WHERE document_id = $1
     ORDER BY chunk_index ASC`,
    [documentId],
  );

  return (rows as Array<{ chunk_index: number; content: string }>).map((row) => ({
    chunk_index: Number(row.chunk_index),
    content: String(row.content ?? ""),
  }));
}

function extractMarkdownSections(markdown: string): MarkerSection[] {
  const matches = [...markdown.matchAll(/^(#{1,6})\s+(.+)$/gm)];
  return matches.map((match, index) => {
    const startChar = match.index ?? 0;
    const nextStart = matches[index + 1]?.index ?? markdown.length;
    return {
      heading: match[2]?.trim() ?? "",
      level: match[1]?.length ?? 1,
      startChar,
      endChar: nextStart,
    };
  });
}

function mapChunksToMarkdown(
  markdown: string,
  chunks: Array<{ chunk_index: number; content: string }>,
  sections: MarkerSection[],
): ChunkMarkerUpdate[] {
  return chunks.map((chunk) => {
    const charOffset = findChunkOffset(markdown, chunk.content);
    const sectionHeading = charOffset == null
      ? null
      : [...sections].reverse().find((section) => charOffset >= section.startChar && charOffset < section.endChar)?.heading ?? null;

    return {
      chunkIndex: chunk.chunk_index,
      sectionHeading,
      charOffset,
    };
  });
}

function findChunkOffset(markdown: string, chunkContent: string): number | null {
  const trimmed = chunkContent.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  const prefix = trimmed.slice(0, CHUNK_MATCH_PREFIX).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!prefix) return null;

  const whitespaceTolerant = prefix.replace(/\s+/g, "\\s+");
  const regex = new RegExp(whitespaceTolerant, "i");
  const match = regex.exec(markdown);
  return match?.index ?? null;
}

function injectChunkAnchors(markdown: string, chunkUpdates: ChunkMarkerUpdate[]): string {
  const inserts = chunkUpdates
    .filter((item) => item.charOffset != null)
    .sort((a, b) => (b.charOffset ?? 0) - (a.charOffset ?? 0));

  let output = markdown;
  for (const item of inserts) {
    const offset = item.charOffset ?? 0;
    output = `${output.slice(0, offset)}\n<span id="chunk-${item.chunkIndex}"></span>\n${output.slice(offset)}`;
  }
  return output;
}

async function persistMarkerEnrichment(
  documentId: string,
  markdown: string,
  chunkUpdates: ChunkMarkerUpdate[],
): Promise<void> {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE documents
       SET markdown_content = $2,
           marker_processed = true
       WHERE id = $1`,
      [documentId, markdown],
    );

    for (const item of chunkUpdates) {
      await client.query(
        `UPDATE document_chunks
         SET section_heading = $3,
             char_offset = $4
         WHERE document_id = $1
           AND chunk_index = $2`,
        [documentId, item.chunkIndex, item.sectionHeading, item.charOffset],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
