// POST /api/reader/papers/[paperId]/reextract
// Re-runs PDF extraction for a paper that already has its PDF on disk.

import { NextRequest, NextResponse } from "next/server"
import { getReaderPaper, saveReaderPaperContent } from "@/lib/reader/db"
import { pdfExists } from "@/lib/reader/pdf-storage"
import { parsePdfBuffer } from "@/lib/reader/pdf-parser"
import { join } from "path"

export async function POST(req: NextRequest, { params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params
  const paper = await getReaderPaper(paperId)

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 })
  }
  if (paper.sourceType !== "pdf") {
    return NextResponse.json({ error: "Only PDF papers can be re-extracted" }, { status: 400 })
  }
  if (!pdfExists(paperId)) {
    return NextResponse.json({ error: "PDF file not found on disk" }, { status: 404 })
  }

  const pdfPath = join(process.cwd(), "uploads", "reader-pdfs", `${paperId}.pdf`)

  try {
    const parsed = await parsePdfBuffer(Buffer.alloc(0), paperId, pdfPath, paper.title)
    await saveReaderPaperContent(paperId, parsed)
    return NextResponse.json({ ok: true, title: parsed.title, sections: parsed.sections.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
