# Gemini Context Caching Plan

Updated: 2026-04-19

## Purpose

This document defines how Council should add Gemini Context Caching in a way that:

- reduces multi-agent inference cost
- preserves the current RAG workflow
- stays maintainable as the product grows
- avoids coupling business logic directly to one provider API

This is a technical architecture plan, not just a feature note.

## Current State

Council already has two important pieces:

## Progress Update

Current implementation status as of 2026-04-19:

- no Gemini context caching has been implemented yet
- the ownership groundwork that should come before provider cache is now partially in place
- session ownership now includes `workspace_id` and `created_by_user_id`
- upload metadata and server-side template persistence now exist

This matters because provider cache should be introduced only after the system can:

- attribute ownership
- clean up derived assets
- attach future plan policy to stable account boundaries

### 1. Session-scoped paper library

The current "knowledge base" is not Gemini cache.

It is the app's own database-backed paper store:

- `documents` stores full ingested paper text
- `document_chunks` stores chunked passages, with optional embeddings
- each session binds seats to a `library_id`
- the effective retrieval tag is `council:lib:<library_id>`

Relevant code:

- `src/lib/paper-ingest.ts`
- `src/lib/tools/handlers/rag.ts`
- `src/lib/core/council.ts`
- `src/lib/core/council-paper-chat.ts`

### 2. Direct Gemini completion path

Gemini is currently used only through direct model calls:

- `generateContent`
- `streamGenerateContent`

Relevant code:

- `src/lib/llm/gemini.ts`

There is currently no implementation of:

- Gemini `cachedContent`
- cache create / get / extend / delete
- cache TTL management
- cache-to-paper mapping
- batch processing
- cache garbage collection

## Problem

Council's current multi-agent architecture repeatedly pays input cost for the same paper.

Example:

- one paper is ingested once
- five seats debate over it
- every seat rebuilds a large prompt context
- round 2 often repeats the same core paper context
- moderator may again receive large repeated context

This creates a structurally bad cost curve for hosted usage.

RAG helps narrow evidence retrieval, but it does not solve the provider-side repeated-input billing problem when the full paper context must still be available across multiple model calls.

## Architectural Principle

Council should treat these as two separate but complementary layers:

### Layer A: App-owned paper library

Purpose:

- retrieval
- citations
- chat with paper
- evidence log
- provider-independent persistence

Storage:

- PostgreSQL tables such as `documents` and `document_chunks`

### Layer B: Provider-owned context cache

Purpose:

- reduce repeated model input cost for multi-agent debate
- improve speed for repeated reads of the same paper context

Storage:

- Gemini-side context cache with TTL and explicit lifecycle management

Council should keep both.

RAG is the durable product data layer.
Context caching is the cost-optimization execution layer.

## What Must Change

## A. Add a provider cache abstraction

### What to add

A provider-neutral cache module, for example:

- `src/lib/llm/context-cache.ts`
- `src/lib/llm/gemini-cache.ts`

### Why

If cache logic is written directly inside route handlers or debate code, the codebase will become hard to maintain and nearly impossible to extend to other providers.

### What it should expose

- `createContextCache(input)`
- `getContextCache(cacheId)`
- `extendContextCacheTtl(cacheId, ttlSeconds)`
- `deleteContextCache(cacheId)`
- `runModelWithCache(input)`

### Maintainability goal

The rest of the app should depend on one internal cache interface, not on raw Gemini endpoint details.

## B. Add local cache metadata storage

### What to add

A new DB module and table, for example:

- `src/lib/db/gemini-cache-db.ts`
- table: `gemini_context_caches`

Suggested fields:

- `id`
- `provider`
- `cache_name`
- `model`
- `document_fingerprint`
- `library_id`
- `source_document_id`
- `session_id`
- `status`
- `token_count`
- `expires_at`
- `last_used_at`
- `created_at`
- `updated_at`

### Why

Without a local metadata table, the app cannot:

- know whether a paper already has a valid cache
- extend TTL safely
- delete caches deterministically
- calculate cache hit rates
- implement a garbage collector

### Maintainability goal

Provider cache lifecycle must be inspectable from app state, not hidden inside opaque API calls.

## C. Add paper fingerprinting

### What to change

Before cache creation, normalize the paper payload and compute a deterministic fingerprint.

Likely insertion point:

- `src/lib/paper-ingest.ts`

### Why

The same paper may appear through:

- arXiv ID
- PDF upload
- DOI -> OA PDF

Without a fingerprint, Council will rebuild equivalent caches repeatedly.

