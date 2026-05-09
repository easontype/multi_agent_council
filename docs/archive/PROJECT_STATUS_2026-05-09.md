# Council — Project Status

**Updated:** 2026-05-09  
Single source of truth for current project state. Supersedes all older roadmap and planning files.

---

## Current State

**Branch:** `main` (local, not yet pushed)  
**Build:** passing  
**Last completed work:** Phase 6-4 multi-paper comparison table

---

## What Works Today

Council is a production-grade Next.js app for AI-assisted academic paper review and adversarial debate.

**Tech stack:** Next.js (App Router), React 19, PostgreSQL (Docker `cap_postgres` port 5433), SSE streaming, Tailwind v4, shadcn/ui.

### New Unified Entry Flow (`/home`)

- `DomainPicker` — 4 domains, persisted to localStorage
- `PaperInputBox` — inline state machine: idle → arxiv_fetching → preview → confirming → confirmed
- Confirmed state expands two mode cards: Review (`/review/setup/[assetId]`) and Debate (`/debate/setup/[assetId]`)
- `POST /api/papers/asset` — creates paper asset without building a session; fires background embedding
- `GET /api/papers/preview?arxiv=ID` — instant title/abstract fetch, no embedding

### Review Setup Flow (`/review/setup/[assetId]`)

- Mode selector: Critique vs Gap Analysis
- Rounds: 1 or 2
- `POST /api/sessions/from-asset` → redirect to `/review/[sessionId]`

### Debate Setup Flow (`/debate/setup/[assetId]`)

- Option A / Option B / Context inputs
- Role selector with per-seat system prompt editing (collapsible textarea, reset to default)
- `POST /api/sessions/from-asset` with `sessionType: 'debate'`

### Legacy Flows (still accessible, not in nav)

- `/review/new` — old step wizard (kept for backwards-compat)
- `/debate/new` — old 4-step debate wizard (kept for backwards-compat)

### Session Workspace (`/review/[id]`)

- View switching: Timeline / Compare / Map
- Adversarial sessions: verdict banner (`VerdictBanner`) showing winning team (teal = Side A, red = Side B, gray = Draw) with trophy/draw icon
- Evidence citations: inline hover tooltips, source panel scroll, clickable source chips
- Agent thinking indicators, between-turn status, honest ingest progress stepper
- Session restore, resume, rerun, duplicate-as-new
- Share (public/private), Markdown export (Meeting Prep Report format)

### Multi-Paper Comparison (`/home/compare`)

- 2–4 arXiv ID inputs with add/remove
- `POST /api/compare/papers` — fetches abstracts in parallel, runs single LLM call, returns structured JSON
- Comparison table: Methodology / Data & Experiments / Contributions / Limitations / Novelty per paper
- Synthesis verdict paragraph below table
- Sidebar nav entry "Compare" added

### Academic Search (`search_papers` tool)

- Sources: OpenAlex + arXiv + Semantic Scholar (all three in "both" mode, S2 non-fatal)
- Semantic Scholar: `fieldsOfStudy` filter, `sort_by_citations` option

### Platform

- Dashboard, reviews list with search / filter / delete
- API keys, Stripe-related routes
- User language preference (agent output: en / zh-TW / zh-CN / ja / ko)
- Paper deduplication by content hash (reuses embeddings on re-submit)

---

## Completed Phases

| Phase | 說明 | 狀態 |
|---|---|---|
| 1 | 席位定義（4 套域 + heuristic 分類器） | ✅ |
| 2 | Editorial Decision + Meeting 前準備報告 Export | ✅ |
| 3 | DebateStrategy 重構 + Adversarial 後端 + Position tracking | ✅ |
| 4A | Critique 域選擇 UI（`/review/new` Step 0） | ✅ |
| 4B | Adversarial Debate Wizard（`/debate/new`） | ✅ |
| Flow A | 拆依賴、封存舊入口、更新 sidebar | ✅ |
| Flow B | `POST /api/papers/asset` + `GET /api/papers/preview` | ✅ |
| Flow C | `/home` 重設計：DomainPicker + PaperInputBox + mode cards | ✅ |
| Flow D | `/review/setup/[assetId]` + `POST /api/sessions/from-asset` | ✅ |
| Flow E | `/debate/setup/[assetId]` 含角色選擇 | ✅ |
| 5-1 | Background embedding pipeline（ingest 非同步） | ✅ |
| 5-2 | Gemini 503 retry + fallback to claude-haiku-4-5 | ✅ |
| 6-1 | Debate 結果頁 `VerdictBanner`（winning_team 顯示） | ✅ |
| 6-2 | Debate wizard per-seat system prompt 編輯 | ✅ |
| 6-3 | Semantic Scholar 整合（fieldsOfStudy + citation sort） | ✅ |
| 6-4 | 多論文比較表（`/home/compare` + `/api/compare/papers`） | ✅ |
| 7-1 | Paper asset 重複 ingest 競態條件修復（23505 catch + re-fetch） | ✅ |
| 7-2 | Session job registry — 背景執行，SSE 斷線後可重連繼續接收 | ✅ |
| 7-3 | Entitlements 集中管理（`lib/entitlements.ts`，7 個 route 更新） | ✅ |
| 8-1 | UI i18n — 5 語言翻譯系統（`lib/i18n/`），AppShell + DomainPicker + Compare | ✅ |

---

## Roadmap

*All planned phases (1–8) are complete. See Deferred for items intentionally postponed.*

---

## Deferred（刻意延後）

| 項目 | 原因 |
|---|---|
| Evidence weighting 品質評分 | 需額外 LLM call，成本高，MVP 後再做 |
| 超過 3 個角色的鏡像（>6 席） | 成本控制，有需求再開放 |
| Adversarial Round 3+（多輪對決） | 2 輪已足夠 |
| 報告 PDF 匯出 | Markdown 目前足夠 |

---

## Active Documents

| File | Purpose |
|---|---|
| `README.md` | Project overview, setup, dev guide |
| `CLAUDE.md` | Agent context for Claude Code sessions |
| `COMMIT_GUIDE.md` | Commit message conventions |

## Archived Documents

Completed plans and one-time specs moved to `docs/archive/`:

| File | Notes |
|---|---|
| `SAAS_PLAN.md` | Product strategy v0.4 — superseded by this document (2026-05-09) |
| `PHASE4_SPEC.md` | Phase 4A/4B implementation spec — fully implemented |
| `REFACTOR_PLAN.md` | Architecture review from 2026-05-01 — superseded |
| `PRODUCT_SPEC.md` | Early product spec from 2026-04-14 — superseded |
| `PAPER_CACHE_AND_TOPIC_PLAN.md` | Paper cache plan — features implemented |
| `CITATION_FEATURE_PLAN.md` | Citation UI plan — fully implemented |
| `UI_REFACTOR_EXECUTION_PLAN.md` | UI refactor plan — fully implemented |
