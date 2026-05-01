# Council Project Status

Updated: 2026-05-01

Single source of truth for current project progress. Supersedes all older roadmap and planning files.

## Current Branch State

- Branch: `main`
- Local is ahead of `origin/main` by 20 commits.
- Latest commits:
  - `fe602bf Complete session workspace refactor and update status docs`
  - `55d1bf9 Restructure new review draft flow`
  - `d6c2ade Update UI refactor progress docs`
  - `f272149 Split review routes and add shared app shell`
  - `9035c0d refactor(phase-4/5): SourceRef merge, pure event reducer, fix test fixtures`

## Product State

Council is a working Next.js app for AI-assisted academic paper review.

**Tech stack:** Next.js 16 App Router, React 19, PostgreSQL (Docker `cap_postgres` port 5433), SSE streaming, Tailwind v4, shadcn/ui.

**Core features working:**

- arXiv ID and PDF upload entry via `/review/new` with legacy `/analyze` redirect compatibility
- Direct session workspace entry via `/review/[id]`
- Dedicated `New Review` draft layout with explicit paper/setup/template sections and a right-side summary rail
- Dedicated `Session Workspace` shell with a left debate canvas and right workspace rail
- Session canvas view switch: `timeline / compare / map`
- Shared review-surface visual theme across draft and session pages
- Multi-agent debate (Round 1 + optional Round 2) with SSE streaming
- Moderator synthesis rendered as structured conclusion card (confidence, consensus, veto, action items, dissent)
- Agent thinking indicators, activity phrases, between-turn status
- Honest ingest progress stepper during paper embedding
- Evidence citations: inline hover tooltips, source panel scroll, clickable chips
- EvidenceAnnotatedMarkdown with inline `**bold**`, `*italic*`, `` `code` ``
- Saved session restore and resume via PostgreSQL
- Session rerun and duplicate-as-new draft prefill
- Dashboard, reviews list with search/filter/delete
- Right-side source panel + paper chat
- Share (public/private) and PDF export
- API keys, Stripe-related routes
- Workspace-aware sessions, team templates, uploaded file metadata
- User language preference: `en / zh-TW / zh-CN / ja / ko`

## Recently Completed

### Visual System Pass (Phase 5A, first pass)

- Introduced a shared review-surface visual theme so draft and session pages now use one warmer, more intentional visual language.
- Refined typography and header treatment for:
  - `New Review`
  - `Session Workspace`
- Normalized card chrome, panel layering, and workspace rail presentation across review surfaces.
- Added responsive layout fallback for:
  - session workspace grid
  - draft creation grid
- Kept the route/state architecture unchanged while tightening visual consistency ahead of style-debt cleanup.

Important files:
- `src/components/review/review-theme.ts`
- `src/components/review/new/review-create-header.tsx`
- `src/components/review/new/review-draft-layout.tsx`
- `src/components/review/session/session-top-bar.tsx`
- `src/components/review/session/session-workspace-layout.tsx`

### Session Workspace Shell and Context Controls (Phase 4A / 4B)

- Converted the session route into an explicit workspace shell instead of a leftover branch of the draft/setup surface.
- Added a dedicated session top bar with:
  - back to reviews
  - status
  - share / export
  - rerun
  - duplicate as new
- Added left-side workspace canvas switching for:
  - timeline
  - compare
  - map
- Added right-rail session metadata and signal cards for:
  - status
  - current round
  - divergence
  - resumable state
  - recent alerts / errors
- Added `Duplicate as New` draft prefill:
  - arXiv-backed sessions reopen `/review/new?arxiv=...` with restored panel setup
  - uploaded-PDF sessions restore panel setup and show a re-upload notice
- Removed old analyze-era session UI wrappers now that review session layout lives under `src/components/review/session/*`.

Important files:
- `src/components/review/session/session-top-bar.tsx`
- `src/components/review/session/session-workspace-layout.tsx`
- `src/components/review/new/review-draft-header.tsx`
- `src/components/review/new/review-draft-layout.tsx`
- `src/components/review/review-surface.tsx`
- `src/hooks/use-council-review.ts`
- `src/lib/review-draft-prefill.ts`
- `src/__tests__/review-draft-prefill.test.ts`
- `src/__tests__/session-route-access.test.ts`

### New Review Draft Flow Cleanup

- Reworked `/review/new` so draft mode no longer reuses the old analyze setup workspace layout.
- Added a dedicated draft header and sectioned create flow for:
  - paper source
  - review setup
  - templates
- Added a right-side summary rail for:
  - launch CTA
  - draft readiness/status
  - paper/mode/rounds/seats/cost summary
  - template quick access
- Moved the primary launch CTA out of the setup panel for this route so `New Review` now has a clearer create-flow hierarchy.

Important files:
- `src/components/review/new/review-create-header.tsx`
- `src/components/review/new/review-draft-layout.tsx`
- `src/components/council/review-setup-panel.tsx`
- `src/components/review/review-surface.tsx`

### UI Route Split and Shared App Shell (`f272149`)

