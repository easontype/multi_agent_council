/**
 * scholarly-providers.ts
 * Centralised academic API integrations for Council.
 *
 * Provider priority (as of 2026-04-15):
 *   metadata search  : OpenAlex (primary) → Semantic Scholar (secondary)
 *   arXiv preprints  : arXiv Atom feed
 *   DOI metadata     : Crossref
 *   OA PDF lookup    : Unpaywall
 */

const UA = "Council-Academic/1.0 (mailto:council@research.ai)";
const TIMEOUT_MS = 12_000;

// ── Shared paper shape ────────────────────────────────────────────────────────

export interface PaperResult {
  title: string;
  abstract: string;
  year: number | null;
  authors: string[];
  arxivId: string | null;
  doi: string | null;
  pdfUrl: string | null;
  citationCount: number | null;
  source: "openalex" | "semantic_scholar" | "arxiv";
}

function fmt(p: PaperResult, index: number): string {
  const authors = p.authors.slice(0, 3).join(", ");
  const abstract = p.abstract ? `   Abstract: ${p.abstract.slice(0, 280)}…` : "";
  return [
    `${index + 1}. **${p.title}** (${p.year ?? "n/a"})`,
    authors ? `   Authors: ${authors}` : "",
    p.citationCount !== null ? `   Citations: ${p.citationCount}` : "",
    p.arxivId ? `   arXiv: ${p.arxivId}  →  fetch_paper identifier="${p.arxivId}"` : "",
    p.doi ? `   DOI: ${p.doi}` : "",
    p.pdfUrl ? `   PDF: ${p.pdfUrl}` : "",
    abstract,
  ].filter(Boolean).join("\n");
}

export function formatPaperResults(papers: PaperResult[], heading: string): string {
  if (!papers.length) return `${heading}\nNo results found.`;
  return `${heading}\n\n` + papers.map((p, i) => fmt(p, i)).join("\n\n");
}

// ── OpenAlex ──────────────────────────────────────────────────────────────────

interface OAWork {
  id?: string;
  title?: string;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: Array<{ author?: { display_name?: string } }>;
  publication_year?: number | null;
  cited_by_count?: number;
  doi?: string | null;
  open_access?: { oa_url?: string | null };
  primary_location?: { landing_page_url?: string | null };
  best_oa_location?: { pdf_url?: string | null };
}

function reconstructAbstract(inv: Record<string, number[]> | null | undefined): string {
  if (!inv) return "";
  const positions: Array<[number, string]> = [];
  for (const [word, pos] of Object.entries(inv)) {
    for (const p of pos) positions.push([p, word]);
  }
  return positions
    .sort((a, b) => a[0] - b[0])
    .map(([, w]) => w)
    .join(" ");
}

export async function searchOpenAlex(query: string, limit: number): Promise<PaperResult[]> {
  const fields = [
    "title",
    "abstract_inverted_index",
    "authorships",
    "publication_year",
    "cited_by_count",
    "doi",
    "open_access",
    "best_oa_location",
    "primary_location",
  ].join(",");

  const url =
    `https://api.openalex.org/works?search=${encodeURIComponent(query)}` +
    `&per-page=${limit}&select=${fields}&mailto=council@research.ai`;

  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);

  const data = await res.json() as { results?: OAWork[] };
  const works = data.results ?? [];

  return works.map((w): PaperResult => {
    const doiRaw = w.doi ?? null;
    // OpenAlex returns full DOI URL — extract the plain ID
    const doi = doiRaw ? doiRaw.replace("https://doi.org/", "") : null;
    // arXiv ID from DOI if it looks like 10.48550/arXiv.xxxx.xxxxx
    const arxivFromDoi = doi?.match(/10\.48550\/arXiv\.(.+)/)?.[1] ?? null;
    const pdfUrl =
      w.best_oa_location?.pdf_url ??
      (arxivFromDoi ? `https://arxiv.org/pdf/${arxivFromDoi}` : null);

    return {
      title: w.title ?? "Untitled",
      abstract: reconstructAbstract(w.abstract_inverted_index),
      year: w.publication_year ?? null,
      authors: (w.authorships ?? [])
        .map((a) => a.author?.display_name ?? "")
        .filter(Boolean),
      arxivId: arxivFromDoi,
      doi,
      pdfUrl,
      citationCount: w.cited_by_count ?? null,
      source: "openalex",
    };
  });
}

// ── Semantic Scholar ──────────────────────────────────────────────────────────

