// GET /api/reader/papers/[paperId]/pdf — stream the stored PDF file

import { NextRequest, NextResponse } from "next/server"
import { getReaderPaper } from "@/lib/reader/db"
import { loadPdf } from "@/lib/reader/pdf-storage"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const { paperId } = await params
  const paper = await getReaderPaper(paperId)
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (paper.sourceType !== "pdf") return NextResponse.json({ error: "Not a PDF paper" }, { status: 400 })

  const buffer = await loadPdf(paperId)
  if (!buffer) return NextResponse.json({ error: "PDF file not found on server" }, { status: 404 })

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  })
}
