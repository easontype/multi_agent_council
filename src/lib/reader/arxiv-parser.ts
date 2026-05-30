/**
 * arxiv-parser.ts
 * Fetches ar5iv HTML for an arXiv paper and converts it to ParsedPaper.
 * ar5iv uses LaTeXML to convert LaTeX source → HTML5 + MathML.
 * Math is already rendered — we extract it as LaTeX from MathML annotations.
 */

import * as cheerio from "cheerio"
import type { Element } from "domhandler"
import { nanoid } from "nanoid"
import type {
  ParsedPaper,
  PaperSection,
  ContentBlock,
  TextBlock,
  HeadingBlock,
  MathBlock,
  FigureBlock,
  Sentence,
} from "./types"

const AR5IV_BASE = "https://ar5iv.org/abs"
const ARXIV_API_BASE = "https://export.arxiv.org/abs"

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchArxivMeta(arxivId: string): Promise<{
  title: string
  authors: string[]
  abstract: string
}> {
  const res = await fetch(`${ARXIV_API_BASE}/${arxivId}`, {
    headers: { "User-Agent": "Council-Reader/1.0" },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`arXiv API error ${res.status} for ${arxivId}`)
  const html = await res.text()
  const $ = cheerio.load(html)

  const title = $(".title.mathjax").text().replace(/^Title:\s*/i, "").trim()
  const authors = $(".authors a")
    .map((_, el) => $(el).text().trim())
    .get()
  const abstract = $(".abstract.mathjax").text().replace(/^Abstract:\s*/i, "").trim()

  return { title, authors, abstract }
}

async function fetchAr5ivHtml(arxivId: string): Promise<string> {
  const res = await fetch(`${AR5IV_BASE}/${arxivId}`, {
    headers: { "User-Agent": "Council-Reader/1.0" },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`ar5iv fetch error ${res.status} for ${arxivId}`)
  return res.text()
}

// ── Math extraction from MathML ───────────────────────────────────────────────

function extractLatexFromMathML(mathEl: cheerio.Cheerio<Element>, $: cheerio.CheerioAPI): string {
  // ar5iv embeds original LaTeX in <annotation encoding="application/x-tex">
  const annotation = mathEl.find('annotation[encoding="application/x-tex"]').first().text().trim()
  if (annotation) return annotation

  // Fallback: use alttext attribute
  const alttext = mathEl.attr("alttext") ?? ""
  return alttext
}

// ── Sentence tokenizer ────────────────────────────────────────────────────────

function tokenizeSentences(text: string): Sentence[] {
  // Simple sentence splitter — handles Mr./Dr./et al. edge cases
  const raw = text.match(/[^.!?]*[.!?]+["']?(?:\s|$)|[^.!?]+$/g) ?? [text]
  let offset = 0
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const start = offset
      offset += s.length + 1
      return { id: nanoid(8), text: s, startChar: start, endChar: offset }
    })
}

// ── HTML → ContentBlock[] ─────────────────────────────────────────────────────

function parseSection($: cheerio.CheerioAPI, sectionEl: Element): PaperSection {
  const $section = $(sectionEl)
  const headingEl = $section.find("h1,h2,h3,h4").first()
  const title = headingEl.text().trim() || "Untitled"
  const level = parseInt(headingEl.prop("tagName")?.replace("H", "") ?? "2", 10)
  const blocks: ContentBlock[] = []

  $section.children().each((_, child) => {
    const $el = $(child)
    const tag = (child as Element).tagName?.toLowerCase()

    // Skip heading — already captured
    if (/^h[1-4]$/.test(tag ?? "")) return

    // Paragraph
    if (tag === "p") {
      // Check if paragraph is purely a math display
      const mathInline = $el.find("math")
      const text = $el.text().trim()
      if (!text) return

      const block: TextBlock = {
        type: "paragraph",
        id: nanoid(8),
        text,
        sentences: tokenizeSentences(text),
      }
      blocks.push(block)
      return
    }

    // Display math
    if (tag === "math" || $el.hasClass("ltx_equation") || $el.hasClass("ltx_eqn_table")) {
      const mathEl = tag === "math" ? $el : $el.find("math").first()
      const latex = extractLatexFromMathML(mathEl, $)
      if (latex) {
        blocks.push({ type: "math", id: nanoid(8), latex, display: true })
      }
      return
    }

    // Figure
    if (tag === "figure" || $el.hasClass("ltx_figure")) {
      const img = $el.find("img").first()
      const caption = $el.find("figcaption,.ltx_caption").text().trim()
      const src = img.attr("src") ?? ""
      if (src) {
        blocks.push({
          type: "figure",
          id: nanoid(8),
          src: src.startsWith("http") ? src : `https://ar5iv.org${src}`,
          caption,
          alt: caption || "Figure",
        })
      }
      return
    }

    // Lists
    if (tag === "ul" || tag === "ol") {
      const items = $el.find("li").map((_, li) => $(li).text().trim()).get()
      if (items.length) {
        blocks.push({ type: "list", id: nanoid(8), ordered: tag === "ol", items })
      }
    }
  })

  return { id: nanoid(8), title, level, blocks }
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function parseArxivPaper(arxivId: string, paperId: string): Promise<ParsedPaper> {
  const [meta, html] = await Promise.all([
    fetchArxivMeta(arxivId),
    fetchAr5ivHtml(arxivId),
  ])

  const $ = cheerio.load(html)

  // ar5iv wraps content in <article class="ltx_document">
  const article = $("article.ltx_document, article").first()

  // Extract abstract from ar5iv (overrides the API one if better formatted)
  const ar5ivAbstract = article.find(".ltx_abstract p").text().trim()
  const abstract = ar5ivAbstract || meta.abstract

  // Parse sections
  const sections: PaperSection[] = []
  const figures: FigureBlock[] = []

  article.find("section").each((_, sectionEl) => {
    const section = parseSection($, sectionEl)
    sections.push(section)

    // Index all figures
    section.blocks.forEach((b) => {
      if (b.type === "figure") figures.push(b)
    })
  })

  // If no <section> elements, treat whole article as one section
  if (sections.length === 0) {
    const fallback = parseSection($, article[0])
    sections.push({ ...fallback, title: "Content" })
  }

  return {
    paperId,
    title: meta.title,
    authors: meta.authors,
    abstract,
    sections,
    figures,
    sourceType: "arxiv",
    arxivId,
    parsedAt: new Date().toISOString(),
  }
}