### Maintainability goal

Fingerprinting centralizes deduplication logic in one place instead of scattering "same paper?" heuristics across routes.

## D. Add a cache-ready paper payload builder

### What to add

A module such as:

- `src/lib/paper-cache-payload.ts`

### What it does

Transforms raw paper text into a cache-eligible payload:

- keep title, abstract, main body
- strip or downweight acknowledgments
- strip references
- strip appendices unless explicitly requested
- optionally preserve figure/table captions

### Why

Gemini cache cost depends on:

- creation size
- storage duration
- repeated reads

Reducing useless sections improves cost efficiency immediately.

### Maintainability goal

Paper-cleaning rules should live in one testable module, not inside API routes.

## E. Create or reuse cache during analyze

### What to change

Both web and public API analyze flows should:

1. ingest paper into Council library
2. build paper fingerprint
3. look for an active Gemini cache
4. reuse it when safe
5. create one when missing
6. store the cache reference on the session

Relevant routes:

- `src/app/api/papers/upload/route.ts`
- `src/app/api/public/v1/analyze/route.ts`

### Why

This is the choke point where all paper analysis begins.

If cache logic is not attached here, later seats cannot reliably share the same provider-side context.

### Maintainability goal

Cache acquisition should happen once per analysis flow, not per seat.

## F. Extend the session model with cache references

### What to change

Add cache fields to session state, for example:

- `paper_cache_name`
- `paper_cache_provider`
- `paper_cache_expires_at`
- `paper_cache_status`

Relevant files:

- `src/lib/core/council-types.ts`
- `src/lib/db/council-db.ts`
- `src/lib/core/council.ts`

### Why

Seat turns and moderator turns need a stable way to know whether a valid provider cache exists.

### Maintainability goal

Runtime code should read cache references from the session model, not reconstruct them ad hoc.

## G. Route eligible Gemini runs through cached context

### What to change

In debate execution:

- if the selected model supports Gemini context caching, attach the cache reference
- if not, fall back to the existing prompt path

Relevant files:

- `src/lib/core/council.ts`
- `src/lib/agents/agentic-runtime.ts`
- `src/lib/llm/gemini.ts`

### Why

This is where cost savings actually materialize.

If cache only exists in metadata but the runtime still rebuilds full prompts, no savings occur.

### Maintainability goal

Cache-aware execution should be a capability of the model runtime, not special-case logic in each route.

## H. Compress round-2 input structurally

### What to change

Round 2 should not read:

- full paper again as raw text
- full round-1 transcript

Instead it should read:

- paper cache
- a moderator-generated conflict digest
- only the minimal seat-specific cross-examination context

Relevant files:

- `src/lib/prompts/council-prompts.ts`
- `src/lib/prompts/council-bounded-prompts.ts`
- `src/lib/core/council.ts`

### Why

Context caching reduces repeated paper cost.
It does not fix bloated round-2 debate transcripts.

Both must be optimized together.

### Maintainability goal

Prompt-size control should be deliberate and bounded, not an accidental byproduct of ad hoc truncation.

## I. Add TTL lifecycle management

### What to add

A lifecycle module such as:

- `src/lib/gemini-cache-lifecycle.ts`

Rules:

- create with short default TTL, e.g. 15 minutes
- extend only when round 2 or follow-up work requires it
- delete immediately after final report generation when no further use is needed

### Why

Storage fees accumulate while the cache remains alive.

### Maintainability goal

TTL policy should be explicit, testable, and changeable without rewriting debate code.

## J. Add a garbage collector

### What to add

A background cleanup task, for example:

- `scripts/cleanup_gemini_caches.ts`

Responsibilities:

- scan expired active caches
- delete provider-side leftovers
- update local metadata
- surface cleanup metrics

### Why

Any leaked cache becomes a billing risk.

### Maintainability goal

Operational cleanup should be independent from request/response flows.

## K. Add cost and cache observability

### What to add

Per-run accounting for:

- cache creation tokens
- cache hits
- cache misses
- cache read tokens
- non-cached prompt tokens
- output tokens
- estimated USD

Likely integration points:

- `src/lib/llm/gemini.ts`
- `src/lib/core/council.ts`

### Why

Without per-run economics, Council cannot verify whether caching is actually improving margins.

### Maintainability goal

Observability belongs in reusable accounting hooks, not in scattered console logs.

## L. Add batch-mode later, not first

### What to add later

A delayed-cost execution path for non-real-time analysis.

### Why

