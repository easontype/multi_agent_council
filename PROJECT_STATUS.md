# Council — Project Status

**Updated:** 2026-05-09  
Single source of truth for current project state. Supersedes all older roadmap and planning files.

---

## Current State

**Branch:** `main` (7 commits ahead of origin/main)  
**Build:** passing  
**Last commit:** `8e87088` — feat(phase-4): domain-aware review setup + adversarial debate wizard

---

## What Works Today

Council is a production-grade Next.js app for AI-assisted academic paper review and adversarial debate.

**Tech stack:** Next.js (App Router), React 19, PostgreSQL (Docker `cap_postgres` port 5433), SSE streaming, Tailwind v4, shadcn/ui.

### Core Review Flow (`/review/new`)

- Step 0: Research domain picker (General / Materials / Biomedical / Physics)
- Step 1: arXiv ID input or PDF upload, paper preview
- Step 2 (team setup): mode selection, rounds, per-seat prompt editing, team templates
- Domain-aware seat initialisation via `buildDomainTeam()` — each domain loads its specialist seats
- Launch → SSE streaming multi-agent debate (Round 1 + conditional Round 2)
- Moderator synthesis: Editorial Decision (Accept / Major / Minor / Reject), action items, consensus/dissent, Questions to Prepare

### Adversarial Debate Flow (`/debate/new`) ← New in Phase 4B

- 4-step wizard: paper upload → topic (A vs B) → domain → role selection
- Mirror-team builder: each selected role duplicated for Option A and Option B
- Live seat preview (Team A / Team B / Moderator count)
- Submits to existing `/api/papers/upload` + session stream — zero backend changes

### Session Workspace (`/review/[id]`)

- View switching: Timeline / Compare / Map
- Evidence citations: inline hover tooltips, source panel scroll, clickable source chips
- Agent thinking indicators, between-turn status, honest ingest progress stepper
- Session restore, resume, rerun, duplicate-as-new
- Share (public/private), Markdown export (Meeting Prep Report format)

### Platform

- Dashboard, reviews list with search / filter / delete
- API keys, Stripe-related routes
- User language preference (agent output: en / zh-TW / zh-CN / ja / ko)
- Paper deduplication by content hash (reuses embeddings on re-submit)

---

## Recently Completed

### Phase 4B — Adversarial Debate Wizard (`8e87088`, 2026-05-09)

New files:
- `src/lib/prompts/debate-presets.ts` — `AdversarialDebateConfig` + `buildAdversarialTeam()` (mirror seats)
- `src/app/debate/new/page.tsx` — 4-step wizard page
- `src/components/debate/debate-setup/debate-setup-panel.tsx` — wizard container with step header, progress bar
- `src/components/debate/debate-setup/role-selector.tsx` — checkbox grid + live A/B preview
- `src/components/debate/debate-setup/topic-input.tsx` — Option A vs Option B form

Modified:
- `src/app/page.tsx` — "Compare & Debate" feature card + footer link

### Phase 4A — Critique Domain Selector (`8e87088`, 2026-05-09)

- `src/lib/prompts/review-presets.ts` — `ReviewDomain` type, `REVIEW_DOMAIN_OPTIONS`, `buildDomainTeam()`
- `src/components/review/new/review-draft-layout.tsx` — Step 0 domain picker (2×2 radio cards)
- `src/components/review/use-review-draft-state.ts` — `domain` state, passes via URL param
- `src/components/review/review-surface.tsx` — wires domain props through
- `src/components/review/new/team-setup-surface.tsx` — reads `domain` param, initialises seats
- `src/components/council/review-setup-panel.tsx` — optional `domainLabel` badge

### Phase 3 — Quality, DebateStrategy, Adversarial Backend

- `DebateStrategy` abstraction (`debate-strategy.ts`)
- Adversarial mode: `debate_mode` field, `team` field per seat, interleaved Round 2, `winning_team` verdict
- Position tracking: `position_changed`, `position_change_reason` on `council_turns`
- Round 2 word-limit relaxation (experimental 400w, general 300w)

### Phase 2 — Report Export Format

- `editorial_decision` (Accept / Minor Revision / Major Revision / Reject) in moderator output
- `questions` array (raised_by, literature, suggestion) in moderator output
- Export route rewritten as "Meeting Prep Report" Markdown format

### Phase 1 — Seat Definitions

- 4 domain seat sets in `council-academic.ts`
- Heuristic + LLM classifier for 8 templates

---

## Known Remaining Work

**P0 — stability**
- Async/background embedding pipeline (first ingest currently blocks the request path ~30–60s)
- Gemini 503 retry/fallback (currently shows error banner, no auto-retry)

**P1 — product**
- Adversarial result page: highlight `winning_team` prominently
- Debate wizard: per-seat system prompt editing (currently uses preset only)
- Semantic Scholar search integration upgrade
- Multi-paper comparison table (`paper-compare-table.tsx` has skeleton)

**P2 — infrastructure**
- Canonical paper asset model (`paper_assets / libraries / library_documents`)
- Background job execution (move debate off frontend-owned SSE lifecycle)
- Billing entitlement model

**P3 — i18n**
- Full UI internationalisation (`next-intl`); currently only agent output is dynamic

---

## Active Documents

| File | Purpose |
|---|---|
| `README.md` | Project overview, setup, dev guide |
| `SAAS_PLAN.md` | Product strategy, phase roadmap, what's next |
| `CLAUDE.md` | Agent context for Claude Code sessions |
| `COMMIT_GUIDE.md` | Commit message conventions |

## Archived Documents

Completed plans and one-time specs moved to `docs/archive/`:

| File | Notes |
|---|---|
| `PHASE4_SPEC.md` | Phase 4A/4B implementation spec — fully implemented |
| `REFACTOR_PLAN.md` | Architecture review from 2026-05-01 — superseded |
| `PRODUCT_SPEC.md` | Early product spec from 2026-04-14 — superseded |
| `PAPER_CACHE_AND_TOPIC_PLAN.md` | Paper cache plan — features implemented |
| `CITATION_FEATURE_PLAN.md` | Citation UI plan — fully implemented |
| `UI_REFACTOR_EXECUTION_PLAN.md` | UI refactor plan — fully implemented |
