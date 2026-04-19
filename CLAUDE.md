# Council — Codebase Guide

## What this is

Council is a multi-agent academic paper review platform. Researchers upload a PDF or provide an arXiv ID; a configurable panel of AI reviewers debates the paper in 1–2 rounds, then a Moderator synthesizes the debate into a structured conclusion (summary, consensus, dissent, action items, confidence rating). Target audience: researchers preparing submissions or revisions.

## Running locally

```bash
# Install deps (first time)
npm install

# Dev server (port 3001)
npm run dev

# Production build + start
npm run build && npm start  # also port 3001
```

**Required environment variables** (create `.env.local`):

```
DATABASE_URL=postgresql://user:pass@localhost:5432/council
GEMINI_API_KEY=...           # primary seat/moderator model
ANTHROPIC_API_KEY=...        # optional; enables native tool use for Claude seats
AUTH_SECRET=...              # NextAuth secret (any random string)

# Optional OAuth (falls back to credential login in dev)
AUTH_GITHUB_ID / AUTH_GITHUB_SECRET
AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET

# Dev defaults (no .env.local needed in development)
# admin@council.local / dev-password
```

Schema is auto-created on first request via `ensureCouncilSchema()` — no manual migration step required.

## Architecture

**Core data flow:**

1. User uploads PDF or arXiv ID → `POST /api/papers/upload` → `paper-ingest.ts` extracts text, ingests into `documents` table, creates a `council_session` with pre-configured seats
2. Client calls `POST /api/sessions/[id]/run` → streams SSE events
3. Server runs `runCouncilSession()` in `src/lib/core/council.ts`:
   - **Round 1**: all seats run in parallel, each sees only the topic/paper text
   - **Divergence check**: LLM classifies disagreement level (`none/low/moderate/high`) — skips Round 2 if `none` or `low`
   - **Round 2** (if needed): seats run **sequentially**, each seeing prior Round 2 turns for genuine cross-argument
   - **Moderator**: synthesizes all turns into structured JSON (summary, consensus, dissent, action items, veto, confidence)
4. Each seat turn runs through `runAgenticRuntime()` — a tool-use loop supporting web search, paper fetch, RAG query
5. Frontend hook `useCouncilReview` consumes the SSE stream and updates React state in real time

Sessions are **resumable**: existing turns are reused unless `forceRestart: true` is passed. Stale running sessions (no heartbeat for 15 min) are reclaimed.

## Key directories

```
src/app/api/              — Next.js API routes (see API routes section below)
src/lib/core/             — Debate engine: council.ts, council-types.ts, council-academic.ts
src/lib/agents/           — agentic-runtime.ts: tool-use loop for all seat models
src/lib/llm/              — LLM provider adapters: claude.ts, gemini.ts, ollama.ts, openai.ts
src/lib/prompts/          — Prompt builders: council-prompts.ts, council-bounded-prompts.ts, review-presets.ts
src/lib/db/               — DB helpers: db.ts (pg Pool), council-db.ts (schema + CRUD)
src/lib/tools/            — Tool handlers (web search, fetch URL, RAG query, paper search) + schema + parser
src/types/                — Shared TS types: agent.ts (AgentDB/AgentUI), council.ts (UI models)
src/hooks/                — use-council-review.ts: main client-side hook for running a review
src/components/council/   — Council-specific React components
src/components/ui/        — shadcn/ui primitive components
src/__tests__/            — Jest unit tests
tests/                    — Playwright e2e tests
```

## Core concepts

