import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/db";

/**
 * GET  /api/admin/paper-sources-cleanup          — show corrupted rows
 * POST /api/admin/paper-sources-cleanup?fix=true  — delete corrupted rows
 *
 * Corrupted rows: paper_asset_sources entries for source_kind='upload' where
 * the row's checksum_sha256 differs from the paper_asset's canonical_checksum_sha256.
 * These were created by the old locator-dedup bug that collapsed all uploads onto
 * the first-ever uploaded paper asset.
 */

export async function GET(_req: NextRequest) {
  // Show all paper_assets with their source rows to diagnose the corruption.
  const { rows: assets } = await db.query(`
    SELECT
      a.id,
      a.canonical_title,
      a.canonical_checksum_sha256,
      a.status,
      a.created_at,
      COUNT(pas.id)::int AS source_count,
      COUNT(CASE WHEN pas.source_kind = 'upload' AND pas.checksum_sha256 IS NOT NULL
                      AND a.canonical_checksum_sha256 IS NOT NULL
                      AND pas.checksum_sha256 != a.canonical_checksum_sha256 THEN 1 END)::int AS corrupted_count
    FROM paper_assets a
    LEFT JOIN paper_asset_sources pas ON pas.paper_asset_id = a.id
    GROUP BY a.id
    ORDER BY corrupted_count DESC, a.created_at ASC
    LIMIT 50
  `);

  const { rows: corruptedRows } = await db.query(`
    SELECT
      pas.id AS source_id,
      pas.paper_asset_id,
      a.canonical_title,
      a.canonical_checksum_sha256 AS asset_checksum,
      pas.checksum_sha256 AS source_checksum,
      pas.source_locator,
      pas.created_at
    FROM paper_asset_sources pas
    JOIN paper_assets a ON a.id = pas.paper_asset_id
    WHERE pas.source_kind = 'upload'
      AND pas.checksum_sha256 IS NOT NULL
      AND a.canonical_checksum_sha256 IS NOT NULL
      AND pas.checksum_sha256 != a.canonical_checksum_sha256
    ORDER BY a.created_at ASC, pas.created_at ASC
  `);

  return NextResponse.json({
    assets,
    corruptedRows,
    totalCorrupted: corruptedRows.length,
    hint: "POST ?fix=true to delete the corrupted rows",
  });
}

export async function POST(req: NextRequest) {
  const fix = req.nextUrl.searchParams.get("fix") === "true";

  if (!fix) {
    return NextResponse.json({ error: "Pass ?fix=true to confirm cleanup" }, { status: 400 });
  }

  const { rowCount } = await db.query(`
    DELETE FROM paper_asset_sources pas
    USING paper_assets a
    WHERE pas.paper_asset_id = a.id
      AND pas.source_kind = 'upload'
      AND pas.checksum_sha256 IS NOT NULL
      AND a.canonical_checksum_sha256 IS NOT NULL
      AND pas.checksum_sha256 != a.canonical_checksum_sha256
  `);

  return NextResponse.json({
    deleted: rowCount,
    message: `Removed ${rowCount} corrupted paper_asset_sources rows. Upload deduplication will now work correctly.`,
  });
}
