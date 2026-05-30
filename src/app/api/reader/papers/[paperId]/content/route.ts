// GET /api/reader/papers/[paperId]/content
// Returns parsed paper content (ParsedPaper).
// If not yet parsed, triggers parsing and returns 202 while work is in progress.

import { NextRequest, NextResponse } from "next/server"
import { getReaderPaper, saveReaderPaperContent } from "@/lib/reader/db"
import { parseArxivPaper } from "@/lib/reader/arxiv-parser"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const { paperId } = await params
  const paper = await getReaderPaper(paperId)

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 })
  }

  // Return cached content immediately
  if (paper.contentJson) {
    return NextResponse.json(paper.contentJson)
  }

  // Trigger parsing for arXiv papers
  if (paper.sourceType === "arxiv" && paper.arxivId) {
    try {
      const parsed = await parseArxivPaper(paper.arxivId, paperId)
      await saveReaderPaperContent(paperId, parsed)
      return NextResponse.json(parsed)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Parse failed"
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  return NextResponse.json({ error: "Cannot parse this paper type yet" }, { status: 422 })
}
