import { checkSearchRateLimit } from "../rate-limit";
import {
  searchOpenAlex,
  searchSemanticScholar,
  searchArxiv,
  resolveCrossrefMetadata,
  resolveUnpaywallPdf,
  formatPaperResults,
} from "../../scholarly-providers";

type Handler = (agentId: string, args: Record<string, unknown>, depth: number) => Promise<string>;

export const handlers: Record<string, Handler> = {

  // ── search_papers ───────────────────────────────────────────────────────────
  // Sources: openalex (primary), arxiv (supplement), semantic_scholar (secondary)
  // Default "both" = openalex + arxiv

  async search_papers(_agentId, args) {
    const rateLimitErr = checkSearchRateLimit();
    if (rateLimitErr) return rateLimitErr;

    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query) return "query is required";

    const source = typeof args.source === "string" ? args.source : "both";
    const limit = Math.min(Math.max(1, Number(args.limit ?? 5)), 10);

    const sections: string[] = [];
    const tip = "\n\n> Tip: use fetch_paper with an arXiv ID to load the full text into the session library.";

    // ── OpenAlex ──────────────────────────────────────────────────────────
    if (source === "openalex" || source === "both") {
      try {
        const papers = await searchOpenAlex(query, limit);
        sections.push(formatPaperResults(papers, "## OpenAlex"));
      } catch (e) {
        sections.push(`## OpenAlex\nError: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── arXiv ─────────────────────────────────────────────────────────────
    if (source === "arxiv" || source === "both") {
      try {
        const papers = await searchArxiv(query, limit);
        sections.push(formatPaperResults(papers, "## arXiv"));
      } catch (e) {
        sections.push(`## arXiv\nError: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── Semantic Scholar (explicit only) ──────────────────────────────────
    if (source === "semantic_scholar") {
      try {
        const papers = await searchSemanticScholar(query, limit);
        sections.push(formatPaperResults(papers, "## Semantic Scholar"));
      } catch (e) {
        sections.push(`## Semantic Scholar\nError: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!sections.length) return `No results for "${query}"`;
    return `# Academic Search: "${query}"\n\n${sections.join("\n\n---\n\n")}${tip}`;
  },

  // ── fetch_paper ─────────────────────────────────────────────────────────────
  // Accepts: arXiv ID, arXiv URL, DOI
  // DOI flow: Crossref (metadata) → Unpaywall (OA PDF)
  // library_id injected via toolArgOverrides so paper lands in session library

  async fetch_paper(_agentId, args) {
    const identifier = typeof args.identifier === "string" ? args.identifier.trim() : "";
    if (!identifier) return "identifier is required (arXiv ID like 2301.07041, DOI, or arXiv URL)";

    const libraryId =
      typeof args.library_id === "string" && args.library_id.trim()
        ? args.library_id.trim()
        : undefined;

    const { fetchArxivPaper, ingestPaper, extractTextFromPdfBuffer } = await import("../../paper-ingest");

    const arxivIdRe = /^(?:arxiv:)?(\d{4}\.\d{4,5}(?:v\d+)?)$/i;
    const arxivUrlRe = /arxiv\.org\/(?:abs|pdf)\/([0-9]+\.[0-9a-z]+(?:v\d+)?)/i;
    const doiRe = /^10\.\d{4,}\/.+/;

    let title: string;
    let text: string;
    let sourceUrl: string;
    let metaNote = "";
    let sourceType: "academic" | "web" = "academic";
    let markerPdfBuffer: Buffer | undefined;

    try {
      if (arxivIdRe.test(identifier)) {
        const id = identifier.replace(/^arxiv:/i, "");
        const r = await fetchArxivPaper(id);
        title = r.title; text = r.text; sourceUrl = r.url; markerPdfBuffer = r.pdfBuffer;

      } else if (arxivUrlRe.test(identifier)) {
        const m = identifier.match(arxivUrlRe);
        if (!m) return `Cannot parse arXiv ID from: ${identifier}`;
        const r = await fetchArxivPaper(m[1]);
        title = r.title; text = r.text; sourceUrl = r.url; markerPdfBuffer = r.pdfBuffer;

      } else if (doiRe.test(identifier)) {
        // Step 1: Crossref for canonical metadata
        const crossref = await resolveCrossrefMetadata(identifier);
        if (crossref?.title) {
          title = crossref.title;
          metaNote = [
            crossref.publisher ? `  publisher:  ${crossref.publisher}` : "",
            crossref.year ? `  year:       ${crossref.year}` : "",
            crossref.referencesCount !== null ? `  references: ${crossref.referencesCount}` : "",
          ].filter(Boolean).join("\n");
        } else {
          title = identifier;
        }

        // Step 2: Unpaywall for OA PDF
        const pdfUrl = await resolveUnpaywallPdf(identifier);
        if (!pdfUrl) {
          return (
            `DOI ${identifier} — not open access or no PDF found.\n` +
            (crossref?.title ? `  title: ${crossref.title}\n` : "") +
            `Try searching arXiv for a preprint version.`
          );
        }

        const pdfRes = await fetch(pdfUrl, {
          headers: { "User-Agent": "Council-Academic/1.0" },
          signal: AbortSignal.timeout(25_000),
        });
        if (!pdfRes.ok) return `PDF fetch failed for DOI ${identifier}: HTTP ${pdfRes.status}`;
        markerPdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
        text = await extractTextFromPdfBuffer(markerPdfBuffer);
        sourceUrl = pdfUrl;
        sourceType = "academic";

      } else {
        return [
          `Unsupported identifier: "${identifier}"`,
          "Accepted formats:",
          "  arXiv ID  : 2301.07041",
          "  arXiv URL : https://arxiv.org/abs/2301.07041",
          "  DOI       : 10.1145/1234567.1234568",
        ].join("\n");
      }

      if (!text || text.length < 200) {
        return `Paper fetched but text extraction returned too little content (${text?.length ?? 0} chars). May be image-only or access-restricted.`;
      }

      const result = await ingestPaper({ text, title, sourceUrl, libraryId, sourceType, pdfBuffer: markerPdfBuffer });
      return [
        "✓ Paper ingested and added to session library.",
        `  title:      ${result.title}`,
        `  documentId: ${result.documentId}`,
        `  libraryId:  ${result.libraryId}`,
        `  words:      ${result.wordCount}`,
        `  source:     ${result.source}`,
        metaNote,
        "",
        "Embeddings generating in background. Use rag_query to retrieve passages from this paper.",
      ].filter(Boolean).join("\n");

    } catch (e) {
      return `fetch_paper failed for "${identifier}": ${e instanceof Error ? e.message : String(e)}`;
    }
  },

  // ── web_search ──────────────────────────────────────────────────────────────

  async web_search(_agentId, args) {
    const rateLimitErr = checkSearchRateLimit();
    if (rateLimitErr) return rateLimitErr;

    const { query, count = 5 } = args as { query: string; count?: number };
    const resultCount = Math.min(Math.max(1, count), 10);
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;

    if (braveKey) {
      const url =
        `https://api.search.brave.com/res/v1/web/search` +
        `?q=${encodeURIComponent(query)}&count=${resultCount}&text_decorations=false&search_lang=zh-hant`;
      const res = await fetch(url, {
        headers: { Accept: "application/json", "X-Subscription-Token": braveKey },
      });
      if (!res.ok) return `搜尋失敗：HTTP ${res.status}`;
      const data = await res.json() as {
        web?: { results?: Array<{ title: string; url: string; description?: string }> };
      };
      const results = data.web?.results ?? [];
      if (!results.length) return `沒有找到「${query}」的相關結果`;
      return results
        .slice(0, resultCount)
        .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description ?? ""}`)
        .join("\n\n");
    }

    // DuckDuckGo instant answers — minimal zero-config fallback only
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { "User-Agent": "ClaudeAgentPlatform/1.0" } });
    if (!res.ok) return `搜尋失敗：HTTP ${res.status}`;
    const data = await res.json() as {
      AbstractText?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };
    const parts: string[] = [];
    if (data.AbstractText) {
      parts.push(`**摘要（${data.AbstractSource}）**\n${data.AbstractText}\n${data.AbstractURL}`);
    }
    for (const t of (data.RelatedTopics ?? []).slice(0, resultCount - 1)) {
      if (t.Text && t.FirstURL) parts.push(`• ${t.Text}\n  ${t.FirstURL}`);
    }
    if (!parts.length) {
      return `沒有找到「${query}」的即時結果。請設定 BRAVE_SEARCH_API_KEY 以獲得完整搜尋結果。`;
    }
    return parts.join("\n\n");
  },

  // ── fetch_url ───────────────────────────────────────────────────────────────

  async fetch_url(_agentId, args) {
    const { url, selector } = args as { url: string; selector?: string };
    if (!/^https?:\/\//i.test(url)) return `⚠️ 無效的 URL：${url}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ClaudeAgentBot/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return `抓取失敗：HTTP ${res.status} ${res.statusText}`;
    const html = await res.text();

    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text.length > 8000) {
      text = text.slice(0, 8000) + `\n\n…（內容已截斷，共 ${html.length} 字元）`;
    }
    void selector;
    return `【${url}】\n\n${text}`;
  },
};
