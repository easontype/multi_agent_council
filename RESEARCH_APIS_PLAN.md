# Council Research APIs Plan

Updated: 2026-04-15

## Goal

This document recommends which academic databases and web search APIs `council` should integrate next, based on the current codebase and the latest official provider docs checked on 2026-04-15.

The project already has the right product shape for:

- paper ingest from `arXiv` / `DOI` / uploaded PDF
- internal `RAG`
- multi-agent academic review
- external paper discovery via `search_papers`
- current web grounding via `web_search`

The main gap is not more models. The main gap is a stronger retrieval stack:

1. better scholarly metadata and citation graph coverage
2. better open-access full-text recovery
3. better real web search for agents

## Current Code Mapping

Relevant files:

- `src/lib/tools/handlers/web.ts`
- `src/lib/paper-ingest.ts`
- `src/lib/council-academic.ts`
- `.env.local.example`

Current behavior:

- `search_papers` uses `Semantic Scholar` plus `arXiv`
- `fetch_paper` supports `arXiv ID`, `arXiv URL`, and `DOI`
- DOI resolution currently depends on `Unpaywall`
- `web_search` uses `Brave` when `BRAVE_SEARCH_API_KEY` exists
- `web_search` falls back to `DuckDuckGo instant answers` when Brave is not configured

## Recommendation Summary

Recommended stack by priority:

- `P0`: `OpenAlex + Crossref + Brave`
- `P1`: `Europe PMC`
- `P1`: `CORE`
- `P2`: `Tavily` or `Exa`

Recommended default architecture:

- academic metadata search: `OpenAlex` as primary
- citation/reference enrichment: `OpenAlex` + `Crossref`
- OA PDF resolution: `Unpaywall` first, `CORE` second
- biomedical literature: `Europe PMC`
- general web search: `Brave`
- deeper agentic web research: `Tavily` or `Exa`

## Provider Decisions

### 1. OpenAlex

Use as the primary academic metadata API.

Why it fits:

- broad research graph coverage
- open metadata posture is better for product use
- supports works, authors, institutions, topics, sources
- official docs now state free daily usage with API key
- official docs also expose content-download capabilities

Recommended use in Council:

- replace `Semantic Scholar` as the default first search in `search_papers`
- use for title, abstract, authors, year, cited-by count, DOI, OA links
- use for "recent related work" discovery
- use for novelty checks and related-work scouting

Why it should be first:

- best balance of coverage, openness, and product safety
- safer long-term foundation than building the product around Semantic Scholar license constraints

Implementation target:

- add `openalex` as a `search_papers` source option
- later make `openalex` the default source, with `arxiv` as supplement

### 2. Crossref

Use as the DOI normalization and metadata backfill layer.

Why it fits:

- strong DOI-centered metadata
- useful for canonical title, journal, publisher, published date, license, funder, reference metadata
- fills holes when OpenAlex or provider pages are incomplete

Recommended use in Council:

- run before `Unpaywall` in DOI flow
- normalize DOI input
- enrich fetched records with publication metadata
- improve evidence display in result pages

Implementation target:

- add a `resolve_doi_metadata()` helper
- use it inside `fetch_paper`

### 3. Brave Search API

Keep as the default general web search API.

Why it fits:

- already matches current code structure
- lowest migration cost
- much better than current DuckDuckGo fallback
- good enough for "latest policy / project / benchmark / product page" checks

Recommended use in Council:

- keep `web_search` defaulting to Brave when configured
- treat DuckDuckGo only as emergency fallback, not as a primary plan

Implementation target:

- improve result formatting
- allow `site:` / domain filters in tool args
- allow date-sensitive searches for "latest" workflows

### 4. Europe PMC

Add if Council will be used for biomedical or life-science papers.

Why it fits:

- strong PubMed / PMC / preprint coverage
- official API exposes references, citations, citation network, and full-text links
- better fit than generic web search for medicine and biology

Recommended use in Council:

- add `europe_pmc` source to `search_papers`
- use for biomedical related work
- use for medical recency checks where PubMed coverage matters

Implementation target:

- route biomedical queries to Europe PMC
- optionally infer biomedical mode by topic keywords or user toggle

### 5. CORE

Add as the OA full-text fallback after Unpaywall.

Why it fits:

- large open-access full-text index
- useful when DOI exists but `Unpaywall` cannot provide a PDF URL
- improves ingest hit rate for non-arXiv papers

Recommended use in Council:

- after DOI lookup and Unpaywall failure, try CORE by DOI or title
- recover PDF/full text for ingestion

Implementation target:

- add `resolve_oa_fulltext()` abstraction
- provider order: `Unpaywall -> CORE -> fail`

### 6. Tavily or Exa

These are not mandatory for v1. They are optional upgrades for stronger agentic web research.

Pick `Tavily` if you want:

- search + extract + crawl in one family of APIs
- lower integration effort for agent workflows
- a simple "research mode" path

Pick `Exa` if you want:

