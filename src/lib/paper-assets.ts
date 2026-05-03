import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { db } from "@/lib/db/db";
import type { IngestResult } from "@/lib/paper-ingest";
import { ensureCouncilSchema } from "@/lib/db/council-db";

export type PaperAssetStatus = "pending" | "processing" | "ready" | "failed";
export type PaperAssetSourceKind = "arxiv" | "upload" | "pdf_url" | "text";

export interface PaperAsset {
  id: string;
  workspace_id: string | null;
  canonical_title: string;
  abstract: string | null;
  authors: string[];
  year: number | null;
  arxiv_id: string | null;
  canonical_checksum_sha256: string | null;
  status: PaperAssetStatus;
  processing_error: string | null;
  marker_processed: boolean;
  document_id: string | null;
  primary_library_id: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

export interface ResolvedPaperAsset {
  asset: PaperAsset;
  reusedAsset: boolean;
}

export interface PaperAssetBackfillSummary {
  scanned: number;
  updated: number;
  skipped: number;
  created: number;
}

export interface PaperAssetListItem {
  id: string;
  canonical_title: string;
  arxiv_id: string | null;
  status: PaperAssetStatus;
  marker_processed: boolean;
  primary_library_id: string | null;
  created_at: string;
  updated_at: string;
  session_count: number;
}

function mapPaperAssetRow(row: Record<string, unknown>): PaperAsset {
  return {
    id: String(row.id),
    workspace_id: row.workspace_id ? String(row.workspace_id) : null,
    canonical_title: String(row.canonical_title ?? ""),
    abstract: row.abstract ? String(row.abstract) : null,
    authors: Array.isArray(row.authors) ? row.authors.map(String) : [],
    year: typeof row.year === "number" ? row.year : row.year ? Number(row.year) : null,
    arxiv_id: row.arxiv_id ? String(row.arxiv_id) : null,
    canonical_checksum_sha256: row.canonical_checksum_sha256 ? String(row.canonical_checksum_sha256) : null,
    status: (row.status as PaperAssetStatus) ?? "pending",
    processing_error: row.processing_error ? String(row.processing_error) : null,
    marker_processed: Boolean(row.marker_processed),
    document_id: row.document_id ? String(row.document_id) : null,
    primary_library_id: row.primary_library_id ? String(row.primary_library_id) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    processed_at: row.processed_at ? String(row.processed_at) : null,
  };
}

function normalizeArxivId(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.replace(/^arxiv:/i, "");
}

function extractSourceUrlFromContext(context?: string | null): string | null {
  if (!context) return null;
  const match = context.match(/Source:\s*(.*)\. Library:\s*/i);
  return match?.[1]?.trim() ?? null;
}

function extractArxivIdFromSource(sourceUrl?: string | null): string | null {
  if (!sourceUrl) return null;
  const arxivMatch = sourceUrl.match(/arxiv\.org\/(?:abs|pdf)\/([^/?#]+?)(?:\.pdf)?$/i);
  if (arxivMatch?.[1]) return normalizeArxivId(arxivMatch[1]);
  const plainMatch = sourceUrl.match(/^(\d{4}\.\d{4,5}(?:v\d+)?)$/i);
  return plainMatch?.[1] ?? null;
}

export function computeBufferChecksum(buffer: Buffer | undefined): string | null {
  if (!buffer?.byteLength) return null;
  return createHash("sha256").update(buffer).digest("hex");
}

async function findPaperAssetByArxivId(arxivId: string): Promise<PaperAsset | null> {
  const { rows } = await db.query(
    `SELECT * FROM paper_assets WHERE arxiv_id = $1 LIMIT 1`,
    [arxivId],
  );
  return rows[0] ? mapPaperAssetRow(rows[0] as Record<string, unknown>) : null;
}

async function findPaperAssetBySourceChecksum(
  sourceKind: PaperAssetSourceKind,
  checksum: string,
): Promise<PaperAsset | null> {
  const { rows } = await db.query(
    `SELECT a.*
     FROM paper_asset_sources s
     JOIN paper_assets a ON a.id = s.paper_asset_id
     WHERE s.source_kind = $1
       AND s.checksum_sha256 = $2
     ORDER BY s.created_at ASC
     LIMIT 1`,
    [sourceKind, checksum],
  );
  return rows[0] ? mapPaperAssetRow(rows[0] as Record<string, unknown>) : null;
}

async function findPaperAssetByLocator(
  sourceKind: PaperAssetSourceKind,
  locator: string,
): Promise<PaperAsset | null> {
  const { rows } = await db.query(
    `SELECT a.*
     FROM paper_asset_sources s
     JOIN paper_assets a ON a.id = s.paper_asset_id
     WHERE s.source_kind = $1
       AND s.source_locator = $2
     ORDER BY s.created_at ASC
     LIMIT 1`,
    [sourceKind, locator],
  );
  return rows[0] ? mapPaperAssetRow(rows[0] as Record<string, unknown>) : null;
}

async function createPaperAsset(input: {
  workspaceId?: string | null;
  title: string;
  abstract?: string | null;
  arxivId?: string | null;
  checksumSha256?: string | null;
  status?: PaperAssetStatus;
}): Promise<PaperAsset> {
  const { rows } = await db.query(
    `INSERT INTO paper_assets (
       id, workspace_id, canonical_title, abstract, authors, year, arxiv_id,
       canonical_checksum_sha256, status, processing_error, marker_processed,
       document_id, primary_library_id
     )
     VALUES ($1,$2,$3,$4,'{}',$5,$6,$7,$8,NULL,false,NULL,NULL)
     RETURNING *`,
    [
      nanoid(),
      input.workspaceId ?? null,
      input.title.trim() || "Untitled Paper",
      input.abstract?.trim() || null,
      null,
      normalizeArxivId(input.arxivId),
      input.checksumSha256 ?? null,
      input.status ?? "pending",
    ],
  );
  return mapPaperAssetRow(rows[0] as Record<string, unknown>);
}

async function ensurePaperAssetSource(input: {
  paperAssetId: string;
  sourceKind: PaperAssetSourceKind;
  sourceLocator?: string | null;
  checksumSha256?: string | null;
  uploadedFileId?: string | null;
}): Promise<void> {
  await db.query(
    `INSERT INTO paper_asset_sources (
       id, paper_asset_id, source_kind, source_locator, checksum_sha256, uploaded_file_id
     )
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT DO NOTHING`,
    [
      nanoid(),
      input.paperAssetId,
      input.sourceKind,
      input.sourceLocator ?? null,
      input.checksumSha256 ?? null,
      input.uploadedFileId ?? null,
    ],
  );
}

export async function resolvePaperAsset(input: {
  workspaceId?: string | null;
  title: string;
  abstract?: string | null;
  arxivId?: string | null;
  sourceKind: PaperAssetSourceKind;
  sourceLocator?: string | null;
  checksumSha256?: string | null;
}): Promise<ResolvedPaperAsset> {
  const normalizedArxivId = normalizeArxivId(input.arxivId);
  const normalizedLocator = input.sourceLocator?.trim() || null;
  const normalizedChecksum = input.checksumSha256?.trim() || null;

  let asset: PaperAsset | null = null;
  if (normalizedArxivId) {
    asset = await findPaperAssetByArxivId(normalizedArxivId);
  }
  if (!asset && normalizedChecksum && input.sourceKind === "upload") {
    asset = await findPaperAssetBySourceChecksum("upload", normalizedChecksum);
  }
  if (!asset && normalizedChecksum && input.sourceKind === "pdf_url") {
    asset = await findPaperAssetBySourceChecksum("pdf_url", normalizedChecksum);
  }
  if (!asset && normalizedLocator && input.sourceKind !== "text") {
    asset = await findPaperAssetByLocator(input.sourceKind, normalizedLocator);
  }

  const reusedAsset = Boolean(asset);
  if (!asset) {
    asset = await createPaperAsset({
      workspaceId: input.workspaceId,
      title: input.title,
      abstract: input.abstract,
      arxivId: normalizedArxivId,
      checksumSha256: normalizedChecksum,
      status: "pending",
    });
  }

  await ensurePaperAssetSource({
    paperAssetId: asset.id,
    sourceKind: input.sourceKind,
    sourceLocator: normalizedLocator,
    checksumSha256: normalizedChecksum,
  });

  return { asset, reusedAsset };
}

export async function attachIngestedDocumentToPaperAsset(input: {
  paperAssetId: string;
  ingestResult: IngestResult;
  title: string;
  abstract?: string | null;
  arxivId?: string | null;
  checksumSha256?: string | null;
}): Promise<PaperAsset> {
  const markerLookup = await db.query(
    `SELECT COALESCE(marker_processed, false) AS marker_processed
     FROM documents
     WHERE id = $1
     LIMIT 1`,
    [input.ingestResult.documentId],
  );
  const markerProcessed = Boolean(markerLookup.rows[0]?.marker_processed);

  const { rows } = await db.query(
    `UPDATE paper_assets
     SET canonical_title = COALESCE(NULLIF($2, ''), canonical_title),
         abstract = COALESCE($3, abstract),
         arxiv_id = COALESCE($4, arxiv_id),
         canonical_checksum_sha256 = COALESCE($5, canonical_checksum_sha256),
         status = 'ready',
         processing_error = NULL,
         marker_processed = $8,
         document_id = $6,
         primary_library_id = $7,
         processed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      input.paperAssetId,
      input.title.trim(),
      input.abstract?.trim() || null,
      normalizeArxivId(input.arxivId),
      input.checksumSha256 ?? null,
      input.ingestResult.documentId,
      input.ingestResult.libraryId,
      markerProcessed,
    ],
  );

  await db.query(
    `INSERT INTO paper_libraries (id, paper_asset_id, library_id, document_id, is_primary)
     VALUES ($1,$2,$3,$4,true)
     ON CONFLICT (library_id) DO NOTHING`,
    [
      nanoid(),
      input.paperAssetId,
      input.ingestResult.libraryId,
      input.ingestResult.documentId,
    ],
  );

  return mapPaperAssetRow(rows[0] as Record<string, unknown>);
}

export async function markPaperAssetProcessingFailed(paperAssetId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error ?? "paper asset processing failed");
  await db.query(
    `UPDATE paper_assets
     SET status = 'failed',
         processing_error = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [paperAssetId, message.slice(0, 2000)],
  );
}

export async function markPaperAssetProcessingStarted(paperAssetId: string): Promise<void> {
  await db.query(
    `UPDATE paper_assets
     SET status = 'processing',
         processing_error = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [paperAssetId],
  );
}

export async function getPaperAssetById(paperAssetId: string): Promise<PaperAsset | null> {
  const { rows } = await db.query(`SELECT * FROM paper_assets WHERE id = $1 LIMIT 1`, [paperAssetId]);
  return rows[0] ? mapPaperAssetRow(rows[0] as Record<string, unknown>) : null;
}

export async function getPaperAssetLookupByArxivId(arxivId: string): Promise<{
  status: PaperAssetStatus | "unknown";
  paperAssetId: string | null;
  title: string | null;
  markerProcessed: boolean;
  sessionCount: number;
} | null> {
  const normalizedArxivId = normalizeArxivId(arxivId);
  if (!normalizedArxivId) return null;

  const { rows } = await db.query(
    `SELECT a.id,
            a.canonical_title,
            a.status,
            a.marker_processed,
            COUNT(s.id)::int AS session_count
     FROM paper_assets a
     LEFT JOIN council_sessions s ON s.paper_asset_id = a.id
     WHERE a.arxiv_id = $1
     GROUP BY a.id
     LIMIT 1`,
    [normalizedArxivId],
  );

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    status: (row.status as PaperAssetStatus) ?? "unknown",
    paperAssetId: row.id ? String(row.id) : null,
    title: row.canonical_title ? String(row.canonical_title) : null,
    markerProcessed: Boolean(row.marker_processed),
    sessionCount: Number(row.session_count ?? 0),
  };
}

export async function backfillPaperAssetsForSessions(limit = 100): Promise<PaperAssetBackfillSummary> {
  await ensureCouncilSchema();

  const { rows } = await db.query(
    `SELECT s.id,
            s.title,
            s.context,
            s.paper_asset_id,
            s.workspace_id,
            s.seats
     FROM council_sessions s
     WHERE s.paper_asset_id IS NULL
     ORDER BY s.created_at ASC
     LIMIT $1`,
    [limit],
  );

  let updated = 0;
  let skipped = 0;
  let created = 0;

  for (const row of rows as Array<{
    id: string;
    title: string | null;
    context: string | null;
    paper_asset_id: string | null;
    workspace_id: string | null;
    seats: unknown;
  }>) {
    const sourceUrl = extractSourceUrlFromContext(row.context);
    const arxivId = extractArxivIdFromSource(sourceUrl);
    const seats = Array.isArray(row.seats) ? row.seats as Array<Record<string, unknown>> : [];
    const libraryId = seats.find((seat) => typeof seat.library_id === "string" && seat.library_id.trim())?.library_id as string | undefined;

    if (!sourceUrl && !arxivId && !libraryId) {
      skipped += 1;
      continue;
    }

    let asset: PaperAsset | null = null;
    let reused = true;

    if (arxivId) {
      const resolved = await resolvePaperAsset({
        workspaceId: row.workspace_id,
        title: row.title?.trim() || "Untitled Paper",
        arxivId,
        sourceKind: "arxiv",
        sourceLocator: arxivId,
      });
      asset = resolved.asset;
      reused = resolved.reusedAsset;
    } else if (sourceUrl === "upload" && libraryId) {
      const uploadedFileLookup = await db.query(
        `SELECT checksum_sha256
         FROM uploaded_files
         WHERE library_id = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [libraryId],
      );
      const checksum = uploadedFileLookup.rows[0]?.checksum_sha256
        ? String(uploadedFileLookup.rows[0].checksum_sha256)
        : null;
      // Fallback: no checksum recorded (pre-dates tracking) — use library ID as unique locator
      const resolved = await resolvePaperAsset({
        workspaceId: row.workspace_id,
        title: row.title?.trim() || "Untitled Paper",
        sourceKind: "upload",
        sourceLocator: checksum ? "upload" : `library:${libraryId}`,
        checksumSha256: checksum,
      });
      asset = resolved.asset;
      reused = resolved.reusedAsset;
    } else {
      skipped += 1;
      continue;
    }

    if (!asset) {
      skipped += 1;
      continue;
    }

    if (!reused) created += 1;

    if (libraryId && !asset.primary_library_id) {
      const documentLookup = await db.query(
        `SELECT id::text, COALESCE(marker_processed, false) AS marker_processed
         FROM documents
         WHERE tags ? $1
         ORDER BY created_at ASC NULLS LAST
         LIMIT 1`,
        [`council:lib:${libraryId}`],
      );
      const documentId = documentLookup.rows[0]?.id ? String(documentLookup.rows[0].id) : null;
      const markerProcessed = Boolean(documentLookup.rows[0]?.marker_processed);
      if (documentId) {
        await db.query(
          `UPDATE paper_assets
           SET document_id = COALESCE(document_id, $2),
               primary_library_id = COALESCE(primary_library_id, $3),
               marker_processed = CASE WHEN marker_processed THEN marker_processed ELSE $4 END,
               status = CASE WHEN status = 'pending' THEN 'ready' ELSE status END,
               processed_at = COALESCE(processed_at, NOW()),
               updated_at = NOW()
           WHERE id = $1`,
          [asset.id, documentId, libraryId, markerProcessed],
        );
        await db.query(
          `INSERT INTO paper_libraries (id, paper_asset_id, library_id, document_id, is_primary)
           VALUES ($1,$2,$3,$4,true)
           ON CONFLICT (library_id) DO NOTHING`,
          [nanoid(), asset.id, libraryId, documentId],
        );
      }
    }

    await db.query(
      `UPDATE council_sessions
       SET paper_asset_id = $2
       WHERE id = $1 AND paper_asset_id IS NULL`,
      [row.id, asset.id],
    );
    updated += 1;
  }

  return {
    scanned: rows.length,
    updated,
    skipped,
    created,
  };
}

export interface PaperSessionSummary {
  id: string;
  title: string;
  topic: string;
  status: string;
  rounds: number;
  divergence_level: string | null;
  created_at: string;
  concluded_at: string | null;
}

export interface PaperAssetDetail {
  asset: PaperAsset;
  sessions: PaperSessionSummary[];
}

export async function getPaperAssetDetail(
  paperAssetId: string,
  workspaceId?: string | null,
): Promise<PaperAssetDetail | null> {
  await ensureCouncilSchema();
  const { rows: assetRows } = await db.query(
    `SELECT * FROM paper_assets WHERE id = $1 LIMIT 1`,
    [paperAssetId],
  );
  if (!assetRows[0]) return null;

  const asset = mapPaperAssetRow(assetRows[0] as Record<string, unknown>);

  if (workspaceId && asset.workspace_id && asset.workspace_id !== workspaceId) return null;

  const { rows: sessionRows } = await db.query(
    `SELECT id, title, topic, status, rounds, divergence_level, created_at, concluded_at
     FROM council_sessions
     WHERE paper_asset_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [paperAssetId],
  );

  const sessions: PaperSessionSummary[] = (sessionRows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    topic: String(row.topic ?? ""),
    status: String(row.status ?? "pending"),
    rounds: Number(row.rounds ?? 1),
    divergence_level: row.divergence_level ? String(row.divergence_level) : null,
    created_at: String(row.created_at ?? ""),
    concluded_at: row.concluded_at ? String(row.concluded_at) : null,
  }));

  return { asset, sessions };
}

export async function listPaperAssets(input: {
  workspaceId?: string | null;
  limit?: number;
}): Promise<PaperAssetListItem[]> {
  await ensureCouncilSchema();
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(Number(input.limit), 200)) : 50;
  const workspaceId = input.workspaceId?.trim() || null;

  const { rows } = await db.query(
    `SELECT a.id,
            a.canonical_title,
            a.arxiv_id,
            a.status,
            a.marker_processed,
            a.primary_library_id,
            a.created_at,
            a.updated_at,
            COUNT(s.id)::int AS session_count
     FROM paper_assets a
     LEFT JOIN council_sessions s ON s.paper_asset_id = a.id
     WHERE ($1::text IS NULL OR a.workspace_id = $1)
     GROUP BY a.id
     ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
     LIMIT $2`,
    [workspaceId, limit],
  );

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    canonical_title: String(row.canonical_title ?? ""),
    arxiv_id: row.arxiv_id ? String(row.arxiv_id) : null,
    status: (row.status as PaperAssetStatus) ?? "pending",
    marker_processed: Boolean(row.marker_processed),
    primary_library_id: row.primary_library_id ? String(row.primary_library_id) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    session_count: Number(row.session_count ?? 0),
  }));
}