interface S2Paper {
  paperId: string;
  title: string;
  abstract?: string;
  year?: number;
  authors?: Array<{ name: string }>;
  externalIds?: { ArXiv?: string; DOI?: string };
  citationCount?: number;
  openAccessPdf?: { url: string };
}

export async function searchSemanticScholar(query: string, limit: number): Promise<PaperResult[]> {
  const fields = "title,abstract,year,authors,externalIds,citationCount,openAccessPdf";
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`;

  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Semantic Scholar HTTP ${res.status}`);

  const data = await res.json() as { data?: S2Paper[] };
  const papers = data.data ?? [];

  return papers.map((p): PaperResult => {
    const arxivId = p.externalIds?.ArXiv ?? null;
    const doi = p.externalIds?.DOI ?? null;
    const pdfUrl =
      p.openAccessPdf?.url ?? (arxivId ? `https://arxiv.org/pdf/${arxivId}` : null);

    return {
      title: p.title ?? "Untitled",
      abstract: p.abstract ?? "",
      year: p.year ?? null,
      authors: (p.authors ?? []).map((a) => a.name),
      arxivId,
      doi,
      pdfUrl,
      citationCount: p.citationCount ?? null,
      source: "semantic_scholar",
    };
  });
}

// ── arXiv ─────────────────────────────────────────────────────────────────────

function parseAtomEntry(entry: string): Omit<PaperResult, "source"> {
  const get = (tag: string) =>
    entry
      .match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim() ?? "";

  const idUrl = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() ?? "";
  const arxivId = idUrl.match(/(?:abs|pdf)\/([0-9]+\.[0-9a-z]+(?:v\d+)?)/)?.[1] ?? null;
  const authorMatches = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)];

  return {
    title: get("title"),
    abstract: get("summary"),
    year: Number(get("published").slice(0, 4)) || null,
    authors: authorMatches.map((m) => m[1].trim()),
    arxivId,
    doi: null,
    pdfUrl: arxivId ? `https://arxiv.org/pdf/${arxivId}` : null,
    citationCount: null,
  };
}

export async function searchArxiv(query: string, limit: number): Promise<PaperResult[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${limit}&sortBy=relevance`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`arXiv HTTP ${res.status}`);

  const xml = await res.text();
  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? [];
  return entries
    .slice(0, limit)
    .map((e): PaperResult => ({ ...parseAtomEntry(e), source: "arxiv" }));
}

// ── Crossref ──────────────────────────────────────────────────────────────────

export interface CrossrefMeta {
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  type: string | null;
  referencesCount: number | null;
  isOa: boolean;
}

export async function resolveCrossrefMetadata(doi: string): Promise<CrossrefMeta | null> {
  const clean = doi.replace(/^https?:\/\/doi\.org\//i, "");
  const url = `https://api.crossref.org/works/${encodeURIComponent(clean)}?mailto=council@research.ai`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const json = await res.json() as {
      message?: {
        title?: string[];
        author?: Array<{ given?: string; family?: string }>;
        "published-print"?: { "date-parts"?: number[][] };
        "published-online"?: { "date-parts"?: number[][] };
        publisher?: string;
        type?: string;
        "references-count"?: number;
        license?: Array<{ URL?: string }>;
      };
    };

    const m = json.message;
    if (!m) return null;

    const dateArr =
      m["published-print"]?.["date-parts"]?.[0] ??
      m["published-online"]?.["date-parts"]?.[0];
    const year = dateArr?.[0] ?? null;

    const authors = (m.author ?? []).map((a) =>
      [a.given, a.family].filter(Boolean).join(" "),
    );

    const isOa = (m.license ?? []).some((l) =>
      /creativecommons|open-access/i.test(l.URL ?? ""),
    );

    return {
      title: m.title?.[0] ?? "",
      authors,
      year: typeof year === "number" ? year : null,
      publisher: m.publisher ?? null,
      type: m.type ?? null,
      referencesCount: m["references-count"] ?? null,
      isOa,
    };
  } catch {
    return null;
  }
}

// ── Unpaywall ─────────────────────────────────────────────────────────────────

export async function resolveUnpaywallPdf(doi: string): Promise<string | null> {
  const clean = doi.replace(/^https?:\/\/doi\.org\//i, "");
  try {
    const res = await fetch(
      `https://api.unpaywall.org/v2/${encodeURIComponent(clean)}?email=council@research.ai`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      is_oa?: boolean;
      best_oa_location?: { url_for_pdf?: string | null };
    };
    if (!data.is_oa) return null;
    return data.best_oa_location?.url_for_pdf ?? null;
  } catch {
    return null;
  }
}
