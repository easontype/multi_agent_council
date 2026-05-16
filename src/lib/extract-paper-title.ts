/**
 * Extracts the paper title from raw PDF text by scanning for arXiv IDs or DOIs,
 * then querying authoritative APIs. Falls back to null (caller uses filename).
 */

// arXiv IDs appear as "arXiv:2401.12345" or "arXiv:2401.12345v2"
const ARXIV_ID_RE = /arXiv[:\s]+(\d{4}\.\d{4,5}(?:v\d+)?)/i

// DOIs start with 10. — match conservatively to avoid false positives
const DOI_RE = /\b(10\.\d{4,}\/[^\s"'<>[\](),;:]+)/

export async function extractPaperTitleFromText(text: string): Promise<string | null> {
  const sample = text.slice(0, 3000)

  // 1. arXiv ID — highest confidence
  const arxivMatch = sample.match(ARXIV_ID_RE)
  if (arxivMatch?.[1]) {
    const title = await fetchTitleFromArxiv(arxivMatch[1])
    if (title) return title
  }

  // 2. DOI — query CrossRef
  const doiMatch = sample.match(DOI_RE)
  if (doiMatch?.[1]) {
    const title = await fetchTitleFromCrossRef(doiMatch[1])
    if (title) return title
  }

  return null
}

async function fetchTitleFromArxiv(arxivId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}&max_results=1`,
      { headers: { 'User-Agent': 'Council-Academic/1.0' }, signal: AbortSignal.timeout(6000) },
    )
    if (!res.ok) return null
    const xml = await res.text()
    const match = xml.match(/<title>(?!ArXiv)([\s\S]*?)<\/title>/)
    return match?.[1]?.replace(/\s+/g, ' ').trim() || null
  } catch {
    return null
  }
}

async function fetchTitleFromCrossRef(doi: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      {
        headers: { 'User-Agent': 'Council-Academic/1.0 (mailto:admin@council.app)' },
        signal: AbortSignal.timeout(6000),
      },
    )
    if (!res.ok) return null
    const data = await res.json() as { message?: { title?: string[] } }
    return data.message?.title?.[0]?.trim() || null
  } catch {
    return null
  }
}
