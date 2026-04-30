# Council Project Status

Updated: 2026-05-01

This is the single current progress file for the project. Older roadmap, audit, and planning files were removed because they mixed outdated assumptions with completed work.

## Current Branch State

- Branch: `main`
- Remote state before this document cleanup: local branch was ahead of `origin/main` by 4 commits.
- Latest committed work:
  - `6ae0f8f Polish latest UI flow`
  - `5333b87 pre-layrr snapshot`
  - `9111c3f pre-layrr snapshot`
  - `7cc68a7 Add saved session restore and evidence display`

## Product State

Council is currently a working Next.js app for AI-assisted academic paper review.

The app supports:

- landing page review entry by arXiv ID
- landing page PDF upload handoff into `/analyze`
- authenticated dashboard and reviews list
- saved review navigation through `/analyze?session=<id>`
- restored saved review display from PostgreSQL
- initial running-session resume path
- reviewer debate timeline
- comparison/map views
- evidence/tool cards
- right-side paper/source panel
- chat with paper for saved sessions that have an attached paper library
- API key and Stripe-related routes
- workspace-aware sessions, API keys, team templates, and upload metadata

## Recently Completed

### Saved Review Restore

Completed in the 2026-04-30 work:

- Added explicit restore service and hydrator layers.
- Saved sessions can be loaded from dashboard/reviews into `/analyze?session=<id>`.
- Persisted turns, conclusions, and evidence are rebuilt into the frontend discussion session.
- Running sessions have an initial resume/reconnect path.
- Last opened session convenience state exists on the client, while PostgreSQL remains the real source of truth.

Important files:

- `src/lib/services/council-session-service.ts`
- `src/lib/services/council-session-hydrator.ts`
- `src/lib/services/council-session-restore.ts`
- `src/hooks/use-council-review.ts`
- `src/app/analyze/page.tsx`
- `tests/current-ui-flow.spec.ts`

### Latest UI Flow Polish

Committed as `6ae0f8f`.

Completed:

- Reviews page has search and status filters.
- Reviews page includes `Failed` filtering.
- Reviews can be deleted from the list.
- Delete now checks the backend response before removing the row.
- Delete failure shows an inline error instead of silently failing.
- Playwright test now targets the exact `Reviews` navigation link.
- Playwright test covers landing page PDF upload handoff to `/analyze`.

Important files:

- `src/app/home/reviews/page.tsx`
- `tests/current-ui-flow.spec.ts`

## Recently Completed

### Anonymous Local Review Streaming Fix

Completed in the 2026-05-01 work:

- Fixed anonymous review ownership on local `npm start` / production-mode localhost.
- Anonymous session cookies are no longer marked `Secure` when the configured app URL is localhost, `127.0.0.1`, or `::1`.
- This restores the flow where `/api/papers/upload` or `/api/sessions` creates an anonymous session and `/api/sessions/{id}/run` can pass ownership checks on `http://localhost:3001`.
- Verified a real anonymous `/run` SSE stream emits:
  - `session_start`
  - `round_start`
  - `turn_start`
  - `turn_delta`
  - `turn_done`
  - `moderator_start`
  - `moderator_delta`
  - `conclusion`
  - `session_done`

Important files:

- `src/lib/core/council-access.ts`
- `src/app/api/sessions/[id]/run/route.ts`
- `src/__tests__/council-access.test.ts`

### Citation Marker and RAG Source Reliability

Completed in the 2026-05-01 work:

- `CouncilEvidenceSource` and frontend `SourceRef` now support optional `marker`, such as `[1]`.
- RAG evidence parsing can read numbered evidence blocks and preserve:
  - marker
  - title/label
  - URL
  - snippet
- live `tool_result` events preserve marker data.
- saved-session hydration preserves marker data.
- reviewer text containing `[1]` can hover directly to that source, instead of relying only on sentence similarity.
- source panel displays marker labels such as `[1] Attention Is All You Need`.
- Reviewer seats with a paper `library_id` now preload a constrained `rag_query` before the model writes its turn, instead of relying on the model to voluntarily call the tool.
- The preloaded RAG path emits normal `tool_call` and `tool_result` SSE events and persists normal `council_evidence.source_refs`.
- If the model receives valid source refs but fails to cite them in the final Evidence section, the saved turn now appends citation bullets from the retrieved refs.

Important files:

- `src/lib/core/council.ts`
- `src/lib/prompts/council-prompts.ts`
- `src/lib/evidence-annotations.ts`
- `src/components/council/evidence-annotated-markdown.tsx`
- `src/components/council/source-panel.tsx`
- `src/hooks/use-council-review.ts`
- `src/lib/services/council-session-hydrator.ts`

Validation run:

- `npm run build` passed.
- `npx jest src/__tests__/council-access.test.ts --runInBand` passed.
- `npx jest src/__tests__/council-prompts.test.ts src/__tests__/council-session-hydrator.test.ts --runInBand` passed.
- Live `next start` verification on localhost with an anonymous session passed.
- Live citation verification produced `tool_result.sourceRefs`, persisted `council_evidence.source_refs`, and saved final reviewer Evidence text citing `https://arxiv.org/pdf/1706.03762`.

Known test gap:

- `npx playwright test tests/council-runtime.spec.ts` still has 3 failures because the test DB mock does not handle the newer account schema bootstrap SQL from `ensureAccountSchema`.
- The failing runtime tests fail before the citation code path and should be fixed by updating the mock schema handling, not by changing runtime behavior.

## Known Remaining Product Work

These are still future work, not the latest active task:

- formal paper asset model:
  - `paper_assets`
  - `paper_asset_sources`
  - `libraries`
  - `library_documents`
- stronger migration/backfill from legacy email ownership
- background job/worker execution instead of frontend-owned SSE lifecycle
- audit, deletion, export, retention, and recovery primitives
- billing entitlement model
- Gemini provider context cache and lifecycle cleanup

## Current Verification Baseline

Last known passing checks:

- `npm run build`
- `npx jest src/__tests__/council-access.test.ts --runInBand`
- `npx jest src/__tests__/council-prompts.test.ts src/__tests__/council-session-hydrator.test.ts --runInBand`

Last known partial check:

- `npx playwright test tests/council-runtime.spec.ts` has 12 passing and 3 failing due to account schema SQL missing from the test DB mock.

## Files Kept Outside This Status File

These are not progress logs and should remain:

- `PRODUCT_SPEC.md` - product shape and original spec
- `COMMIT_GUIDE.md` - commit workflow notes
- `CLAUDE.md` - project/agent context notes

## Practical Next Step

Do not start the large paper asset or billing work yet.

The next useful task is to clean the working tree:

1. Decide whether the deleted roadmap/planning Markdown files should be permanently removed or restored.
2. Remove or archive `.tmp-live-sse*` captures.
3. Fix the `tests/council-runtime.spec.ts` account-schema DB mock gap.
4. Run the broader unit and UI checks again before starting project-count cleanup or repository pruning.