- Added explicit review routes:
  - `/review/new`
  - `/review/[id]`
- Converted `/analyze` into a compatibility redirect surface instead of the primary implementation route.
- Updated major app entrypoints to use the new review routes across landing, dashboard, reviews list, login free path, and pricing/API entry.
- Extracted a shared authenticated app shell for navigation reuse across `/home`, `/home/reviews`, `/review/new`, and `/review/[id]`.
- Removed duplicate app-level navigation from review pages so global nav now stays in the shared shell.
- Added `UI_REFACTOR_EXECUTION_PLAN.md` as the active execution plan for this UI restructure.

Important files:
- `src/app/analyze/page.tsx`
- `src/app/review/new/page.tsx`
- `src/app/review/[id]/page.tsx`
- `src/app/review/layout.tsx`
- `src/components/review/review-surface.tsx`
- `src/components/app/app-shell.tsx`
- `UI_REFACTOR_EXECUTION_PLAN.md`

### User Language Preference (`895a73b`)

- `users.preferred_language` column added via `ALTER TABLE IF NOT EXISTS` (auto-migrates on next boot).
- `AccountContext` carries `preferredLanguage`; `ensureUserAccountByEmail` reads and returns it.
- `GET /api/me` returns current user profile including language.
- `PATCH /api/me` updates language (validates against supported list).
- `/api/sessions/[id]/run` reads the authenticated user's `preferredLanguage` and passes it into `CouncilRunOptions`.
- `buildSeatRuntimePrompt`, `buildRound1Prompt`, `buildBoundedRound2Prompt`, and `buildModeratorSystemPrompt` inject the language instruction when non-English.
- Language selector dropdown in home sidebar footer.

Important files:
- `src/lib/db/account-db.ts`
- `src/lib/core/council-types.ts`
- `src/lib/core/council.ts`
- `src/lib/prompts/council-prompts.ts`
- `src/lib/prompts/council-bounded-prompts.ts`
- `src/app/api/me/route.ts`
- `src/app/api/sessions/[id]/run/route.ts`
- `src/app/home/layout.tsx`

### Debate UX, Moderator Card, Markdown, and Stream Error Fix (`dd39fb7`)

- Added thinking indicators, between-turn status, and honest ingest progress feedback.
- Rendered moderator JSON output as a structured conclusion card.
- Added inline emphasis/code rendering for evidence-annotated markdown.
- Prevented stream completion from overwriting `phase='error'` after provider failures.
- Marked incomplete messages as complete when streams close so thinking bubbles clear correctly.
- Fixed runtime tests by handling `ensureAccountSchema` CREATE TABLE SQL in the mock DB.

Important files:
- `src/components/council/agent-message.tsx`
- `src/components/council/discussion-timeline.tsx`
- `src/components/council/evidence-annotated-markdown.tsx`
- `src/components/council/review-setup-panel.tsx`
- `src/components/council/moderator-conclusion.tsx`
- `src/hooks/use-council-review.ts`
- `tests/council-runtime.spec.ts`

### Paper Ingest Deduplication and Embedding Reuse (`64e58d3`)

- `ingestPaper()` computes `content_hash` and checks for an existing paper by `source_url + content_hash` before re-embedding.
- Existing embeddings are reused; new `libraryId` causes the document to be retagged into the new namespace.
- Fallback match by `source_url + content` for older rows; hash backfilled.

Important files:
- `src/lib/paper-ingest.ts`

### RAG_ALLOW_GEMINI_FALLBACK

- `.env.local` sets `RAG_ALLOW_GEMINI_FALLBACK=0` to prevent Gemini synthesis on non-council RAG paths.

## Current Verification Baseline

Last known passing:
- `npm run build`
- `npm run test:unit` - 17/17 suites, 127 tests
- `npx playwright test tests/council-runtime.spec.ts` - 15/15
- `npx jest src/__tests__/paper-ingest.test.ts --runInBand`
- `npx jest src/__tests__/council-access.test.ts --runInBand`
- `npx jest src/__tests__/council-prompts.test.ts src/__tests__/council-session-hydrator.test.ts --runInBand`

## Known Remaining Work

**P0 - quality / reliability:**
- Async/background embedding pipeline (currently blocks the request path on first ingest)
- Retry/fallback when Gemini 503s during a debate turn (currently shows error banner)

**P1 - product features:**
- Semantic Scholar paper search integration
- Multi-paper comparison table
- Review history / project grouping

**P2 - infrastructure:**
- Formal paper asset model (`paper_assets`, `libraries`, `library_documents`)
- Background job execution instead of frontend-owned SSE lifecycle
- Billing entitlement model
- Audit, deletion, export, retention primitives

**P3 - i18n:**
- Full UI internationalization (`next-intl` or `react-i18next`)
- Currently only agent output language is dynamic; all UI labels remain English

## Files Outside This Status File

- `PRODUCT_SPEC.md` - product shape and original spec
- `COMMIT_GUIDE.md` - commit workflow notes
- `CLAUDE.md` - project/agent context notes
