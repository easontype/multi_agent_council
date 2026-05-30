// GET /api/reader/papers/[paperId]/content
// Returns ParsedPaper. Triggers parsing if not yet done.

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

  // arXiv: parse from ar5iv on demand
  if (paper.sourceType === "arxiv" && paper.arxivId) {
    try {
      const parsed = await parseArxivPaper(paper.arxivId, paperId)
      await saveReaderPaperContent(paperId, parsed)
      return NextResponse.json(parsed)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Parse failed" },
        { status: 502 }
      )
    }
  }

  // PDF: content should have been parsed at upload time
  // If missing (e.g. upload interrupted), return 422
  return NextResponse.json(
    { error: "PDF content not available — re-upload the file" },
    { status: 422 }
  )
}
