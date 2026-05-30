/**
 * pdf-parser.ts
 * Calls scripts/pdf_extract.py (PyMuPDF) via subprocess to extract
 * text blocks and images from a PDF, then maps the result to ParsedPaper.
 */

import { execFile } from "child_process"
import { promisify } from "util"
import { join } from "path"
import { nanoid } from "nanoid"
import type {
  ParsedPaper,
  PaperSection,
  ContentBlock,
  TextBlock,
  FigureBlock,
  CaptionBlock,
  Sentence,
} from "./types"

const execFileAsync = promisify(execFile)

// ── Subprocess call ───────────────────────────────────────────────────────────

interface PyElement {
  type: "text" | "image"
  page: number
  // text fields
  text?: string
  fontSize?: number
  isBold?: boolean
  role?: "heading1" | "heading2" | "paragraph" | "caption"
  bbox?: number[]
  // image fields
  filename?: string
  width?: number
  height?: number
}

interface PyResult {
  elements: PyElement[]
  pageCount: number
  medianFontSize: number
  error?: string
}

export async function runPyExtract(pdfPath: string, imagesDir: string): Promise<PyResult> {
  const scriptPath = join(process.cwd(), "scripts", "pdf_extract.py")

  const { stdout } = await execFileAsync("python", [scriptPath, pdfPath, imagesDir], {
    maxBuffer: 50 * 1024 * 1024,
    timeout: 60_000,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  })

  const result = JSON.parse(stdout) as PyResult
  if (result.error) throw new Error(result.error)
  return result
}

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

// ── Split elements at Abstract boundary ──────────────────────────────────────

// Skip metadata lines when extracting abstract text
const SKIP_ABSTRACT_LINE = /^(keywords?|article info|received|accepted|available|communicated|doi:|highlights?|handling editor)[:\s]/i

// Matches the start of a real paper section — optional number prefix (e.g. "1.", "1 ", "I.")
const SECTION_KW_RE = /^(?:\d+(?:\.\d+)*[.\s]+|[IVX]+\.\s+)?(introduction|background|related work|methods?|materials?|results?|discussion|conclusion|experiments?|overview|motivation)\b/i

function splitAtAbstract(elements: PyElement[]): {
  preElements: PyElement[]
  abstract: string
  midHeadings: PyElement[]
  contentElements: PyElement[]
} {
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].type !== "text") continue
    const text = (elements[i].text ?? "").trim()

    // Normalize spaced-letter format: "A B S T R A C T" → "ABSTRACT"
    const normalized = text.replace(/\s+/g, "").toLowerCase()
    const isAbstractHeading =
      normalized === "abstract" ||
      /^abstract[\s:—–-]/i.test(text)

    if (!isAbstractHeading) continue

    // Find the first real section heading (Introduction, Methods, etc.) — not just any heading1
    const firstSectionIdx = elements.findIndex(
      (e, idx) =>
        idx > i &&
        e.type === "text" &&
        e.role === "heading1" &&
        SECTION_KW_RE.test((e.text ?? "").trim())
    )

    // Fallback: if no section keyword matched, use the first heading1 (original behavior)
    const firstHeadingIdx = firstSectionIdx !== -1
      ? firstSectionIdx
      : elements.findIndex((e, idx) => idx > i && e.type === "text" && e.role === "heading1")

    // heading1 blocks between abstract and first section (Elsevier paper title lives here)
    const midHeadings = firstSectionIdx !== -1
      ? elements.slice(i + 1, firstSectionIdx).filter((e) => e.role === "heading1")
      : []

    // For inline "Abstract: text..." capture the inline text
    const inlineMatch = text.match(/^abstract[\s:—–-]+(.{20,})/i)
    if (inlineMatch) {
      return {
        preElements: elements.slice(0, i),
        abstract: inlineMatch[1].trim(),
        midHeadings,
        contentElements: firstHeadingIdx !== -1 ? elements.slice(firstHeadingIdx) : [],
      }
    }

    // Standalone "Abstract" heading — gather abstract text until content start
    const endIdx = firstHeadingIdx !== -1 ? firstHeadingIdx : elements.length
    const abstractText = elements
      .slice(i + 1, endIdx)
      .filter(
        (e) =>
          e.type === "text" &&
          !SKIP_ABSTRACT_LINE.test((e.text ?? "").trim()) &&
          (e.text ?? "").trim().length > 30
      )
      .map((e) => e.text)
      .join(" ")
      .trim()

    return {
      preElements: elements.slice(0, i),
      abstract: abstractText,
      midHeadings,
      contentElements: firstHeadingIdx !== -1 ? elements.slice(firstHeadingIdx) : [],
    }
  }

  // No abstract found — treat all as content
  return { preElements: [], abstract: "", midHeadings: [], contentElements: elements }
}

