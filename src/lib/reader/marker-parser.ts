/**
 * marker-parser.ts — PDF via Marker API → ParsedPaper
 * Redesigned based on actual Marker output structure.
 *
 * Marker output layout (per analysis of real raw data):
 *   [pre-title images/logos]  → skip (everything before first # h1)
 *   # Title
 *   Author1<sup>a,1</sup>, Author2<sup>b</sup>, ...
 *   <sup>a</sup> Affiliation A
 *   <sup>b</sup> Affiliation B
 *   ## ARTICLE INFO  → extract keywords[], skip section
 *   ## ABSTRACT      → extract abstract, skip section
 *   ## 1. Body sections...
 *     [inline noise: * Corresponding authors., E-mail addresses:, equal contribution]
 *     ![alt](img)
 *     [AI description paragraphs/lists]  → FigureBlock.description
 *     Figure N: [alt text duplicate]     → skip
 *     **Fig. N.** [actual caption]       → FigureBlock.caption
 *   ## Acknowledgements → keep, mark collapsible
 *   ## References       → keep, mark isReferences
 *   ## CRediT / Declaration / Appendix / Data availability → skip
 */

import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { nanoid } from "nanoid"
import type {
  ParsedPaper,
  PaperSection,
  ContentBlock,
  TextBlock,
  MathBlock,
  FigureBlock,
  ListBlock,
  CodeBlock,
  TableBlock,
  AuthorDetail,
  Sentence,
} from "./types"

// ── Constants ─────────────────────────────────────────────────────────────────

const MARKER_API_BASE = "https://www.datalab.to/api/v1/marker"
const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 60

// Sections to skip entirely
const SKIP_SECTION =
  /^(references?|credit|cr[eé]dit\s+authorship|declaration\s+of\s+competing|appendix(\s+\w+)?|supplementary(\s+data)?|data\s+availability|article\s+info)$/i

// Sections to keep but collapse in UI
const COLLAPSIBLE_SECTION = /^acknowledgements?$/i

// Inline noise patterns (page footnotes that Marker embeds in body text)
const NOISE_LINE = [
  /^\*\s*Corresponding authors?/i,
  /^E-mail addresses?:/i,
  /^<sup>\d+<\/sup>\s*(The authors|Equal contribution)/i,
]

// ── Marker API call ───────────────────────────────────────────────────────────

interface MarkerPollResponse {
  status?: string
  markdown?: string
  images?: Record<string, string>
  error?: string
}

async function callMarkerAPI(
  buffer: Buffer
): Promise<{ markdown: string; images: Record<string, string> }> {
  const apiKey = process.env.MARKER_API_KEY
  if (!apiKey) throw new Error("MARKER_API_KEY not set")

  const form = new FormData()
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
    "document.pdf"
  )
  form.append("output_format", "markdown")

  const startRes = await fetch(MARKER_API_BASE, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: form,
  })
  if (!startRes.ok) throw new Error(`Marker API submit failed: ${startRes.status}`)

  const { request_id } = (await startRes.json()) as { request_id?: string }
  if (!request_id) throw new Error("Marker API: missing request_id")

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const pollRes = await fetch(`${MARKER_API_BASE}/${request_id}`, {
      headers: { "X-API-Key": apiKey },
    })
    if (!pollRes.ok) throw new Error(`Marker API poll failed: ${pollRes.status}`)
    const data = (await pollRes.json()) as MarkerPollResponse
    if (data.status === "complete")
      return { markdown: data.markdown ?? "", images: data.images ?? {} }
    if (data.status === "failed")
      throw new Error(data.error ?? "Marker API processing failed")
  }
  throw new Error("Marker API polling timed out")
}

// ── Save images to disk ───────────────────────────────────────────────────────

