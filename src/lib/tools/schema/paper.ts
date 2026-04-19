// ── Academic paper search tool schemas ───────────────────────────────────────

import type { AnthropicTool } from "./shared";

export const PAPER_TOOL_SCHEMAS: AnthropicTool[] = [
  {
    name: "search_papers",
    description: "Search academic databases for research papers. Primary: OpenAlex + arXiv (default). Also supports Semantic Scholar explicitly. Returns titles, abstracts, authors, citation counts, arXiv IDs. Use fetch_paper to load full text.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query — topic, title keywords, author name, etc." },
        source: { type: "string", enum: ["openalex", "arxiv", "semantic_scholar", "both"], description: "Which database to search. 'both' = OpenAlex + arXiv (default). Use 'semantic_scholar' for citation-rich results." },
        limit: { type: "number", description: "Max results per source, 1–10 (default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_paper",
    description: "Fetch a full academic paper by arXiv ID (e.g. '2301.07041'), arXiv URL, or DOI and ingest it into the session RAG library so rag_query can retrieve passages from it.",
    input_schema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "arXiv ID (e.g. '2301.07041'), arXiv URL, or DOI (e.g. '10.1145/...')" },
      },
      required: ["identifier"],
    },
  },
];
