/**
 * pdf-parser.ts
 * Converts a PDF Buffer into ParsedPaper using pdf-parse for text extraction.
 * Images and semantic math are deferred to a later phase.
 * Sections are detected by heuristics (numbered headings, ALL CAPS lines).
 */

import { nanoid } from "nanoid"
import type {
  ParsedPaper,
  PaperSection,
  ContentBlock,
  TextBlock,
  Sentence,
} from "./types"

// ── Sentence tokenizer ────────────────────────────────────────────────────────

function tokenizeSentences(text: string): Sentence[] {
  const parts = text.match(/[^.!?]*[.!?]+["']?(?=\s|$)|[^.!?]+$/g) ?? [text]
  let offset = 0
  return parts
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
    .map((s) => {
      const start = offset
      offset += s.length + 1
      return { id: nanoid(8), text: s, startChar: start, endChar: offset }
    })
}

// ── Heading detection ─────────────────────────────────────────────────────────

// Matches: "1 Introduction", "2.3 Methods", "A. Appendix", "ABSTRACT"
const NUMBERED_HEADING = /^(\d+(\.\d+)*\.?\s+|[A-Z]\.\s+)[A-Z][a-zA-Z\s]{2,60}$/
const ALLCAPS_HEADING = /^[A-Z][A-Z\s\-:]{4,50}$/

function detectHeadingLevel(line: string): 1 | 2 | 3 | null {
  const trimmed = line.trim()
  if (ALLCAPS_HEADING.test(trimmed) && trimmed.length < 40) return 1
  if (/^\d+\s+[A-Z]/.test(trimmed)) return 2
  if (/^\d+\.\d+\s+[A-Z]/.test(trimmed)) return 3
  if (/^[A-Z]\.\s+[A-Z]/.test(trimmed)) return 2
  return null
}

// ── Math line detection ───────────────────────────────────────────────────────

function looksLikeMath(line: string): boolean {
  return /\\[a-zA-Z]+|[∑∫∂∇αβγδεζηθλμπρσφψω≤≥≠±∞→←]|\$[^$]+\$/.test(line)
}

// ── Parse raw text into blocks ────────────────────────────────────────────────

function parseTextToBlocks(rawText: string): ContentBlock[] {
  // pdf-parse joins lines with \n; paragraphs are separated by \n\n or more
  const paragraphs = rawText
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 10)

  const blocks: ContentBlock[] = []

  for (const para of paragraphs) {
    const headingLevel = detectHeadingLevel(para)
    if (headingLevel) {
      blocks.push({ type: "heading", id: nanoid(8), level: headingLevel, text: para.trim() })
      continue
    }

    if (looksLikeMath(para) && para.length < 200) {
      // Treat short math-looking lines as display math (best effort)
      blocks.push({ type: "math", id: nanoid(8), latex: para, display: true })
      continue
    }

    const block: TextBlock = {
      type: "paragraph",
      id: nanoid(8),
      text: para,
      sentences: tokenizeSentences(para),
    }
    blocks.push(block)
  }

  return blocks
}

// ── Group blocks into sections ────────────────────────────────────────────────

function groupIntoSections(blocks: ContentBlock[]): PaperSection[] {
  const sections: PaperSection[] = []
  let current: PaperSection = { id: nanoid(8), title: "Introduction", level: 1, blocks: [] }

  for (const block of blocks) {
    if (block.type === "heading" && block.level <= 2) {
      if (current.blocks.length > 0) sections.push(current)
      current = { id: nanoid(8), title: block.text, level: block.level, blocks: [] }
    } else {
      current.blocks.push(block)
    }
  }
  if (current.blocks.length > 0) sections.push(current)
  return sections.length > 0 ? sections : [current]
}

// ── Extract abstract ──────────────────────────────────────────────────────────

function extractAbstract(text: string): string {
  const match = text.match(/abstract\s*\n+([\s\S]{100,1500}?)(?=\n{2,}|\d+\s+introduction|introduction\s*\n)/i)
  return match?.[1]?.replace(/\n/g, " ").trim() ?? ""
}

// ── Extract title (first non-empty line heuristic) ────────────────────────────

function extractTitle(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  // Title is often the longest line in the first 10
  const candidates = lines.slice(0, 10).filter((l) => l.length > 10 && l.length < 200)
  return candidates[0] ?? "Untitled"
}

// ── Text extraction: pdfjs-dist primary, pdf-parse fallback ──────────────────

async function extractTextWithPdfjs(buffer: Buffer): Promise<string> {
  // Dynamic import avoids SSR/worker config issues
  const pdfjs = await import("pdfjs-dist")
  // No workerSrc needed in Node.js — runs in main thread
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    verbosity: 0,
  }).promise

  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
    pages.push(text)
  }
  return pages.join("\n\n")
}

async function extractRawText(buffer: Buffer): Promise<string> {
  try {
    return await extractTextWithPdfjs(buffer)
  } catch {
    try {
      const pdfParse = (await import("pdf-parse")).default
      const data = await pdfParse(buffer, { max: 0 })
      return data.text
    } catch {
      // Both extractors failed (e.g. invalid Unicode in PDF metadata).
      // Return empty string — canvas rendering still works without text.
      return ""
    }
  }
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function parsePdfBuffer(
  buffer: Buffer,
  paperId: string,
  filename?: string
): Promise<ParsedPaper> {
  const rawText = await extractRawText(buffer)

  const title = extractTitle(rawText) || filename?.replace(/\.pdf$/i, "") || "Untitled"
  const abstract = extractAbstract(rawText)
  const allBlocks = parseTextToBlocks(rawText)
  const sections = groupIntoSections(allBlocks)

  return {
    paperId,
    title,
    authors: [],      // pdf-parse doesn't reliably extract authors
    abstract,
    sections,
    figures: [],      // image extraction is phase 2
    sourceType: "pdf",
    parsedAt: new Date().toISOString(),
  }
}
