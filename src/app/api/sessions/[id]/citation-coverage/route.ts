import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/db";
import { canAccessCouncilSession } from "@/lib/core/council-access";

interface SectionCoverage {
  heading: string
  startChunk: number
  endChunk: number
  citedCount: number
}

interface DocumentCoverage {
  id: string
  title: string
  totalChunks: number
  citedChunkIndices: number[]
  sections: SectionCoverage[]
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const allowed = await canAccessCouncilSession(req, id);
  if (!allowed) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Collect all cited chunk_index values per document for this session.
  // source_refs is a JSONB array of CouncilEvidenceSource; unnest to extract per-ref fields.
  const evidenceRows = await db.query(
    `SELECT DISTINCT
       (sr->>'doc_id') AS doc_id,
       (sr->>'chunk_index')::integer AS chunk_index
     FROM council_evidence e,
          jsonb_array_elements(e.source_refs) AS sr
     WHERE e.session_id = $1
       AND sr->>'doc_id' IS NOT NULL
       AND sr->>'chunk_index' IS NOT NULL`,
    [id],
  );

  const citedByDoc = new Map<string, Set<number>>();
  for (const row of evidenceRows.rows as Array<{ doc_id: string; chunk_index: number }>) {
    if (!citedByDoc.has(row.doc_id)) citedByDoc.set(row.doc_id, new Set());
    citedByDoc.get(row.doc_id)!.add(Number(row.chunk_index));
  }

  if (!citedByDoc.size) {
    return NextResponse.json({ documents: [] });
  }

  const docIds = Array.from(citedByDoc.keys());

  // Fetch document metadata + chunk counts
  const docsResult = await db.query(
    `SELECT id::text, title, COUNT(c.chunk_index) AS total_chunks
     FROM documents d
     LEFT JOIN document_chunks c ON c.document_id = d.id
     WHERE d.id = ANY($1::uuid[])
     GROUP BY d.id, d.title`,
    [docIds],
  );

  // Fetch section headings from document_chunks
  const chunksResult = await db.query(
    `SELECT document_id::text, chunk_index, section_heading
     FROM document_chunks
     WHERE document_id = ANY($1::uuid[])
     ORDER BY document_id, chunk_index ASC`,
    [docIds],
  );

  const chunksByDoc = new Map<string, Array<{ chunk_index: number; section_heading: string | null }>>();
  for (const row of chunksResult.rows as Array<{ document_id: string; chunk_index: number; section_heading: string | null }>) {
    if (!chunksByDoc.has(row.document_id)) chunksByDoc.set(row.document_id, []);
    chunksByDoc.get(row.document_id)!.push({ chunk_index: row.chunk_index, section_heading: row.section_heading });
  }

  const documents: DocumentCoverage[] = [];

  for (const docRow of docsResult.rows as Array<{ id: string; title: string | null; total_chunks: string }>) {
    const cited = citedByDoc.get(docRow.id) ?? new Set<number>();
    const chunks = chunksByDoc.get(docRow.id) ?? [];
    const totalChunks = Number(docRow.total_chunks);

    // Build section coverage map
    const sectionMap = new Map<string, { startChunk: number; endChunk: number; citedCount: number }>();
    let currentHeading: string | null = null;
    let sectionStart = 0;

    for (const chunk of chunks) {
      const heading = chunk.section_heading;
      if (heading && heading !== currentHeading) {
        if (currentHeading != null) {
          const prev = sectionMap.get(currentHeading)!;
          prev.endChunk = chunk.chunk_index - 1;
        }
        currentHeading = heading;
        sectionStart = chunk.chunk_index;
        sectionMap.set(heading, { startChunk: sectionStart, endChunk: totalChunks - 1, citedCount: 0 });
      }
      if (currentHeading && cited.has(chunk.chunk_index)) {
        sectionMap.get(currentHeading)!.citedCount++;
      }
    }

    const sections: SectionCoverage[] = Array.from(sectionMap.entries()).map(([heading, data]) => ({
      heading,
      startChunk: data.startChunk,
      endChunk: data.endChunk,
      citedCount: data.citedCount,
    }));

    documents.push({
      id: docRow.id,
      title: docRow.title ?? "Untitled",
      totalChunks,
      citedChunkIndices: Array.from(cited).sort((a, b) => a - b),
      sections,
    });
  }

  return NextResponse.json({ documents });
}
