/**
 * reader/db.ts — DB helpers for the paper reader.
 * Tables are created on first call (idempotent, like council-db.ts).
 */

import { db } from "@/lib/db/db"
import { nanoid } from "nanoid"
import type { ReaderPaper, ParsedPaper } from "./types"

// ── Schema ────────────────────────────────────────────────────────────────────

export async function ensureReaderSchema(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS reader_papers (
      id            TEXT PRIMARY KEY,
      user_id       TEXT,
      title         TEXT NOT NULL DEFAULT '',
      authors       JSONB NOT NULL DEFAULT '[]',
      abstract      TEXT NOT NULL DEFAULT '',
      arxiv_id      TEXT,
      source_type   TEXT NOT NULL DEFAULT 'arxiv',
      pdf_url       TEXT,
      content_json  JSONB,
      parsed_at     TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_reader_papers_user ON reader_papers(user_id);
    CREATE INDEX IF NOT EXISTS idx_reader_papers_arxiv ON reader_papers(arxiv_id);
  `)
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createReaderPaper(opts: {
  userId: string | null
  title: string
  authors: string[]
  abstract: string
  arxivId?: string
  sourceType: "arxiv" | "pdf"
  pdfUrl?: string
}): Promise<ReaderPaper> {
  await ensureReaderSchema()
  const id = nanoid()
  const res = await db.query(
    `INSERT INTO reader_papers (id, user_id, title, authors, abstract, arxiv_id, source_type, pdf_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, opts.userId, opts.title, JSON.stringify(opts.authors), opts.abstract,
     opts.arxivId ?? null, opts.sourceType, opts.pdfUrl ?? null]
  )
  return rowToReaderPaper(res.rows[0])
}

export async function getReaderPaper(paperId: string): Promise<ReaderPaper | null> {
  await ensureReaderSchema()
  const res = await db.query(
    `SELECT * FROM reader_papers WHERE id = $1`,
    [paperId]
  )
  return res.rows[0] ? rowToReaderPaper(res.rows[0]) : null
}

export async function getReaderPaperByArxivId(arxivId: string, userId: string | null): Promise<ReaderPaper | null> {
  await ensureReaderSchema()
  const res = await db.query(
    `SELECT * FROM reader_papers WHERE arxiv_id = $1 AND (user_id = $2 OR user_id IS NULL) LIMIT 1`,
    [arxivId, userId]
  )
  return res.rows[0] ? rowToReaderPaper(res.rows[0]) : null
}

export async function listReaderPapers(userId: string | null): Promise<ReaderPaper[]> {
  await ensureReaderSchema()
  const res = await db.query(
    `SELECT * FROM reader_papers WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [userId]
  )
  return res.rows.map(rowToReaderPaper)
}

export async function saveReaderPaperContent(paperId: string, content: ParsedPaper): Promise<void> {
  await db.query(
    `UPDATE reader_papers SET content_json = $1, parsed_at = NOW() WHERE id = $2`,
    [JSON.stringify(content), paperId]
  )
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function rowToReaderPaper(row: Record<string, unknown>): ReaderPaper {
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? null,
    title: row.title as string,
    authors: (row.authors as string[]) ?? [],
    abstract: row.abstract as string,
    arxivId: (row.arxiv_id as string) ?? null,
    sourceType: (row.source_type as "arxiv" | "pdf") ?? "arxiv",
    pdfUrl: (row.pdf_url as string) ?? null,
    contentJson: (row.content_json as ParsedPaper) ?? null,
    parsedAt: (row.parsed_at as string) ?? null,
    createdAt: row.created_at as string,
  }
}
