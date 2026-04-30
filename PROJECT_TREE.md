# Council Project Tree

Updated: 2026-05-01

This file is the current structural map of the repository. It is meant to support cleanup decisions without mixing old roadmap assumptions into active implementation notes.

## Root

Active project files:

- `package.json` / `package-lock.json` - npm scripts and dependency lock.
- `next.config.ts`, `middleware.ts`, `proxy.ts` - Next.js app configuration and request plumbing.
- `tsconfig.json`, `jest.config.ts`, `playwright.config.ts` - TypeScript and test configuration.
- `components.json`, `postcss.config.mjs`, `src/app/globals.css` - UI and styling configuration.
- `docs/architecture/` - static architecture explanation artifacts.
- `references/design-system/` - design-system reference package.
- `references/experiments/` - sidecar or archived experimental projects kept out of the main app/runtime path.
- `.env.local.example` - environment template.
- `PRODUCT_SPEC.md` - product shape and original spec.
- `PROJECT_STATUS.md` - current progress and verification notes.
- `COMMIT_GUIDE.md` - commit workflow notes.
- `CLAUDE.md` - project/agent context notes.

Generated or local-only files and directories:

- `.next/` - Next.js build output.
- `node_modules/` - installed dependencies.
- `test-results/` and `.pw-results-current/` - Playwright output.
- `.tmp/` - local debug scripts and logs.
- `tsconfig.tsbuildinfo` - TypeScript incremental build output.
- `.tmp-live-sse*.txt` and `.tmp-live-review.log` - local live review/SSE captures.
- `.tmp-playwright-dev.log` - local Playwright/dev-server log.

Cleanup candidates currently visible:

- Deleted but not committed old planning docs:
  - `COUNCIL_PRODUCT_PLAN.md`
  - `DEBATE_RUNTIME_HARDENING_PLAN.md`
  - `GEMINI_CONTEXT_CACHING_PLAN.md`
  - `GEMMA_PREPROCESS_LOAD_ANALYSIS.md`
  - `IMPLEMENTATION_ROADMAP.md`
  - `MISSING_PIECES.md`
  - `RESEARCH_APIS_PLAN.md`
  - `SESSION_RESTORE_ARCHITECTURE_PLAN.md`
  - `USER_DATA_MODEL_PLAN.md`
  - `design-system-audit.md`
- Local deleted planning docs pending final keep/delete policy.

## Source Tree

### `src/app`

Next.js App Router entrypoints.

- `src/app/page.tsx` - public landing page.
- `src/app/analyze/` - primary review setup, upload handoff, running review, restored review UI.
- `src/app/home/` - authenticated dashboard, paper search, recent reviews, reviews list.
- `src/app/keys/` - API key / pricing flow pages.
- `src/app/login/` - login UI and server actions.
- `src/app/share/[id]/` - public/shared session page.
- `src/app/api/` - route handlers.

Important API groups:

- `api/sessions` - current session create/list/get/run/chat/export routes.
- `api/papers` - paper ingest and PDF/arXiv upload routes.
- `api/search/papers` - paper search.
- `api/team-templates` and `api/teams/builder` - team template and builder routes.
- `api/keys` - API key routes.
- `api/stripe` - billing checkout/session/webhook routes.
- `api/public/v1` - public/API-facing analyze and session routes.

### `src/components`

UI components.

- `src/components/ui/` - generic UI primitives.
- `src/components/council/` - review timeline, source panel, chat, compare view, evidence annotation, and review setup UI.
- `src/components/council/review-setup/` - agent/team setup modal components.

Main council UI flow:

- `discussion-timeline.tsx`
- `agent-message.tsx`
- `evidence-annotated-markdown.tsx`
- `source-panel.tsx`
- `review-sidebar.tsx`
- `chat-with-paper.tsx`
- `compare-view.tsx`
- `debate-map.tsx`

### `src/hooks`

Client state and workflow hooks.

- `use-council-review.ts` - primary review/session state machine and SSE event handling.
- Other hooks support streaming demos, local UI behavior, or app shell behavior.

### `src/lib`

Core implementation. Canonical imports now point directly at the subdirectories below; the old top-level compatibility wrappers were removed.

Canonical implementation directories:

- `src/lib/core/` - council runtime, academic presets, access checks, paper chat, core types/config.
- `src/lib/db/` - PostgreSQL pool, account schema, council schema and persistence helpers.
- `src/lib/llm/` - Claude, Gemini, Ollama, OpenAI provider adapters and model constants.
- `src/lib/prompts/` - council prompt builders, bounded prompts, turn normalizers, review presets.
- `src/lib/tools/` - tool parser/display, RAG and web handlers, schemas, rate limits.
- `src/lib/agents/` - agentic runtime and tool execution loop.
- `src/lib/services/` - session hydration, restore, and service helpers.

Important standalone modules:

- `paper-ingest.ts` - paper ingestion and document/library setup.
- `auth-account.ts` - authenticated account/workspace resolution.
- `api-keys.ts` - API key support.
- `uploaded-files.ts` - uploaded file metadata.
- `web-quota.ts` - anonymous web quota enforcement.
- `evidence-annotations.ts` - source/ref matching for inline citations.
- `team-builder.ts`, `team-templates.ts`, `team-template-store.ts` - team generation/template support.
- `tool-compressor.ts` - tool output compression before feeding LLMs.

### `src/stores`

Client-side state stores. Currently secondary to `use-council-review.ts`.

### `src/types`

Frontend-facing shared types.

- `src/types/council.ts` - discussion session, agent, message, source ref, and related UI types.

### `src/__tests__`

Jest unit and route tests.

Current coverage areas:

- account/auth ownership
- API keys
- council access cookies
- council prompt parsing
- session hydration/restore
- evidence annotations
- paper ingest
- route access controls
- team templates
- tool display/parser behavior
- web quota

## Playwright Tests

Located under `tests/`.

- `current-ui-flow.spec.ts` - current primary UI flow checks.
- `council-runtime.spec.ts` - runtime, parser, LLM adapter, and council execution checks.
- `council-ui.spec.ts`, `council-visual.spec.ts`, `playwright-visual.spec.ts`, `login-home-visual.spec.ts` - UI/visual coverage.
- `login-debug.spec.ts` - debug-oriented test; review before treating as permanent.
- `tests/council-visual.spec.ts-snapshots/` - visual snapshots.

Known issue:

- `tests/council-runtime.spec.ts` currently needs its DB mock updated for account schema bootstrap SQL.

## Current Runtime Path

Primary anonymous/local review path:

1. User submits paper or arXiv ID from landing/analyze UI.
2. `api/papers/upload` or `api/sessions` creates a council session.
3. Anonymous sessions receive a `council_session_<id>` cookie.
4. `api/sessions/[id]/run` checks ownership through `council-access`.
5. `runCouncilSession` streams SSE events.
6. `runSeatTurn` runs reviewer seats and emits deltas/tool events.
7. Seats with `library_id` preload a constrained `rag_query`.
8. `tool_result.sourceRefs` streams to the frontend and persists in `council_evidence.source_refs`.
9. `use-council-review.ts` maps events into `DiscussionSession`.
10. `source-panel.tsx` and `evidence-annotated-markdown.tsx` render citations and source inspection.

## Cleanup Order

Recommended next cleanup sequence:

1. Confirm whether deleted root planning docs should remain deleted.
2. Fix `tests/council-runtime.spec.ts` DB mock gap.
3. Run the broader unit and UI suite after the canonical import and API namespace cleanup.
4. Decide whether the material under `references/experiments/` should remain in-repo long term or move out to a separate archive.
