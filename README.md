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

## Security

> Red team exercise conducted on 2026-05-16, prior to production launch.
> Attack-then-fix methodology: each vulnerability was first proven exploitable with a PoC,
> then patched and re-tested to confirm the fix.

### Attack surface overview

| ID | Vector | Severity | Status |
|---|---|---|---|
| P0 | Rate limit bypass via IP header spoofing | Critical | **Fixed** |
| P1-a | PDF parsing bomb (CPU DoS) | High | **Fixed** |
| P1-b | Prompt injection via `systemPrompt` / `bias` | Medium | Pending |
| P2-a | SSRF — DNS rebinding bypass | Medium | Pending |
| P2-b | Anonymous session cookie hygiene | Low-Medium | Pending |
| P3 | Error message information leakage | Low | Pending |

---

### P0 — Rate limit bypass (FIXED)

**Date fixed:** 2026-05-16
**Commit:** `837bea4` → `web-quota.ts`

#### What was found

The anonymous rate limiter keyed requests by IP address extracted from `X-Forwarded-For`.
Because this header is fully client-controlled when no trusted upstream proxy is present,
rotating it trivially bypassed all per-IP quotas.

**PoC — 20 requests, all passed (before fix):**

```bash
for i in $(seq 1 20); do
  curl -X POST http://localhost:3001/api/papers/upload \
    -H "X-Forwarded-For: 203.0.113.$i" \
    -d '{"arxivId":"2301.00001"}'
done
# Result: 20/20 HTTP 201 — rate limit completely bypassed
```

#### Root cause

`web-quota.ts` trusted `X-Forwarded-For` as a fallback when neither `cf-connecting-ip`
nor `x-real-ip` was present. On a bare Node / Vercel deployment without Cloudflare,
every request could supply any IP it liked.

#### Fix

Removed `X-Forwarded-For` from the IP resolution chain entirely.
The function now only trusts headers that the deployment platform sets authoritatively
(`cf-connecting-ip` for Cloudflare, `x-real-ip` for Railway/Render).
On bare Node (local dev) the IP falls back to `"unknown"`, and all anonymous requests
share a single rate-limit bucket — preventing rotation attacks.

Also strengthened the anonymous fingerprint to include a stable `council_anon` session
cookie as a secondary signal, raising the bar for simultaneous IP + cookie rotation.

```
Before: fingerprint = ip (client-injectable) | user-agent
After:  fingerprint = platform-ip-only | anon-cookie | user-agent
```

**Verification:**

```bash
for i in $(seq 1 20); do
  curl -X POST http://localhost:3001/api/sessions \
    -H "X-Forwarded-For: 203.0.113.$i" \
    -d '{"topic":"test","rounds":1}'
done
# Result: 3/20 HTTP 201, 17/20 HTTP 429 — rate limit now enforced correctly
```

---

### P1-a — PDF parsing bomb (FIXED)

**Date fixed:** 2026-05-16
**Commits:** `837bea4`, `f6e74b0` → `paper-ingest.ts`, `pdf-limits.ts`, all 4 upload routes

#### What was found

Three distinct attack surfaces in the PDF upload pipeline:

**Attack 1 — Malformed xref table (CPU DoS):**
A PDF that passes the `%PDF` magic-bytes check but has a corrupt cross-reference table
causes `pdf-parse`'s internal recovery scanner to iterate the entire file byte-by-byte.
A 6 MB crafted file blocked the Node.js worker for **26 seconds** before returning 502.

```bash
# Before fix — 26 second server block:
curl -X POST http://localhost:3001/api/papers/upload \
  -F "file=@bomb.pdf"
# → HTTP 502 after 26,282 ms
```

**Attack 2 — Oversized output expansion:**
A valid 20 MB PDF with 100 pages of repetitive content could produce hundreds of MB
of extracted text, causing unbounded downstream LLM API costs.

**Attack 3 — No per-tier differentiation:**
All users (anonymous free / paid pro) faced identical 20 MB limits, making it cheap
for anonymous users to burn server resources and LLM budget.

#### Root cause

`extractTextFromPdfBuffer` called `pdfParse(buffer)` with no timeout, no output cap,
and no page limit. All routes used a single hardcoded `MAX_PDF_BYTES = 20 * 1024 * 1024`
regardless of authentication tier.

#### Fix

Three complementary layers added:

**Layer 1 — Hard parse timeout (`paper-ingest.ts`):**

```typescript
const PDF_PARSE_TIMEOUT_MS = 10_000;
const PDF_MAX_TEXT_BYTES   = 300_000;

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<PdfParseResult> {
  const data = await Promise.race([
    pdfParse(buffer),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("PDF parsing timed out")), PDF_PARSE_TIMEOUT_MS)
    ),
  ]);
  const raw = data.text ?? "";
  return {
    text:      raw.length > PDF_MAX_TEXT_BYTES ? raw.slice(0, PDF_MAX_TEXT_BYTES) : raw,
    pageCount: data.numpages ?? 0,
  };
}
```

