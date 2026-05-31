/**
 * marker-parser.ts
 * Calls Marker API (datalab.to) to convert PDF → Markdown,
 * then maps the result to ParsedPaper for the Reader.
 */

import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { nanoid } from "nanoid"
import type {
  ParsedPaper,
  PaperSection,
  ContentBlock,
  TextBlock,
  HeadingBlock,
  MathBlock,
  FigureBlock,
  ListBlock,
  CodeBlock,
  Sentence,
} from "./types"

const MARKER_API_BASE = "https://www.datalab.to/api/v1/marker"
const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 60 // 3 min max

// ── API call ──────────────────────────────────────────────────────────────────

interface MarkerPollResponse {
  status?: string
  markdown?: string
  images?: Record<string, string> // filename → base64
  error?: string
}

async function callMarkerAPI(
  buffer: Buffer
): Promise<{ markdown: string; images: Record<string, string> }> {
  const apiKey = process.env.MARKER_API_KEY
  if (!apiKey) throw new Error("MARKER_API_KEY not set")

  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), "document.pdf")
  form.append("output_format", "markdown")

  const startRes = await fetch(MARKER_API_BASE, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: form,
  })
  if (!startRes.ok) throw new Error(`Marker API submit failed: ${startRes.status}`)

  const { request_id } = (await startRes.json()) as { request_id?: string }
  if (!request_id) throw new Error("Marker API: missing request_id")

  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

    const pollRes = await fetch(`${MARKER_API_BASE}/${request_id}`, {
      headers: { "X-API-Key": apiKey },
    })
    if (!pollRes.ok) throw new Error(`Marker API poll failed: ${pollRes.status}`)

    const data = (await pollRes.json()) as MarkerPollResponse
    if (data.status === "complete") {
      return { markdown: data.markdown ?? "", images: data.images ?? {} }
    }
    if (data.status === "failed") {
      throw new Error(data.error ?? "Marker API processing failed")
    }
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
    const dest = join(imagesDir, basename)
    await writeFile(dest, Buffer.from(b64, "base64"))
    urlMap[filename] = `/api/reader/papers/${paperId}/images/${basename}`
  }
  return urlMap
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function parsePdfViaMarkerAPI(
  buffer: Buffer,
  paperId: string,
  filename: string
): Promise<ParsedPaper> {
  const { markdown, images } = await callMarkerAPI(buffer)
  const imageUrlMap = await saveMarkerImages(paperId, images)
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

  // Title: first h1
  let title = filename.replace(/\.pdf$/i, "")
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)$/)
    if (m) { title = stripMd(m[1]); break }
  }

  // Authors: look for bold "Authors:" pattern or "^by " line
  let authors: string[] = []
  for (const line of lines) {
    const m = line.match(/^\*\*Authors?:?\*\*\s*(.+)/i) ?? line.match(/^Authors?:\s*(.+)/i)
    if (m) {
      authors = m[1].split(/[,;]/).map((s) => stripMd(s).trim()).filter(Boolean)
      break
    }
  }

  // Build sections by splitting on headings
  const sections = buildSections(lines, imageUrlMap, paperId)

  // Extract abstract section
  let abstract = ""
  const absIdx = sections.findIndex((s) => /^abstract$/i.test(s.title.trim()))
  if (absIdx !== -1) {
    abstract = sections[absIdx].blocks
      .filter((b): b is TextBlock => b.type === "paragraph")
      .map((b) => b.text)
      .join(" ")
      .trim()
    sections.splice(absIdx, 1)
  }

  // Remove References section (noisy for reader)
  const refIdx = sections.findIndex((s) => /^references?$/i.test(s.title.trim()))
  if (refIdx !== -1) sections.splice(refIdx, 1)

  // Collect all figures for the sidebar index
  const figures: FigureBlock[] = []
  for (const s of sections) {
    for (const b of s.blocks) {
      if (b.type === "figure") figures.push(b)
    }
  }

  return {
    paperId,
    title,
    authors,
    abstract,
    sections,
    figures,
    sourceType: "pdf",
    parsedAt: new Date().toISOString(),
  }
}

// ── Section builder ───────────────────────────────────────────────────────────

function buildSections(
  lines: string[],
  imageUrlMap: Record<string, string>,
  paperId: string
): PaperSection[] {
  const sections: PaperSection[] = []
  let currentLines: string[] = []
  let currentTitle = ""
  let currentLevel = 0

  function flush() {
    if (!currentLines.length && !currentTitle) return
    const blocks = parseBlocks(currentLines, imageUrlMap, paperId)
    if (currentTitle || blocks.length) {
      sections.push({ id: nanoid(8), title: currentTitle, level: currentLevel, blocks })
    }
    currentLines = []
  }

  for (const line of lines) {
    const hm = line.match(/^(#{1,4})\s+(.+)$/)
    if (hm) {
      flush()
      currentLevel = hm[1].length
      currentTitle = stripMd(hm[2].trim())
    } else {
      currentLines.push(line)
    }
  }
  flush()

  return sections.filter((s) => s.title || s.blocks.length > 0)
}

// ── Block parser ──────────────────────────────────────────────────────────────

function parseBlocks(
  lines: string[],
  imageUrlMap: Record<string, string>,
  paperId: string
): ContentBlock[] {
  const blocks: ContentBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line
    if (!line.trim()) { i++; continue }

    // Block math $$ ... $$
    if (line.trim() === "$$") {
      const mathLines: string[] = []
      i++
      while (i < lines.length && lines[i].trim() !== "$$") {
        mathLines.push(lines[i]); i++
      }
      i++ // closing $$
      if (mathLines.length) {
        blocks.push({ type: "math", id: nanoid(8), latex: mathLines.join("\n"), display: true } as MathBlock)
      }
      continue
    }

    // Fenced code block ```
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]); i++
      }
      i++ // closing ```
      if (codeLines.length) {
        blocks.push({ type: "code", id: nanoid(8), language: lang || "text", content: codeLines.join("\n") } as CodeBlock)
      }
      continue
    }

    // Figure ![alt](src)
    const figM = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (figM) {
      const alt = figM[1]
      const rawSrc = figM[2]
      const src = imageUrlMap[rawSrc] ?? rawSrc
      // Next non-empty line as caption if it looks like a figure caption
      let caption = alt
      const nextLine = lines[i + 1]?.trim() ?? ""
      if (/^(figure|fig\.?|table)\s*\d*[:.]?\s+/i.test(nextLine) || /^\*\*fig/i.test(nextLine)) {
        caption = stripMd(nextLine)
        i++
      }
      blocks.push({ type: "figure", id: nanoid(8), src, caption, alt } as FigureBlock)
      i++
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
      blocks.push({ type: "list", id: nanoid(8), ordered, items } as ListBlock)
      continue
    }

    // Paragraph: collect until blank line or special token
    const paraLines: string[] = []
    while (i < lines.length) {
      const l = lines[i]
      if (!l.trim()) break
      if (l.trim() === "$$") break
      if (l.trim().startsWith("```")) break
      if (l.trim().match(/^!\[/)) break
      if (l.trim().match(/^#{1,4}\s/)) break
      paraLines.push(l)
      i++
    }
    if (paraLines.length) {
      const raw = paraLines.join(" ").trim()
      const text = stripMd(raw)
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

  return blocks
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim()
}

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
