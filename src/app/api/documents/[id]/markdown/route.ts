import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/db";

interface MarkdownSection {
  heading: string;
  level: number;
  startChar: number;
  endChar: number;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const documentId = id?.trim();

  if (!documentId) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  const { rows } = await db.query(
    `SELECT markdown_content, marker_processed
     FROM documents
     WHERE id = $1
     LIMIT 1`,
    [documentId],
  );

  if (!rows.length) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const row = rows[0] as {
    markdown_content: string | null;
    marker_processed: boolean | null;
  };

  const markdown = row.markdown_content ?? "";
  const markerProcessed = Boolean(row.marker_processed);

  return NextResponse.json({
    markdown,
    sections: extractMarkdownSections(markdown),
    markerProcessed,
  });
}

function extractMarkdownSections(markdown: string): MarkdownSection[] {
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