**Layer 2 — Tier-based file size + page limits (`pdf-limits.ts`):**

```typescript
export const PDF_TIER_LIMITS = {
  free: { maxBytes: 5  * 1024 * 1024, maxPages: 30  },
  pro:  { maxBytes: 20 * 1024 * 1024, maxPages: 150 },
};
```

**Layer 3 — Enforcement order in all 4 upload routes:**

```
1. File size check (before reading buffer — cheapest gate)
2. Magic bytes check (%PDF)
3. pdf-parse with 10s timeout
4. Page count check (immediately after parse)
5. 300 KB text output cap (before LLM handoff)
```

Error messages include tier-aware upgrade hints:
```json
{ "error": "PDF has 50 pages, exceeding the 30-page limit for your plan. Upgrade to Pro for up to 150 pages." }
```

**Verification:**

```bash
# Malformed xref bomb (was 26s): now caught at file size gate
curl -F "file=@bomb_6mb.pdf" http://localhost:3001/api/papers/upload
# → HTTP 413 in 275 ms

# 50-page PDF against free-tier account
curl -F "file=@pages50.pdf" http://localhost:3001/api/papers/upload
# → HTTP 413 in 664 ms — "exceeds 30-page limit"

# Normal valid PDF under limits
curl -F "file=@normal_paper.pdf" http://localhost:3001/api/papers/upload
# → HTTP 201 in ~1s
```

---

### P1-b — Prompt injection (PENDING)

**Target endpoints:** `POST /api/sessions`, `POST /api/papers/upload`

The `systemPrompt` (capped at 1000 chars) and `bias` (200 chars) fields on each seat
are passed directly into LLM context. A crafted payload can attempt to override agent
behavior, exfiltrate session data from RAG context, or produce policy-violating output.
Also at risk: uploaded PDFs that embed injection instructions in their text content,
which are then retrieved via RAG and injected into agent prompts.

**Planned fix:** Output-side moderation + stricter system prompt sandboxing.

---

### P2-a — SSRF via DNS rebinding (PENDING)

**Target:** Any endpoint that fetches a user-supplied URL (web tool handler, `pdfUrl` in ingest)

`url-safety.ts` validates the hostname at parse time using a blocklist of private IP ranges.
DNS rebinding can defeat this: the attacker controls a domain whose DNS record passes
validation on first lookup, then flips to an internal IP before the actual HTTP fetch.
IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`) are also not covered by the current blocklist.

**Planned fix:** Re-validate the resolved IP after DNS lookup; block IPv4-mapped IPv6.

---

### P2-b — Anonymous session cookie hygiene (PENDING)

**Target:** Anonymous session tokens set via `attachCouncilSessionCookie`

Need to verify `HttpOnly`, `Secure`, and `SameSite=Strict` are set on the anonymous
access cookie. Missing `Secure` allows cookie theft over HTTP; missing `SameSite` opens
CSRF vectors. Also need to confirm anonymous tokens have a TTL and are invalidated on expiry.

---

### P3 — Error message leakage (PENDING)

**Target:** All API routes that return `error instanceof Error ? error.message : ...`

Database constraint violations and internal library errors can surface table names,
column names, or file paths in JSON error responses. Audit needed to ensure all
catch-blocks return generic messages to clients while logging details server-side only.

---

### What was NOT found

| Attack | Result | Reason |
|---|---|---|
| SQL injection (`' OR '1'='1`, `; DROP TABLE`, `pg_sleep(3)`) | No vulnerability | All DB queries use parameterized `$1/$2` placeholders — zero string concatenation |
| UNION SELECT / stacked queries | No vulnerability | Same — parameterized throughout |
| Path traversal in session/paper IDs | No vulnerability | IDs are UUID/nanoid, never used in filesystem paths |
| Model substitution (cost abuse) | No vulnerability | `model` field stripped server-side; forced to `DEFAULT_GEMMA_MODEL` |

---

### Defensive architecture summary

```
Client request
    │
    ▼
[Rate limiter]  ← platform IP only (no X-Forwarded-For trust)
    │             free: 3/10min, 10/week
    │             pro:  10/10min, 50/day
    ▼
[Auth check]    ← NextAuth session or anonymous cookie
    │
    ▼
[PDF gate]      ← size check → magic bytes → parse(10s timeout) → page count → text cap
    │             free: 5MB / 30 pages
    │             pro:  20MB / 150 pages
    ▼
[Input sanitize] ← whitelist fields, strip model override, cap string lengths
    │
    ▼
[LLM / RAG]     ← 300KB text cap before handoff
```
