# Council

**AI-powered multi-agent peer review and adversarial debate for academic research.**

Council simulates a peer review committee for your paper — or lets two AI teams debate any "A vs B" question — using domain-specialist reviewers backed by real literature search.

---

## What it does

### Academic Critique (`/review/new`)

Upload a paper (arXiv ID or PDF), choose a research domain, and a panel of 5 specialist AI reviewers debates your work in two rounds. A moderator synthesises the debate into a structured report:

- **Editorial decision** — Accept / Minor Revision / Major Revision / Reject
- **Questions to prepare** — each flagged issue traced to literature, with a suggested response
- **Consensus & dissent** — where reviewers agree, where they split, and the resolution path
- **Action items** — prioritised list of what must change before submission

Four domain-specific panels are available:

| Domain | Specialists |
|---|---|
| General Academic | Methods Critic, Literature Auditor, Replication Skeptic, Contribution Evaluator, Constructive Advocate |
| Materials & Chemistry | Material Rationalist, Characterization Auditor, Performance Benchmarker, Synthesis Skeptic, Commercial Assessor |
| Biomedical & Life Sci | Safety Examiner, Translational Skeptic, Regulatory Analyst, Competing Therapy Auditor, Clinical Benchmarker |
| Physics & Devices | Device Integrator, Efficiency Auditor, Fabrication Skeptic, Reliability Examiner, System Benchmarker |

### Adversarial Debate (`/debate/new`)

Compare any two options — materials, methods, models, or approaches. Pick a domain and 2–3 specialist roles. Each role is mirrored into two teams: one advocates for Option A, one for Option B. A moderator delivers an evidence-based verdict.

Example: *MXene vs Graphene* → Material Rationalist (MXene) vs Material Rationalist (Graphene), Synthesis Skeptic (MXene) vs Synthesis Skeptic (Graphene), + neutral Moderator.

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js (App Router), React 19 |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | PostgreSQL (Docker, port 5433) |
| LLM | Google Gemini (via API) |
| Streaming | Server-Sent Events (SSE) |
| Auth | NextAuth.js |
| Payments | Stripe |
| Testing | Jest, Playwright |

---

## Local development

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)
- A `.env.local` file (see below)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the database
docker compose up -d

# 3. Start the dev server
npm run dev
```

App runs at `http://localhost:3000`.

### Required environment variables (`.env.local`)

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/council

# LLM
GEMINI_API_KEY=...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Stripe (optional for local)
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...

# Misc
RAG_ALLOW_GEMINI_FALLBACK=0
```

### Key commands

```bash
npm run dev          # dev server with hot reload
npm run build        # production build
npm run test:unit    # Jest unit tests
npx playwright test  # Playwright e2e tests
```

---

## Project structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Landing page
│   ├── review/new/             # Paper review entry (draft + team setup)
│   ├── review/[id]/            # Session workspace
│   ├── debate/new/             # Adversarial debate wizard
│   ├── home/                   # Authenticated dashboard
│   └── api/                    # API routes
│       ├── papers/upload/      # Paper ingestion + session creation
│       ├── sessions/[id]/      # Session streaming, export, chat
│       └── ...
├── components/
│   ├── review/                 # Review flow UI (draft layout, session workspace)
│   ├── council/                # Shared debate UI (timeline, compare, map, agents)
│   └── debate/                 # Adversarial debate wizard components
├── lib/
│   ├── core/
│   │   ├── council-academic.ts # All domain seat definitions (4 domains × 5 seats)
│   │   ├── council.ts          # Session orchestrator
│   │   ├── council-types.ts    # Shared types (CouncilSeat, CouncilSession, etc.)
│   │   └── debate-strategy.ts  # DebateStrategy abstraction (critique / adversarial)
│   ├── prompts/
│   │   ├── review-presets.ts   # buildDomainTeam(), buildEditableTeam(), ReviewDomain
│   │   └── debate-presets.ts   # buildAdversarialTeam(), AdversarialDebateConfig
│   └── db/                     # Database layer (council-db.ts, account-db.ts, etc.)
├── hooks/
│   └── use-council-review.ts   # Main debate lifecycle hook (start/load/resume/rerun)
└── types/
    └── council.ts              # UI-facing types (AgentUI, DEFAULT_AGENTS, etc.)
```

---

## Debate architecture

### Two modes

```
critique (default)
  → All seats attack the same paper from different angles
  → Round 1: parallel (all seats write independently)
  → Round 2: sequential (each seat reads prior turns before responding)
  → Moderator: consensus + dissent + editorial decision

adversarial
  → Seats split into Team A and Team B; each team advocates for their option
  → Round 1: parallel
  → Round 2: interleaved (A₁→B₁→A₂→B₂, each seat sees the opponent's latest)
  → Moderator: winning_team verdict + evidence summary
```

### Seat structure

```typescript
interface CouncilSeat {
  role: string
  model: string
  systemPrompt: string
  bias?: string
  tools?: string[]      // "rag_query" | "search_papers" | "web_search" | ...
  team?: string         // "option_a" | "option_b" | "moderator" (adversarial only)
}
```

---

## Planning documents

| Document | Purpose |
|---|---|
| `SAAS_PLAN.md` | Product strategy, completed phases, Phase 5 candidates |
| `PROJECT_STATUS.md` | Current build state, recent changes, known remaining work |
| `COMMIT_GUIDE.md` | Commit message conventions |
| `docs/archive/` | Completed specs and historical planning docs |
