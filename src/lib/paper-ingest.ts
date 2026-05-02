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

interface MarkerAttemptState {
  markerProcessed: boolean;
  markerAttempts: number;
  markerLastAttemptAt: string | null;
  markerLastError: string | null;
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
const MARKER_RETRY_MAX_ATTEMPTS = 3;
const MARKER_RETRY_BASE_MS = 1200;
const MARKER_RETRY_MAX_DELAY_MS = 8000;
const MARKER_RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MARKER_RETRYABLE_ERRORS = /(rate limit|timed out|timeout|temporar|unavailable|network|fetch failed|429|500|502|503|504)/i;
const MARKER_REATTEMPT_COOLDOWN_MS = 30 * 60 * 1000;
const CHUNK_MATCH_PREFIX_LENGTHS = [160, 80, 40] as const;
// Max chars to look back from a match offset when snapping anchor to paragraph boundary
const ANCHOR_SNAP_WINDOW = 400;

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
    queueMarkerEnrichment(existing.documentId, params.pdfBuffer, existing);

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
  queueMarkerEnrichment(insertedId, params.pdfBuffer, {
    markerProcessed: false,
    markerAttempts: 0,
    markerLastAttemptAt: null,
    markerLastError: null,
  });

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
  await db.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS marker_attempts INTEGER NOT NULL DEFAULT 0;`);
  await db.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS marker_last_error TEXT;`);
  await db.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS marker_last_attempt_at TIMESTAMPTZ;`);
  await db.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS marker_completed_at TIMESTAMPTZ;`);
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
  markerAttempts: number;
  markerLastAttemptAt: string | null;
  markerLastError: string | null;
} | null> {
  const { rows } = await db.query(
    `SELECT d.id::text,
            d.title,
            d.tags,
            d.content_hash,
            COALESCE(d.marker_processed, false) AS marker_processed,
            COALESCE(d.marker_attempts, 0) AS marker_attempts,
            d.marker_last_attempt_at,
            d.marker_last_error,
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
    marker_attempts: number;
    marker_last_attempt_at: string | null;
    marker_last_error: string | null;
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
    markerAttempts: Number(row.marker_attempts ?? 0),
    markerLastAttemptAt: row.marker_last_attempt_at ?? null,
    markerLastError: row.marker_last_error ?? null,
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

function queueMarkerEnrichment(
  documentId: string,
  pdfBuffer: Buffer | undefined,
  state: MarkerAttemptState,
): void {
  if (!shouldAttemptMarkerEnrichment(pdfBuffer, state)) return;
  void enrichDocumentWithMarker(documentId, pdfBuffer).catch((error) => {
    void recordMarkerFailure(documentId, error);
  });
}

function shouldAttemptMarkerEnrichment(
  pdfBuffer: Buffer | undefined,
  state: MarkerAttemptState,
  now = Date.now(),
): boolean {
  if (!pdfBuffer?.byteLength || !process.env.MARKER_API_KEY) return false;
  if (state.markerProcessed) return false;
  if (!state.markerLastAttemptAt) return true;
  const lastAttemptAt = new Date(state.markerLastAttemptAt).getTime();
  if (!Number.isFinite(lastAttemptAt)) return true;
  return now - lastAttemptAt >= MARKER_REATTEMPT_COOLDOWN_MS;
}

async function enrichDocumentWithMarker(documentId: string, pdfBuffer?: Buffer): Promise<void> {
  if (!pdfBuffer?.byteLength || !process.env.MARKER_API_KEY) return;

  await recordMarkerAttemptStart(documentId);
  const markdown = await requestMarkerMarkdown(pdfBuffer);
  if (!markdown.trim()) return;

  const chunkRows = await fetchDocumentChunks(documentId);
  const sections = extractMarkdownSections(markdown);
  const chunkUpdates = mapChunksToMarkdown(markdown, chunkRows, sections);

  const matchedCount = chunkUpdates.filter((u) => u.charOffset != null).length;
  const total = chunkUpdates.length;
  console.log(
    `[marker] ${documentId}: ${matchedCount}/${total} chunks mapped` +
    (total > 0 ? ` (${Math.round((matchedCount / total) * 100)}%)` : ''),
  );

  const markdownWithAnchors = injectChunkAnchors(markdown, chunkUpdates);
  await persistMarkerEnrichment(documentId, markdownWithAnchors, chunkUpdates);
}

async function requestMarkerMarkdown(pdfBuffer: Buffer): Promise<string> {
  for (let attempt = 1; attempt <= MARKER_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestMarkerMarkdownOnce(pdfBuffer);
    } catch (error) {
      if (!isRetryableMarkerError(error) || attempt === MARKER_RETRY_MAX_ATTEMPTS) {
        throw error;
      }
      await sleep(getMarkerRetryDelayMs(attempt));
    }
  }

  throw new Error("marker request failed");
}

async function requestMarkerMarkdownOnce(pdfBuffer: Buffer): Promise<string> {
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

function isRetryableMarkerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const statusMatch = message.match(/\b(\d{3})\b/);
  if (statusMatch && MARKER_RETRYABLE_STATUS_CODES.has(Number(statusMatch[1]))) {
    return true;
  }
  return MARKER_RETRYABLE_ERRORS.test(message);
}

function getMarkerRetryDelayMs(attempt: number): number {
  return Math.min(MARKER_RETRY_BASE_MS * (2 ** (attempt - 1)), MARKER_RETRY_MAX_DELAY_MS);
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

  for (const prefixLen of CHUNK_MATCH_PREFIX_LENGTHS) {
    const prefix = trimmed.slice(0, prefixLen);
    if (!prefix) break;

    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = escaped.replace(/ /g, "\\s+");
    try {
      const match = new RegExp(pattern, "i").exec(markdown);
      if (match?.index != null) return match.index;
    } catch {
      // regex compile failed (too many special chars), try shorter prefix
    }
  }

  return null;
}

function snapToParagraphStart(markdown: string, offset: number): number {
  const before = markdown.slice(0, offset);
  const lastBlankLine = before.lastIndexOf("\n\n");
  if (lastBlankLine !== -1 && offset - lastBlankLine <= ANCHOR_SNAP_WINDOW) {
    return lastBlankLine + 2;
  }
  const lastNewline = before.lastIndexOf("\n");
  if (lastNewline !== -1 && offset - lastNewline <= ANCHOR_SNAP_WINDOW / 2) {
    return lastNewline + 1;
  }
  return offset;
}

function injectChunkAnchors(markdown: string, chunkUpdates: ChunkMarkerUpdate[]): string {
  // Snap each offset to the start of its paragraph, then insert in reverse order
  const inserts = chunkUpdates
    .filter((item) => item.charOffset != null)
    .map((item) => ({
      chunkIndex: item.chunkIndex,
      offset: snapToParagraphStart(markdown, item.charOffset!),
    }))
    .sort((a, b) => b.offset - a.offset);

  let output = markdown;
  for (const item of inserts) {
    output = `${output.slice(0, item.offset)}<span id="chunk-${item.chunkIndex}"></span>\n${output.slice(item.offset)}`;
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
           marker_processed = true,
           marker_last_error = NULL,
           marker_completed_at = NOW()
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

async function recordMarkerAttemptStart(documentId: string): Promise<void> {
  await db.query(
    `UPDATE documents
     SET marker_attempts = COALESCE(marker_attempts, 0) + 1,
         marker_last_attempt_at = NOW()
     WHERE id = $1`,
    [documentId],
  );
}

async function recordMarkerFailure(documentId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error ?? "marker enrichment failed");
  await db.query(
    `UPDATE documents
     SET marker_last_error = $2
     WHERE id = $1`,
    [documentId, message.slice(0, 2000)],
  );
}

export async function backfillMarkerDocuments(limit = 20): Promise<{
  scanned: number;
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  await ensureDocumentSchema();

  const { rows } = await db.query(
    `SELECT id::text, source_url, source_type
     FROM documents
     WHERE COALESCE(marker_processed, false) = false
       AND source_url IS NOT NULL
       AND source_url <> ''
     ORDER BY created_at ASC NULLS LAST
     LIMIT $1`,
    [limit],
  );

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const row of rows as Array<{ id: string; source_url: string; source_type: IngestSourceType | null }>) {
    const sourceType = row.source_type ?? inferSourceType(row.source_url);
    const pdfBuffer = await fetchBackfillPdfBuffer(row.source_url, sourceType).catch(() => null);
    if (!pdfBuffer?.byteLength) continue;

    attempted += 1;
    try {
      await enrichDocumentWithMarker(row.id, pdfBuffer);
      succeeded += 1;
    } catch (error) {
      await recordMarkerFailure(row.id, error);
      failed += 1;
    }
  }

  return {
    scanned: rows.length,
    attempted,
    succeeded,
    failed,
  };
}

async function fetchBackfillPdfBuffer(sourceUrl: string, sourceType: IngestSourceType): Promise<Buffer | null> {
  if (sourceType === "local_doc") return null;

  if (/arxiv\.org\//i.test(sourceUrl)) {
    const arxivMatch = sourceUrl.match(/arxiv\.org\/(?:abs|pdf)\/([^/?#]+)/i);
    if (arxivMatch?.[1]) {
      const fetched = await fetchArxivPaper(arxivMatch[1].replace(/\.pdf$/i, ""));
      return fetched.pdfBuffer;
    }
  }

  if (!/^https?:\/\//i.test(sourceUrl)) return null;
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`backfill pdf fetch failed: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