| Term | Meaning |
|------|---------|
| **Session** | One debate run. Has a topic, 1–2 rounds, N seats, and one Moderator. Stored in `council_sessions`. |
| **Seat** | A single AI reviewer slot. Defined by `role` (name), `model`, `systemPrompt`, optional `bias`, and allowed `tools`. |
| **Round** | Seats respond in isolation (Round 1) or sequentially with cross-visibility (Round 2). `MODERATOR_ROUND = 99`. |
| **Turn** | One seat's output in one round. Stored in `council_turns`. |
| **Conclusion** | Moderator's structured JSON synthesis. Stored in `council_conclusions`. Fields: `summary`, `consensus`, `dissent[]`, `action_items[]`, `veto`, `confidence`. |
| **Evidence** | Tool calls made by seats during a turn. Stored in `council_evidence` with source refs (URI, snippet). |
| **ReviewMode** | `'critique'` (balanced panel) or `'gap'` (adversarial/gap-finding panel). Determines default seat lineup. |

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/papers/upload` | POST | Ingest PDF (multipart) or arXiv ID (JSON), create session, return `{ sessionId, paperTitle }` |
| `/api/sessions` | GET | List sessions for authenticated user |
| `/api/sessions` | POST | Create a council session directly (without paper upload) |
| `/api/sessions/[id]` | GET | Get session bundle (session + turns + conclusion + evidence) |
| `/api/sessions/[id]/run` | POST | Run/resume session; returns SSE stream of `CouncilEvent` |
| `/api/sessions/[id]/chat` | POST | Post-debate paper chat (RAG-backed Q&A) |
| `/api/sessions/[id]/export` | GET | Export session as markdown/JSON |
| `/api/v1/sessions` | — | REST v1 alias (same backing logic) |
| `/api/teams` | — | Saved team templates |
| `/api/keys` | — | User API key management |
| `/api/auth/...` | — | NextAuth endpoints |

Anonymous users can create and run sessions (rate-limited: 3 creates / 10 min, 3 runs / 10 min). A cookie-based access token ties them to their sessions. Authenticated users see all their sessions via GET.

## LLM providers

The default model for seats and Moderator is **`gemma-4-31b-it`** (Google Gemini API).

| Provider | Model prefix | Detection function | Key env var |
|----------|--------------|--------------------|-------------|
| Gemini / Gemma | `gemini*` or `gemma*` | `isGeminiModel()` | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| Anthropic | anything else (not ollama/gemini/openai) | `isAnthropicModel()` | `ANTHROPIC_API_KEY` |
| Ollama (local) | `ollama/...` | `isOllamaModel()` | none (HTTP to localhost) |
| OpenAI | detected by `isOpenAIModel()` | `isOpenAIModel()` | `OPENAI_API_KEY` |

**Native tool use** (Anthropic structured tool calls) activates automatically when `ANTHROPIC_API_KEY` is present and the seat model is Anthropic. All other models use text-based `[TOOL_CALL]...[/TOOL_CALL]` parsing.

To change the default model, edit the `DEFAULT_*_MODEL` constants in `src/lib/core/council.ts` (lines 111–114) and `src/lib/llm/gemma-models.ts`.

## Database

- **Driver**: `pg` (node-postgres), connection pool via `src/lib/db/db.ts`
- **Config**: set `DATABASE_URL` in `.env.local`
- **Schema**: auto-created on first request by `ensureCouncilSchema()` in `src/lib/db/council-db.ts` — idempotent `CREATE TABLE IF NOT EXISTS`

**Core tables:**
- `council_sessions` — session metadata, seats (JSONB), status, heartbeat
- `council_turns` — per-seat per-round responses with token counts
- `council_conclusions` — Moderator JSON synthesis (one per session)
- `council_evidence` — tool calls and source refs per turn
- `documents` — ingested paper chunks for RAG
- `document_chunks` — chunked text with embeddings (if RAG enabled)

No migration tool. Schema changes must be applied manually or by dropping/recreating tables in dev.

## Testing

```bash
# Unit tests (Jest)
npm run test:unit

# E2E tests (Playwright — requires dev server running on port 3001)
npm run test:e2e
```

Unit tests live in `src/__tests__/`. Mocks are in `src/__tests__/__mocks__/`. Tests cover: prompt builders, turn normalizer, config validation.

Playwright config: `playwright.config.ts`. Tests live in `tests/`.

## Common tasks

**Add a new seat role to the default critique lineup:**
Edit `src/lib/core/council-academic.ts` → `buildAcademicCritiqueSeats()`. Mirror metadata in `src/lib/prompts/review-presets.ts` → `CRITIQUE_META`.

**Add a new tool for seats to use:**
1. Add handler in `src/lib/tools/handlers/` (web or rag)
2. Register it in `SAFE_PLATFORM_TOOL_HANDLERS` and `SAFE_PLATFORM_TOOL_DOCS` in `src/lib/agents/agentic-runtime.ts`
3. Add Anthropic schema to `src/lib/tools/schema.ts` (for native tool use)

**Add a new LLM provider:**
1. Create `src/lib/llm/yourprovider.ts` with `isYourModel()`, `runYourProvider()`, `streamYourProviderText()`
2. Export from `src/lib/llm/index.ts`
3. Add detection branch in `streamLLM()` / `runLLM()` in `src/lib/llm/claude.ts`

**Create a session programmatically (API):**
```
POST /api/sessions { topic, seats: [{role, model, systemPrompt, tools}], rounds: 1|2 }
POST /api/sessions/[id]/run {}   ← returns SSE stream
```

## What NOT to do

- **Do not** call `taskkill /IM node.exe` — it will also kill the parent Claude process.
- **Do not** manually migrate the DB schema — `ensureCouncilSchema()` is idempotent and runs on startup. Drop tables in dev if you need a clean slate.
- **Do not** hardcode model names outside of `src/lib/core/council.ts` constants and `gemma-models.ts` — the model routing is centralized in `streamLLM()`.
- **Do not** add platform-specific tool handlers directly in `runSeatTurn()` — go through `agentic-runtime.ts` so rate limiting, arg overrides, and evidence tracking apply.
- **Do not** rebuild after every UI change in dev (`npm run dev` handles HMR). Rebuild (`npm run build`) only before deploying or running e2e tests against production bundle.
- **Anonymous sessions** use a cookie-based access token (set at session creation). If you clear cookies or change `ACCESS_TOKEN_SALT`, existing anonymous sessions become inaccessible.
- `MODERATOR_ROUND = 99` is a magic constant used to distinguish the Moderator turn from seat turns in DB queries. Do not change it without updating all queries.