This is valuable, but it is not a prerequisite for basic context caching.

### Maintainability goal

Do not mix batch orchestration into the first cache implementation. Keep it as a second-phase concern.

## What Must Be Added

At minimum, this project needs these new modules:

- `src/lib/llm/context-cache.ts`
- `src/lib/llm/gemini-cache.ts`
- `src/lib/db/gemini-cache-db.ts`
- `src/lib/paper-cache-payload.ts`
- `src/lib/gemini-cache-lifecycle.ts`
- `scripts/cleanup_gemini_caches.ts`

At minimum, these existing modules need updates:

- `src/lib/llm/gemini.ts`
- `src/lib/paper-ingest.ts`
- `src/lib/core/council.ts`
- `src/lib/core/council-types.ts`
- `src/lib/db/council-db.ts`
- `src/app/api/papers/upload/route.ts`
- `src/app/api/public/v1/analyze/route.ts`
- `src/lib/prompts/council-prompts.ts`
- `src/lib/prompts/council-bounded-prompts.ts`

## Why This Architecture Is Maintainable

This design stays maintainable because it separates concerns:

- paper persistence stays in the app-owned RAG layer
- provider cache lifecycle stays in a dedicated cache layer
- debate orchestration consumes cache references but does not manage cache APIs directly
- TTL policy stays separate from prompt construction
- cleanup stays separate from request handling
- cost accounting stays separate from business routes

That separation makes it easier to:

- swap Gemini model versions
- add another provider later
- change TTL policy
- add team/workspace ownership
- introduce batch mode

## Why This Architecture Is Extensible

This design is extensible because it models cache as infrastructure, not as a one-off optimization.

Future extensions become straightforward:

- reuse one cache across follow-up chat turns
- cache only selected sections, not the full paper
- premium plans can keep caches alive longer
- low-cost hosted mode can use Flash + cache
- premium mode can use Flash seats + Pro moderator
- team accounts can share cache references across sessions

## Recommended Delivery Plan

## Phase 0: Safety and groundwork

1. Add cache metadata table.
2. Add paper fingerprinting.
3. Add cache-ready payload builder.
4. Add provider cache wrapper.

Goal:

No runtime behavior changes yet, but the app becomes ready to map paper -> cache safely.

Status:

Not started directly for cache code.

However, some non-cache prerequisites are now partially complete:

- workspace ownership foundation
- session ownership foundation
- upload metadata foundation

## Phase 1: Basic Gemini cache reuse

1. Create or reuse cache during analyze.
2. Save cache reference on session.
3. Route eligible Gemini calls through cache.
4. Add fallback to existing non-cache path.

Goal:

Immediate cost reduction for repeated paper reads across seats.

Status:

Not started.

## Phase 2: Lifecycle control

1. Default short TTL.
2. Extend TTL for round 2 only when needed.
3. Delete cache after final synthesis when safe.
4. Add garbage collector.

Goal:

Prevent storage leakage and keep cache spend predictable.

Status:

Not started.

## Phase 3: Prompt and round optimization

1. Add conflict digest extraction.
2. Shrink round-2 input aggressively.
3. Measure token savings.

Goal:

Reduce both paper repetition and transcript bloat.

Status:

Not started in the Gemini-cache-specific sense.

Related prerequisite already improved:

- ingest now waits for embedding completion before returning, which reduces early-run RAG instability

## Phase 4: Economics and plan-aware routing

1. Add per-run cost reporting.
2. Add plan/tier-aware cache policy.
3. Add batch mode for deferred jobs.

Goal:

Turn the cache system into a business control surface, not just a technical trick.

Status:

Not started.

## Non-Goals for the First Implementation

Do not try to solve all of these in v1:

- generic provider-agnostic cross-vendor caching
- multi-paper merged cache
- batch mode
- full user/workspace asset model
- premium entitlement routing

The first implementation should solve one narrow problem well:

one paper, one analysis flow, one provider cache reference, controlled TTL, clear fallback.

## Summary

Council already has a paper library.
It does not yet have provider-side context caching.

The right implementation is not to replace RAG, but to layer Gemini Context Caching on top of the current paper library architecture.

That means:

- keep `documents/document_chunks` as the durable knowledge layer
- add Gemini cache as an execution-cost layer
- manage cache lifecycle explicitly
- store cache metadata locally
- route debate runs through cache-aware model wrappers
- keep the code split by responsibility

That is the path that is most likely to reduce cost without turning the codebase into an unmaintainable provider-specific tangle.
