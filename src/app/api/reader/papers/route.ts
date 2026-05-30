// GET  /api/reader/papers      — list user's papers
// POST /api/reader/papers      — add paper by arXiv ID (or PDF later)

import { NextRequest, NextResponse } from "next/server"
import { resolveAuthAccountContext } from "@/lib/auth-account"
import {
  createReaderPaper,
  getReaderPaperByArxivId,
  listReaderPapers,
} from "@/lib/reader/db"
import { fetchArxivMeta } from "@/lib/reader/arxiv-parser"

export async function GET() {
  const account = await resolveAuthAccountContext()
  const papers = await listReaderPapers(account?.userId ?? null)
  return NextResponse.json(papers)
}

export async function POST(req: NextRequest) {
  const account = await resolveAuthAccountContext()
  const userId = account?.userId ?? null

  const body = await req.json()
  const arxivId = (body.arxivId as string | undefined)?.trim()

  if (!arxivId) {
    return NextResponse.json({ error: "arxivId required" }, { status: 400 })
  }

  // Return existing paper if already added
  const existing = await getReaderPaperByArxivId(arxivId, userId)
  if (existing) return NextResponse.json(existing)

  // Fetch metadata from arXiv
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
