import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/db";

const CONTEXT_RADIUS = 2;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
  const docId = id?.trim();
  const chunkIndex = parseInt(index, 10);

  if (!docId || isNaN(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const minIndex = Math.max(0, chunkIndex - CONTEXT_RADIUS);
  const maxIndex = chunkIndex + CONTEXT_RADIUS;

  const { rows } = await db.query(
    `SELECT c.chunk_index,
            c.content,
            c.section_heading,
            c.char_offset
     FROM document_chunks c
     WHERE c.document_id = $1
       AND c.chunk_index BETWEEN $2 AND $3
     ORDER BY c.chunk_index ASC`,
    [docId, minIndex, maxIndex],
  );

  if (!rows.length) {
    return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
  }

  type ChunkRow = { chunk_index: number; content: string; section_heading: string | null; char_offset: number | null };
  const typed = rows as ChunkRow[];

  const target = typed.find((r) => r.chunk_index === chunkIndex);
  if (!target) {
    return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
  }

  const before = typed.filter((r) => r.chunk_index < chunkIndex);
  const after = typed.filter((r) => r.chunk_index > chunkIndex);

  // Use target's section_heading, or walk backwards to find the nearest heading
  const sectionHeading =
    target.section_heading ??
    [...typed]
      .filter((r) => r.chunk_index <= chunkIndex && r.section_heading)
      .reverse()[0]?.section_heading ??
    null;

  return NextResponse.json({
    before: before.map((r) => ({ chunk_index: r.chunk_index, content: r.content })),
    target: { chunk_index: target.chunk_index, content: target.content },
    after: after.map((r) => ({ chunk_index: r.chunk_index, content: r.content })),
    sectionHeading,
    pageEstimate: null,
  });
}