async function saveMarkerImages(
  paperId: string,
  images: Record<string, string>
): Promise<Record<string, string>> {
  if (!Object.keys(images).length) return {}
  const imagesDir = join(process.cwd(), "uploads", "reader-images", paperId)
  await mkdir(imagesDir, { recursive: true })
  const urlMap: Record<string, string> = {}
  for (const [filename, b64] of Object.entries(images)) {
    const basename = filename.split("/").pop() ?? filename
    await writeFile(join(imagesDir, basename), Buffer.from(b64, "base64"))
    urlMap[filename] = `/api/reader/papers/${paperId}/images/${basename}`
  }
  return urlMap
}

// ── Text cleaning ─────────────────────────────────────────────────────────────

// Unicode subscript/superscript maps for chemical formula conversion
const SUB_MAP: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "a": "ₐ", "e": "ₑ", "i": "ᵢ", "o": "ₒ", "u": "ᵤ", "x": "ₓ",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
}
const SUP_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "n": "ⁿ",
}

function toSub(s: string): string {
  return [...s].map((c) => SUB_MAP[c] ?? c).join("")
}
function toSup(s: string): string {
  return [...s].map((c) => SUP_MAP[c] ?? c).join("")
}

function stripMd(text: string): string {
  return text
    .replace(/<sub>([^<]*)<\/sub>/g, (_, c) => toSub(c))
    .replace(/<sup>([^<]*)<\/sup>/g, (_, c) => toSup(c))
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim()
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function parsePdfViaMarkerAPI(
  buffer: Buffer,
  paperId: string,
  filename: string
): Promise<ParsedPaper> {
  const { markdown, images } = await callMarkerAPI(buffer)
  const imageUrlMap = await saveMarkerImages(paperId, images)

  // Save raw for debugging
  const debugDir = join(process.cwd(), "uploads", "reader-debug", paperId)
  await mkdir(debugDir, { recursive: true })
  await writeFile(join(debugDir, "marker-raw.md"), markdown, "utf-8")

  return markdownToParsedPaper(markdown, imageUrlMap, paperId, filename)
}

// ── Markdown → ParsedPaper ────────────────────────────────────────────────────

export function markdownToParsedPaper(
  markdown: string,
  imageUrlMap: Record<string, string>,
  paperId: string,
  filename: string
): ParsedPaper {
  const lines = markdown.split("\n")

  // Step 1: find first # h1 — skip pre-title zone (journal logos etc.)
  const titleIdx = lines.findIndex((l) => /^#\s+/.test(l))
  if (titleIdx === -1) {
    return buildFallbackPaper(paperId, filename.replace(/\.pdf$/i, ""), lines, imageUrlMap)
  }

  // Step 2: extract title (convert HTML sub/sup to Unicode)
  const title = stripMd(lines[titleIdx].replace(/^#\s+/, ""))

  // Step 3: metadata zone — between h1 and first ##
  const firstSectionIdx =
    lines.findIndex((l, i) => i > titleIdx && /^##\s+/.test(l)) ?? lines.length
  const metaLines = lines.slice(titleIdx + 1, firstSectionIdx === -1 ? lines.length : firstSectionIdx)
  const { authors, authorDetails } = parseAuthorZone(metaLines)

  // Step 4-5: extract ABSTRACT + ARTICLE INFO (keywords) from section stream
  const bodyLines = lines.slice(firstSectionIdx === -1 ? lines.length : firstSectionIdx)
  const { abstract, keywords, remainingLines } = extractMetadataSections(bodyLines)

  // Step 6: build content sections
  const sections = buildSections(remainingLines, imageUrlMap, paperId)

  // Collect figure index
  const figures: FigureBlock[] = []
  for (const s of sections) {
    for (const b of s.blocks) {
      if (b.type === "figure") figures.push(b as FigureBlock)
    }
  }

  return {
    paperId,
    title,
    authors,
    ...(authorDetails.length > 0 && { authorDetails }),
    abstract,
    ...(keywords.length > 0 && { keywords }),
    sections,
    figures,
    sourceType: "pdf",
    parsedAt: new Date().toISOString(),
  }
}

function buildFallbackPaper(
  paperId: string,
  title: string,
  lines: string[],
  imageUrlMap: Record<string, string>
): ParsedPaper {
  return {
    paperId,
    title,
    authors: [],
    abstract: "",
    sections: buildSections(lines, imageUrlMap, paperId),
    figures: [],
    sourceType: "pdf",
    parsedAt: new Date().toISOString(),
  }
}

// ── Author zone parser ────────────────────────────────────────────────────────

function parseAuthorZone(lines: string[]): {
  authors: string[]
  authorDetails: AuthorDetail[]
} {
  // Build affiliation map: single-letter <sup>x</sup> lines
  const affiliationMap: Record<string, string> = {}
  for (const line of lines) {
    const m = line.trim().match(/^<sup>([a-z])<\/sup>\s+(.+)/i)
    if (m) affiliationMap[m[1].toLowerCase()] = stripMd(m[2].trim())
  }

  // Find author line: has <sup> inline but doesn't START with <sup>
  const authorLine = lines.find((line) => {
    const t = line.trim()
    return t.includes("<sup>") && !/^<sup>/.test(t) && /[A-Z][a-z]/.test(t)
  })

  if (!authorLine) return { authors: [], authorDetails: [] }

  // Split on ", " before a capital letter (boundary between authors)
  const entries = authorLine.trim().split(/,\s*(?=[A-Z])/)

  const authors: string[] = []
  const authorDetails: AuthorDetail[] = []

  for (const entry of entries) {
    const supM = entry.match(/<sup>([^<]+)<\/sup>/)
    const rawKeys = supM ? supM[1].split(",").map((k) => k.trim()) : []

    const name = stripMd(entry).trim()
    if (!name || name.length < 2) continue

    const affiliationKeys = rawKeys.filter((k) => /^[a-z]$/i.test(k))
    const isCorresponding = rawKeys.includes("*") || entry.includes("\\*")
    const equalContribution = rawKeys.some((k) => /^\d+$/.test(k))
    const affiliations = affiliationKeys
      .map((k) => affiliationMap[k.toLowerCase()])
      .filter((v): v is string => Boolean(v))

    authors.push(name)
    authorDetails.push({ name, affiliations, isCorresponding, equalContribution })
  }

  return { authors, authorDetails }
}

// ── Metadata section extractor ────────────────────────────────────────────────

function extractMetadataSections(lines: string[]): {
  abstract: string
  keywords: string[]
  remainingLines: string[]
} {
  let abstract = ""
  const keywords: string[] = []
  const remaining: string[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const hm = line.match(/^##\s+(.+)$/)

    if (hm) {
      const sectionTitle = stripMd(hm[1].trim())

      if (/^abstract$/i.test(sectionTitle)) {
        i++
        const absLines: string[] = []
        while (i < lines.length && !/^##\s+/.test(lines[i])) {
          const l = lines[i].trim()
          if (l) absLines.push(stripMd(l))
          i++
        }
        abstract = absLines.join(" ").trim()
        continue
      }

      if (/^article\s+info$/i.test(sectionTitle)) {
        i++
        let inKeywords = false
        while (i < lines.length && !/^##\s+/.test(lines[i])) {
          const l = lines[i].trim()
          if (/^###\s+keywords?/i.test(l)) { inKeywords = true; i++; continue }
          if (/^###/.test(l)) inKeywords = false
          if (inKeywords && l && !l.startsWith("#")) keywords.push(stripMd(l))
          i++
        }
        continue
      }
    }

    remaining.push(line)
    i++
  }

  return { abstract, keywords, remainingLines: remaining }
}

// ── Section builder ───────────────────────────────────────────────────────────

function buildSections(
  lines: string[],
  imageUrlMap: Record<string, string>,
  paperId: string
): PaperSection[] {
  const sections: PaperSection[] = []
  let currentTitle = ""
  let currentLevel = 0
  let currentLines: string[] = []
  let currentCollapsible = false
  let currentIsReferences = false

  function flush() {
    if (!currentLines.length && !currentTitle) return
    const blocks = parseBlocks(currentLines, imageUrlMap, paperId)
    if (currentTitle || blocks.length) {
      sections.push({
        id: nanoid(8),
        title: currentTitle,
        level: currentLevel,
        blocks,
        ...(currentCollapsible && { collapsible: true }),
        ...(currentIsReferences && { isReferences: true }),
      })
    }
    currentLines = []
    currentCollapsible = false
    currentIsReferences = false
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const hm = line.match(/^(#{1,4})\s+(.+)$/)

    if (hm) {
      flush()
      const level = hm[1].length
      const rawTitle = stripMd(hm[2].trim())

      if (SKIP_SECTION.test(rawTitle)) {
        // Consume entire section
        i++
        while (i < lines.length) {
          const nextHm = lines[i].match(/^(#{1,4})\s+/)
          if (nextHm && nextHm[1].length <= level) break
          i++
        }
        continue
      }

      currentLevel = level
      currentTitle = rawTitle
      currentCollapsible = COLLAPSIBLE_SECTION.test(rawTitle)
      currentIsReferences = /^references?$/i.test(rawTitle)
    } else {
      currentLines.push(line)
    }
    i++
  }
  flush()

  return sections.filter((s) => s.title || s.blocks.length > 0)
}

// ── Block parser ──────────────────────────────────────────────────────────────

function parseBlocks(
  lines: string[],
  imageUrlMap: Record<string, string>,
  _paperId: string
): ContentBlock[] {
  const blocks: ContentBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line
    if (!line.trim()) { i++; continue }

    // Inline noise (footnotes Marker embeds in body)
    if (NOISE_LINE.some((p) => p.test(line.trim()))) {
      while (i < lines.length && lines[i].trim()) i++
      continue
    }

    // Block math $$ ... $$
    if (line.trim() === "$$") {
      const mathLines: string[] = []
      i++
      while (i < lines.length && lines[i].trim() !== "$$") { mathLines.push(lines[i]); i++ }
      i++
      if (mathLines.length)
        blocks.push({ type: "math", id: nanoid(8), latex: mathLines.join("\n"), display: true } as MathBlock)
      continue
    }

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) { codeLines.push(lines[i]); i++ }
      i++
      if (codeLines.length)
        blocks.push({ type: "code", id: nanoid(8), language: lang || "text", content: codeLines.join("\n") } as CodeBlock)
      continue
    }

    // Figure ![alt](src)
    const figM = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (figM) {
      const altRaw = figM[1].trim()
      const rawSrc = figM[2]

      // Skip empty-alt images (equation diagrams already covered by MathBlock)
      if (!altRaw) { i++; continue }

      const src = imageUrlMap[rawSrc] ?? rawSrc
      const altStripped = stripMd(altRaw)
      let caption = altStripped
      let consumeUpTo = i + 1
      const descLines: string[] = []
      let pastFigureNLine = false

      let j = i + 1
      while (j < lines.length && j < i + 45) {
        const l = lines[j].trim()

        // Hard stop: another image or heading
        if ((l.startsWith("![") && j > i + 1) || /^#{1,4}\s/.test(l)) break

        // Actual paper caption: **Fig. N.** or plain Fig. N.
        if (/^\*\*Fig[.\s]/.test(l) || /^Fig\.\s*\d+\./.test(l)) {
          caption = stripMd(l)
          consumeUpTo = j + 1
          break
        }

        // Alt-text duplicate line: Figure N: ... → consume but discard
        if (/^Figure\s+\d+:/.test(l)) {
          pastFigureNLine = true
          consumeUpTo = j + 1
          j++
          continue
        }

        // Collect AI description (before the Figure N: duplicate line)
        if (l && !pastFigureNLine) descLines.push(l)

        j++
      }

      const description = descLines.length
        ? descLines.map((l) => stripMd(l)).join(" ").trim()
        : undefined

      blocks.push({
        type: "figure",
        id: nanoid(8),
        src,
        caption,
        alt: altStripped,
        ...(description && { description }),
      } as FigureBlock)

      i = consumeUpTo
      continue
    }

    // Markdown table
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i]); i++ }
      const tbl = parseMarkdownTable(tableLines)
      if (tbl) blocks.push(tbl)
      continue
    }

    // Ordered or unordered list
    if (/^[-*+]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const ordered = /^\d+\.\s/.test(line)
      const items: string[] = []
      while (
        i < lines.length &&
        (ordered ? /^\d+\.\s/.test(lines[i]) : /^[-*+]\s/.test(lines[i]))
      ) {
        items.push(stripMd(lines[i].replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "")))
        i++
      }
      if (items.length) blocks.push({ type: "list", id: nanoid(8), ordered, items } as ListBlock)
      continue
    }

    // Paragraph: collect until blank / structural break
    const paraLines: string[] = []
    while (i < lines.length) {
      const l = lines[i]
      if (!l.trim()) break
      if (l.trim() === "$$") break
      if (l.trim().startsWith("```")) break
      if (l.trim().startsWith("![")) break
      if (/^#{1,4}\s/.test(l.trim())) break
      if (l.trim().startsWith("|")) break
      if (NOISE_LINE.some((p) => p.test(l.trim()))) break
      paraLines.push(l)
      i++
    }

    if (paraLines.length) {
      const text = stripMd(paraLines.join(" ").trim())
      if (text.length > 10) {
        blocks.push({
          type: "paragraph",
          id: nanoid(8),
          text,
          sentences: tokenizeSentences(text),
        } as TextBlock)
      }
    }
  }

  return mergeFragmentedParagraphs(blocks)
}

// ── Table parser ──────────────────────────────────────────────────────────────

function parseMarkdownTable(tableLines: string[]): TableBlock | null {
  if (tableLines.length < 2) return null
  const parseRow = (line: string): string[] =>
    line.split("|").slice(1, -1).map((cell) => stripMd(cell.trim()))
  const isSep = (line: string) => /^\|[\s\-|:]+\|$/.test(line.trim())
  if (!isSep(tableLines[1])) return null
  const headers = parseRow(tableLines[0])
  const rows = tableLines.slice(2).map(parseRow).filter((r) => r.some((c) => c.length > 0))
  return { type: "table", id: nanoid(8), headers, rows }
}

// ── Column-break paragraph merger ─────────────────────────────────────────────

function mergeFragmentedParagraphs(blocks: ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = []
  for (const block of blocks) {
    const prev = result[result.length - 1]
    if (
      block.type === "paragraph" &&
      prev?.type === "paragraph" &&
      !/[.!?:]\s*$/.test(prev.text.trimEnd())
    ) {
      const merged = prev.text.trimEnd() + " " + block.text.trimStart()
      result[result.length - 1] = {
        ...prev,
        text: merged,
        sentences: tokenizeSentences(merged),
      }
    } else {
      result.push(block)
    }
  }
  return result
}

// ── Math-safe sentence tokenizer ──────────────────────────────────────────────

function tokenizeSentences(text: string): Sentence[] {
  // Mask $...$ so internal punctuation (e.g. 0.25 in $L = 0.25$) isn't split on
  const placeholders: string[] = []
  const masked = text.replace(/\$[^$\n]+\$/g, (m) => {
    placeholders.push(m)
    return `\x02${placeholders.length - 1}\x03`
  })
  const parts = masked.match(/[^.!?]*[.!?]+["']?(?=\s|$)|[^.!?]+$/g) ?? [masked]
  let offset = 0
  return parts
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
    .map((s) => {
      const restored = s.replace(/\x02(\d+)\x03/g, (_, idx) => placeholders[Number(idx)] ?? "")
      const start = offset
      offset += restored.length + 1
      return { id: nanoid(8), text: restored, startChar: start, endChar: offset }
    })
}
