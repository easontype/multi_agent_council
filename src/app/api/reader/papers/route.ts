// GET  /api/reader/papers  — list user's papers
// POST /api/reader/papers  — add paper by arXiv ID (JSON) or PDF upload (multipart)

import { NextRequest, NextResponse } from "next/server"
import { resolveAuthAccountContext } from "@/lib/auth-account"
import {
  createReaderPaper,
  getReaderPaperByArxivId,
  listReaderPapers,
  saveReaderPaperContent,
} from "@/lib/reader/db"
import { fetchArxivMeta } from "@/lib/reader/arxiv-parser"
import { parsePdfBuffer } from "@/lib/reader/pdf-parser"
import { savePdf } from "@/lib/reader/pdf-storage"

const MAX_PDF_BYTES = 20 * 1024 * 1024 // 20 MB

export async function GET() {
  const account = await resolveAuthAccountContext()
  const papers = await listReaderPapers(account?.userId ?? null)
  return NextResponse.json(papers)
}

export async function POST(req: NextRequest) {
  const account = await resolveAuthAccountContext()
  const userId = account?.userId ?? null
  const contentType = req.headers.get("content-type") ?? ""

  // ── PDF upload ─────────────────────────────────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    const file = form.get("file") as File | null

    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "A PDF file is required" }, { status: 400 })
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF exceeds 20 MB limit" }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const paper = await createReaderPaper({
      userId,
      title: file.name.replace(/\.pdf$/i, ""),
      authors: [],
      abstract: "",
      sourceType: "pdf",
    })

    try {
      // Save raw PDF to disk (for client-side canvas rendering)
      await savePdf(paper.id, buffer)
      // Extract text structure for AI interactions
      const parsed = await parsePdfBuffer(buffer, paper.id, file.name)
      await saveReaderPaperContent(paper.id, parsed)
      return NextResponse.json({ ...paper, title: parsed.title, abstract: parsed.abstract }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "PDF parse failed"
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  // ── arXiv ID ───────────────────────────────────────────────────────────────
  const body = await req.json()
  const arxivId = (body.arxivId as string | undefined)
    ?.trim()
    .replace(/^https?:\/\/(arxiv\.org|ar5iv\.org)\/(abs|html)\//, "")

  if (!arxivId) {
    return NextResponse.json({ error: "arxivId or PDF file required" }, { status: 400 })
  }

  const existing = await getReaderPaperByArxivId(arxivId, userId)
  if (existing) return NextResponse.json(existing)

  let meta: { title: string; authors: string[]; abstract: string }
  try {
    meta = await fetchArxivMeta(arxivId)
  } catch {
    return NextResponse.json({ error: "Failed to fetch arXiv metadata" }, { status: 502 })
  }

  const paper = await createReaderPaper({
    userId,
    title: meta.title || arxivId,
    authors: meta.authors,
    abstract: meta.abstract,
    arxivId,
    sourceType: "arxiv",
  })

  return NextResponse.json(paper, { status: 201 })
}
