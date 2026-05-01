# Council Project Status

Updated: 2026-05-01

Single source of truth for current project progress. Supersedes all older roadmap and planning files.

## Current Branch State

- Branch: `main`
- Local is ahead of `origin/main` by 12 commits.
- Latest commits:
  - `f272149 Split review routes and add shared app shell`
  - `895a73b feat: user language preference — dynamic agent output language`
  - `dd39fb7 feat: debate UX — thinking indicators, moderator card, markdown rendering, stream error fix`
  - `64e58d3 Reuse paper embeddings by source and content hash`
  - `ca91061 Clean repo structure and converge canonical imports`

## Product State

Council is a working Next.js 15 app for AI-assisted academic paper review.

**Tech stack:** Next.js 15 App Router, React 18, PostgreSQL (Docker `cap_postgres` port 5433), SSE streaming, Tailwind v4, shadcn/ui.

**Core features working:**

- arXiv ID and PDF upload entry via `/review/new` with legacy `/analyze` redirect compatibility
- Direct session workspace entry via `/review/[id]`
- Dedicated `New Review` draft layout with explicit paper/setup/template sections and a right-side summary rail
- Multi-agent debate (Round 1 + optional Round 2) with SSE streaming
- Moderator synthesis rendered as structured conclusion card (confidence, consensus, veto, action items, dissent)
- Agent thinking indicators, activity phrases, between-turn status
- Honest ingest progress stepper during paper embedding
- Evidence citations: inline hover tooltips, source panel scroll, clickable chips
- EvidenceAnnotatedMarkdown with inline `**bold**`, `*italic*`, `` `code` ``
- Saved session restore and resume via PostgreSQL
- Dashboard, reviews list with search/filter/delete
- Right-side source panel + paper chat
- Share (public/private) and PDF export
- API keys, Stripe-related routes
- Workspace-aware sessions, team templates, uploaded file metadata
- User language preference: `en / zh-TW / zh-CN / ja / ko`

## Recently Completed

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
- Removed duplicate app-level navigation from the review page-local header so review pages now keep global navigation in the shared shell and review context in the local header.
- Added `UI_REFACTOR_EXECUTION_PLAN.md` as the active execution plan for this UI restructure.

Important files:
- `src/app/analyze/page.tsx`
- `src/app/review/new/page.tsx`
- `src/app/review/[id]/page.tsx`
- `src/app/review/layout.tsx`
- `src/components/review/review-surface.tsx`
- `src/components/app/app-shell.tsx`
- `src/app/analyze/_components/session-header.tsx`
- `UI_REFACTOR_EXECUTION_PLAN.md`

### User Language Preference (`895a73b`)

- `users.preferred_language` column added via `ALTER TABLE IF NOT EXISTS` (auto-migrates on next boot).
- `AccountContext` carries `preferredLanguage`; `ensureUserAccountByEmail` reads and returns it.
- `GET /api/me` returns current user profile including language.
- `PATCH /api/me` updates language (validates against supported list).
- `/api/sessions/[id]/run` reads the authenticated user's `preferredLanguage` and passes it into `CouncilRunOptions`.
- `buildSeatRuntimePrompt`, `buildRound1Prompt`, `buildBoundedRound2Prompt`, `buildModeratorSystemPrompt` all accept and inject the language instruction when non-English.
- Language selector dropdown in home sidebar footer (collapses when sidebar is collapsed).

Important files:
- `src/lib/db/account-db.ts`
- `src/lib/core/council-types.ts`
- `src/lib/core/council.ts`
- `src/lib/prompts/council-prompts.ts`
- `src/lib/prompts/council-bounded-prompts.ts`
- `src/app/api/me/route.ts`
- `src/app/api/sessions/[id]/run/route.ts`
- `src/app/home/layout.tsx`

### Debate UX — Thinking Indicators, Moderator Card, Markdown, Stream Error Fix (`dd39fb7`)

- `ThinkingDots` component: 3 animated dots + role-specific cycling phrase while agent has no text yet.
- `AgentRoster`: active agent badge + activity phrase in the timeline header.
- `BetweenTurnStatus`: "X is preparing their response…" shown between completed turns.
- `IngestProgress`: honest 3-step stepper animation during paper ingestion (Fetching → Embedding → Preparing).
- `ModeratorConclusion`: Moderator's JSON output rendered as structured card — confidence badge, summary, consensus (green), veto (red), numbered action items with priority badges, dissent table.
- `EvidenceAnnotatedMarkdown`: inline `**bold**`, `*italic*`, `***bold-italic***`, `` `code` `` rendering via regex pass before block rendering.
- `streamErrored` guard in `use-council-review.ts`: prevents `onDone` from overwriting `phase='error'` after a Gemini 503 or other stream error. Applied to both `start()` and `resumeSession()`.
- All incomplete messages marked `isComplete: true` on stream close so thinking bubbles always clear.
- Playwright `council-runtime.spec.ts`: fixed 3 failing tests by handling `ensureAccountSchema` CREATE TABLE SQL in mock DB. Now 15/15 passing.

Important files:
- `src/components/council/agent-message.tsx`
- `src/components/council/discussion-timeline.tsx`
- `src/components/council/evidence-annotated-markdown.tsx`
- `src/components/council/review-setup-panel.tsx`
- `src/components/council/moderator-conclusion.tsx` (new)
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
- `npm run build` ✓
- `npx playwright test tests/council-runtime.spec.ts` — 15/15 ✓
- `npx jest src/__tests__/paper-ingest.test.ts --runInBand` ✓
- `npx jest src/__tests__/council-access.test.ts --runInBand` ✓
- `npx jest src/__tests__/council-prompts.test.ts src/__tests__/council-session-hydrator.test.ts --runInBand` ✓

## Known Remaining Work

**P0 — quality / reliability:**
- Async/background embedding pipeline (currently blocks the request path on first ingest)
- Retry/fallback when Gemini 503s during a debate turn (currently shows error banner)

**P1 — product features:**
- Semantic Scholar paper search integration
- Multi-paper comparison table
- Review history / project grouping

**P2 — infrastructure:**
- Formal paper asset model (`paper_assets`, `libraries`, `library_documents`)
- Background job execution instead of frontend-owned SSE lifecycle
- Billing entitlement model
- Audit, deletion, export, retention primitives

**P3 — i18n:**
- Full UI internationalization (`next-intl` or `react-i18next`)
- Currently only agent output language is dynamic; all UI labels remain English

## Files Outside This Status File

- `PRODUCT_SPEC.md` — product shape and original spec
- `COMMIT_GUIDE.md` — commit workflow notes
- `CLAUDE.md` — project/agent context notes