- stronger AI-native search behavior
- good page-content retrieval and similar-page discovery
- a better fit for deep research flows

Recommended use in Council:

- create a second tool separate from `web_search`
- use it only for "deep research" or "fetch multiple sources" workflows
- do not replace Brave on day one unless you want to pay for richer extraction

## What To Keep, But Not Build Around

### Semantic Scholar

Keep as a secondary provider, not the primary foundation.

Reason:

- excellent paper search experience
- useful citation-oriented signals
- but the official license is a real product risk if Council becomes a paid service

Recommended position:

- keep as optional secondary source
- use for comparison, not for core dependency

### Unpaywall

Keep it.

Reason:

- still the right first step for DOI -> OA PDF lookup
- but it is only one part of a robust OA recovery pipeline

### DuckDuckGo Instant Answers

Do not treat it as the real web search plan.

Reason:

- current fallback is too shallow for agentic research
- good only as a minimal zero-config fallback

## Phased Rollout

### Phase 1

Goal: raise quality quickly with low implementation risk.

- add `OPENALEX_API_KEY`
- add OpenAlex provider to `search_papers`
- add Crossref DOI metadata normalization
- keep Brave as primary `web_search`

Expected result:

- better related-work discovery
- better DOI metadata quality
- better commercial safety

### Phase 2

Goal: improve biomedical coverage and full-text hit rate.

- add `EUROPE_PMC` provider path
- add `CORE` fallback after `Unpaywall`

Expected result:

- better performance on med/bio topics
- more papers successfully ingested into RAG

### Phase 3

Goal: improve deep web-grounded agent workflows.

- add `TAVILY_API_KEY` or `EXA_API_KEY`
- create a `deep_web_research` tool
- keep it separate from normal `web_search`

Expected result:

- better multi-source web evidence
- less brittle scraping with raw `fetch_url`

## Suggested Env Vars

Recommended additions to `.env.local.example`:

```env
OPENALEX_API_KEY=
CROSSREF_MAILTO=research@your-domain.com
EUROPE_PMC_EMAIL=research@your-domain.com
CORE_API_KEY=
TAVILY_API_KEY=
EXA_API_KEY=
```

Notes:

- `Crossref` commonly benefits from a clear contact email
- `NCBI` / `PubMed` style integrations also benefit from registered tool/email identity
- keep `BRAVE_SEARCH_API_KEY`
- keep `GEMINI_API_KEY` because RAG embeddings already depend on it

## Suggested Code Changes

### `src/lib/tools/handlers/web.ts`

- add `OpenAlex` search helper
- add `Crossref` DOI metadata helper
- add `Europe PMC` search helper
- add `CORE` OA fallback helper
- extend `search_papers.source` options
- keep `Brave` as default `web_search`

### `src/lib/paper-ingest.ts`

- keep PDF text extraction logic as-is
- do not couple provider-specific lookup logic too tightly here
- prefer provider lookup in `web.ts` or a new `scholarly-providers.ts`

### New file recommendation

Add a new provider abstraction file:

- `src/lib/scholarly-providers.ts`

Suggested responsibility:

- `searchOpenAlex()`
- `searchSemanticScholar()`
- `searchEuropePmc()`
- `resolveCrossrefMetadata()`
- `resolveUnpaywallPdf()`
- `resolveCoreFulltext()`

This keeps `web.ts` from becoming the permanent integration dump.

## Final Recommendation

If only one roadmap is chosen, use this:

1. `OpenAlex`
2. `Crossref`
3. `Brave`
4. `Europe PMC`
5. `CORE`
6. `Tavily` or `Exa`

This is the best fit for the current Council product direction:

- agentic academic review
- related-work scouting
- gap analysis
- novelty checking
- DOI/arXiv/PDF ingest into RAG
- eventual paid product exposure

## Official Sources Checked On 2026-04-15

- OpenAlex overview: https://developers.openalex.org/
- OpenAlex auth and pricing: https://developers.openalex.org/guides/authentication
- Crossref documentation: https://www.crossref.org/documentation/
- Crossref metadata retrieval: https://www.crossref.org/documentation/retrieve-metadata/
- Semantic Scholar API: https://www.semanticscholar.org/product/api
- Semantic Scholar API license: https://api.semanticscholar.org/license/
- NCBI developer APIs: https://www.ncbi.nlm.nih.gov/home/develop/api/
- NCBI E-utilities guide: https://www.ncbi.nlm.nih.gov/books/NBK25497/
- Europe PMC REST API: https://europepmc.org/RestfulWebService
- CORE API/services: https://core.ac.uk/services/api
- CORE docs: https://core.ac.uk/documentation/api
- Brave Search API docs/pricing: https://api-dashboard.search.brave.com/documentation/pricing
- Tavily search docs: https://docs.tavily.com/documentation/api-reference/endpoint/search
- Exa docs: https://docs.exa.ai/
- Exa pricing: https://exa.ai/pricing