// ── Extract metadata from pre-abstract elements ───────────────────────────────

function extractMetaFromPre(
  elements: PyElement[],
  medianSize: number
): { title: string; authors: string[]; journal: string; publishedDate: string } {
  const textEls = elements.filter(
    (e): e is PyElement & { text: string } => e.type === "text" && !!e.text?.trim()
  )

  // Title = largest font block
  const titleEl = [...textEls].sort((a, b) => (b.fontSize ?? 0) - (a.fontSize ?? 0))[0]
  const title = titleEl?.text.trim() ?? ""

  // Authors = comma-separated name pattern (mix of capitalized words + initials)
  // Appears after the title, before affiliations
  const nameRe = /^[A-Z][a-z][\w\s\.À-ɏ]+(,\s*[A-Z][\w])/
  const authorEl = textEls.find((e) => e !== titleEl && nameRe.test(e.text.trim()))
  let authors: string[] = []
  if (authorEl) {
    // Split on comma followed by uppercase — handles "Smith J., Jones A.B."
    authors = authorEl.text
      .split(/,(?=\s*[A-Z])/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  // Journal = block containing known publisher/journal keywords
  const journalRe =
    /journal|review|letters?|proceedings|transactions|nature|science|plos|elsevier|springer|wiley|IEEE|ACS|RSC/i
  const journalEl = textEls.find((e) => journalRe.test(e.text))
  const journal = journalEl?.text.trim() ?? ""

  // Date = year from a line with publication context keywords, or just first year found
  const yearRe = /\b(19|20)\d{2}\b/
  const dateEl =
    textEls.find((e) =>
      /(©|received|accepted|published|volume|vol\.|issue)/i.test(e.text)
    ) ?? textEls.find((e) => yearRe.test(e.text))
  const publishedDate = (dateEl?.text ?? "").match(yearRe)?.[0] ?? ""

  return { title, authors, journal, publishedDate }
}

// ── Element → ContentBlock ────────────────────────────────────────────────────

function elementToBlock(el: PyElement, imageUrlBase: string): ContentBlock | null {
  if (el.type === "image" && el.filename) {
    const block: FigureBlock = {
      type: "figure",
      id: nanoid(8),
      src: `${imageUrlBase}/${el.filename}`,
      caption: "",
      alt: el.filename,
      width: el.width,
      height: el.height,
    }
    return block
  }

  if (el.type === "text" && el.text) {
    if (el.role === "heading1" || el.role === "heading2") {
      return {
        type: "heading",
        id: nanoid(8),
        level: el.role === "heading1" ? 2 : 3,
        text: el.text,
      }
    }

    if (el.role === "caption") {
      return {
        type: "caption",
        id: nanoid(8),
        text: el.text,
      }
    }

    const block: TextBlock = {
      type: "paragraph",
      id: nanoid(8),
      text: el.text,
      sentences: tokenizeSentences(el.text),
    }
    return block
  }

  return null
}

// ── Attach captions to adjacent figure blocks ─────────────────────────────────

function attachCaptions(blocks: ContentBlock[]): ContentBlock[] {
  const out: ContentBlock[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.type === "caption") {
      // Try to attach to the immediately preceding figure
      const prev = out[out.length - 1]
      if (prev?.type === "figure" && !prev.caption) {
        prev.caption = block.text
        continue
      }
      // Try to attach to the immediately following figure
      const next = blocks[i + 1]
      if (next?.type === "figure") {
        // peek-ahead: skip this caption, let the figure be pushed, then attach
        out.push(next)
        ;(out[out.length - 1] as FigureBlock).caption = block.text
        i++ // consume the figure too
        continue
      }
      // No adjacent figure — keep as plain paragraph so it's not lost
      out.push({ type: "paragraph", id: block.id, text: block.text, sentences: tokenizeSentences(block.text) } as TextBlock)
      continue
    }
    out.push(block)
  }
  return out
}

// ── References section: drop blocks that don't look like citation entries ─────

const REF_ENTRY_RE = /^\[?\d+\]?[\.\s]|^\d{1,3}\.\s+[A-Z]/

function cleanReferencesSection(sections: PaperSection[]): PaperSection[] {
  return sections.map((section) => {
    const isRefs = /^references?$|^bibliography$/i.test(section.title.trim())
    if (!isRefs) return section
    return {
      ...section,
      blocks: section.blocks.filter((b) => {
        if (b.type === "figure") return false  // no images in References
        if (b.type !== "paragraph") return true
        // Keep only blocks that start like a citation entry
        return REF_ENTRY_RE.test(b.text.trim())
      }),
    }
  })
}

// ── Group blocks into sections ────────────────────────────────────────────────

function groupIntoSections(blocks: ContentBlock[]): PaperSection[] {
  const sections: PaperSection[] = []
  let current: PaperSection = { id: nanoid(8), title: "Content", level: 1, blocks: [] }

  for (const block of blocks) {
    if (block.type === "heading" && block.level <= 2) {
      if (current.blocks.length > 0) sections.push(current)
      current = { id: nanoid(8), title: block.text, level: block.level, blocks: [] }
    } else {
      current.blocks.push(block)
    }
  }
  if (current.blocks.length > 0 || sections.length === 0) sections.push(current)
  return sections
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function parsePdfBuffer(
  _buffer: Buffer,
  paperId: string,
  pdfPath: string,
  filename?: string
): Promise<ParsedPaper> {
  const imagesDir = join(process.cwd(), "uploads", "reader-images", paperId)
  const imageUrlBase = `/api/reader/papers/${paperId}/images`

  const result = await runPyExtract(pdfPath, imagesDir)

  const { preElements, abstract, midHeadings, contentElements } = splitAtAbstract(result.elements)

  const { title: metaTitle, authors, journal, publishedDate } = extractMetaFromPre(
    preElements,
    result.medianFontSize
  )

  // Prefer heading1 elements between abstract and first section (e.g. Elsevier paper title)
  const title = midHeadings.length > 0
    ? (midHeadings[0].text?.trim() ?? metaTitle)
    : metaTitle

  const rawBlocks: ContentBlock[] = contentElements
    .map((el) => elementToBlock(el, imageUrlBase))
    .filter((b): b is ContentBlock => b !== null)

  const blocks = attachCaptions(rawBlocks)

  const figures = blocks.filter((b): b is FigureBlock => b.type === "figure")
  let sections = cleanReferencesSection(groupIntoSections(blocks))

  // ── Elsevier layout fix ───────────────────────────────────────────────────
  // In some Elsevier PDFs the two-column sort places the paper title and actual
  // abstract (right/wide column) after the Introduction (left narrow column).
  // Detect this: title looks like a journal citation OR abstract is very short.
  // If so, find the first non-section heading1 section and extract real metadata.
  const JOURNAL_CITATION_RE = /\d+\s*\(\d{4}\)\s*\d+[-–—]\d+/
  let finalTitle = title
  let finalAbstract = abstract

  if (JOURNAL_CITATION_RE.test(title) || abstract.trim().length < 100) {
    const metaSecIdx = sections.findIndex(
      (s) =>
        !SECTION_KW_RE.test(s.title.trim()) &&
        !/^(content|ceramics|journal|nature|science|elsevier|springer|wiley)/i.test(s.title.trim()) &&
        s.title.trim().length > 20
    )
    if (metaSecIdx !== -1) {
      const metaSec = sections[metaSecIdx]
      finalTitle = metaSec.title.trim()
      const absBlock = metaSec.blocks.find(
        (b): b is TextBlock => b.type === "paragraph" && b.text.trim().length > 80
      )
      if (absBlock) finalAbstract = absBlock.text.trim()
      sections = sections.filter((_, i) => i !== metaSecIdx)
    }
  }

  return {
    paperId,
    title: finalTitle || filename?.replace(/\.pdf$/i, "") || "Untitled",
    authors,
    abstract: finalAbstract,
    journal: journal || undefined,
    publishedDate: publishedDate || undefined,
    sections,
    figures,
    sourceType: "pdf",
    parsedAt: new Date().toISOString(),
  }
}
