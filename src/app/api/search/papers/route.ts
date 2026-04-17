import { NextRequest, NextResponse } from "next/server";
import {
  searchOpenAlex,
  searchArxiv,
  PaperResult,
} from "@/lib/scholarly-providers";
import { fetchArxivPaper } from "@/lib/paper-ingest";

const ARXIV_ID_RE = /^(\d{4}\.\d{4,5})(v\d+)?$|^([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?$/i;
const DOI_RE = /^10\.\d{4,}[\/.].+/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? "8"), 20);

  if (!q) return NextResponse.json([], { status: 200 });

  // arXiv ID → direct fetch for exact metadata
  if (ARXIV_ID_RE.test(q)) {
    try {
      const paper = await fetchArxivPaper(q);
      const result: PaperResult = {
        title: paper.title,
        abstract: paper.text.slice(0, 800),
        year: null,
        authors: [],
        arxivId: q,
        doi: null,
        pdfUrl: `https://arxiv.org/pdf/${q}`,
        citationCount: null,
        source: "arxiv",
      };
      return NextResponse.json([result]);
    } catch {
      // fall through to text search
    }
  }

  // DOI → OpenAlex lookup by DOI filter
  if (DOI_RE.test(q)) {
    try {
      const url =
        `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(q)}` +
        `?select=title,abstract_inverted_index,authorships,publication_year,cited_by_count,doi,best_oa_location,open_access&mailto=council@research.ai`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const works = await res.json();
        const oaUrl = works.best_oa_location?.pdf_url ?? null;
        const arxivId = works.doi?.match(/10\.48550\/arXiv\.(.+)/)?.[1] ?? null;
        const result: PaperResult = {
          title: works.title ?? q,
          abstract: reconstructAbstract(works.abstract_inverted_index),
          year: works.publication_year ?? null,
          authors: (works.authorships ?? []).map(
            (a: { author?: { display_name?: string } }) => a.author?.display_name ?? ""
          ).filter(Boolean),
          arxivId,
          doi: q,
          pdfUrl: oaUrl ?? (arxivId ? `https://arxiv.org/pdf/${arxivId}` : null),
          citationCount: works.cited_by_count ?? null,
          source: "openalex",
        };
        return NextResponse.json([result]);
      }
    } catch {
      // fall through
    }
  }

  // General text search: OpenAlex primary, arXiv supplemental
  const [oaResults, arxivResults] = await Promise.allSettled([
    searchOpenAlex(q, limit),
    searchArxiv(q, Math.min(limit, 5)),
  ]);

  const oa = oaResults.status === "fulfilled" ? oaResults.value : [];
  const ax = arxivResults.status === "fulfilled" ? arxivResults.value : [];

  // Merge: deduplicate by arxivId, prefer OA result if both present
  const seen = new Set<string>();
  const merged: PaperResult[] = [];

  for (const p of oa) {
    const key = p.arxivId ?? p.doi ?? p.title;
    if (!seen.has(key)) { seen.add(key); merged.push(p); }
  }
  for (const p of ax) {
    const key = p.arxivId ?? p.title;
    if (!seen.has(key)) { seen.add(key); merged.push(p); }
  }

  return NextResponse.json(merged.slice(0, limit));
}

function reconstructAbstract(inv: Record<string, number[]> | null | undefined): string {
  if (!inv) return "";
  const positions: Array<[number, string]> = [];
  for (const [word, pos] of Object.entries(inv)) {
    for (const p of pos) positions.push([p, word]);
  }
  return positions.sort((a, b) => a[0] - b[0]).map(([, w]) => w).join(" ");
}
