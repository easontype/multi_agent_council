# Council Missing Pieces

Updated: 2026-04-15

This document summarizes the main product and engineering gaps in `council`, grouped by priority.

Rule for this plan:

- `P0` = required before wider real usage
- `P1` = materially improves product quality and reliability
- `P2` = important polish and workflow improvements, including UI

## P0

### 1. Session ownership and access control

Current risk:

- session creation is publicly callable through `POST /api/council`
- session bundle reads are publicly callable through `GET /api/council/:id`
- session run is publicly callable through `POST /api/council/:id/run`

Why this is P0:

- a leaked session ID exposes paper content, debate output, and evidence
- there is no clear distinction between public demo sessions and private user sessions

What is needed:

- attach sessions to user or API key identity
- add read/write authorization checks
- define whether anonymous sessions are allowed, and for how long

Relevant files:

- `src/app/api/council/route.ts`
- `src/app/api/council/[id]/route.ts`
- `src/app/api/council/[id]/run/route.ts`
- `src/lib/council.ts`

### 2. Real quota and abuse protection for the web app

Current risk:

- homepage promises `10 reviews/day, no account required`
- actual daily usage enforcement exists only on API key flow
- public web endpoints do not have matching quota protection

Why this is P0:

- public users can create ingest + council jobs without the same usage controls as API clients
- compute, provider quotas, and DB load can be abused

What is needed:

- anonymous session rate limiting by IP/session/cookie
- consistent quota rules for web and API paths
- upload size and ingest safeguards

Relevant files:

- `src/app/page.tsx`
- `src/app/api/papers/ingest/route.ts`
- `src/app/api/council/route.ts`
- `src/lib/api-keys.ts`

### 3. Background execution model

Current risk:

- debate execution is driven by the frontend opening an SSE stream
- long-running work is tied too closely to request lifecycle and provider stability

Why this is P0:

- fragile under disconnects, deploy restarts, timeouts, and retries
- hard to guarantee job completion semantics

What is needed:

- queue-backed worker execution
- retry policy and dead-session recovery
- separate job state from UI streaming

Relevant files:

- `src/app/api/council/[id]/run/route.ts`
- `src/app/results/[id]/page.tsx`
- `src/lib/council.ts`

## P1

### 1. Scholarly retrieval stack completion

Current state:

- product direction clearly depends on literature discovery and OA fetching
- provider abstractions already exist, but are not yet the full operating path

Why this is P1:

- without stronger retrieval, Council remains a single-paper critique tool
- related work, novelty checks, and gap analysis stay shallow

What is needed:

- finish integrating `OpenAlex`
- use `Crossref` for DOI normalization and metadata
- keep `Unpaywall` for OA resolution
- later add `Europe PMC` and `CORE` where appropriate

Relevant files:

- `src/lib/scholarly-providers.ts`
- `src/lib/tools/handlers/web.ts`
- `src/lib/paper-ingest.ts`

### 2. User asset model

Current gap:

- papers, sessions, and keys exist
- there is no full notion of library ownership, history, saved reviews, or organization scope

Why this is P1:

- repeat users will need continuity
- product gets messy once users have more than a few runs

What is needed:

- per-user paper library
- review history
- re-run and duplicate handling
- optional share/export permissions

Relevant files:

- `src/lib/council-db.ts`
- `src/app/home/page.tsx`
- `src/app/results/[id]/page.tsx`

### 3. Billing and entitlement closure

Current state:

- Stripe checkout and webhook exist
- key issuance works
- entitlement model is still narrow

Why this is P1:

- monetization exists in UI copy, but product gating is not yet fully systematic

What is needed:

- feature gating by tier
- usage dashboard
- billing state reconciliation
- refund/revocation handling

Relevant files:

- `src/app/keys/page.tsx`
- `src/app/api/stripe/checkout/route.ts`
- `src/app/api/stripe/session/route.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/lib/api-keys.ts`

### 4. Evaluation and regression coverage

Current gap:

- testing appears to focus mainly on UI and visual flows
- little evidence yet of retrieval-quality or debate-quality regression tests

Why this is P1:

- provider changes and prompt changes will be hard to validate safely
- product quality will drift silently

What is needed:

- fixtures for paper search quality
- evidence attribution checks
- session recovery tests
- structured output regression tests

Relevant files:

- `package.json`
- `tests/`

## P2

This section intentionally groups UI and workflow polish work. These items matter, but they should not outrank security, quota control, execution reliability, or retrieval quality.

### 1. UI system cleanup

Current gap:

- major pages rely heavily on inline styles
- visual language is serviceable, but not yet a durable design system
- several pages still feel demo-like rather than product-grade

What is needed:

- extract shared layout and component primitives
- normalize spacing, typography, badges, pills, alerts, and form controls
- reduce page-by-page custom styling drift

Relevant files:

- `src/app/page.tsx`
- `src/app/analyze/page.tsx`
- `src/app/results/[id]/page.tsx`
- `src/app/keys/page.tsx`

### 2. Workflow UX refinement

Current gap:

- core flows work, but user feedback is still thin around progress, retries, and failure states
- review creation and result consumption can be made more legible

What is needed:

- clearer step progress during ingest -> session create -> debate run
- better empty states and recovery states
- restart / rerun / duplicate review controls
- clearer evidence and source navigation in results

Examples:

- explicit ingest success/failure stage
- better loading language for long-running reviews
- clearer separation between live debate and completed results

### 3. Output usability and export UX

Current gap:

- results are readable in-app, but secondary use is limited

What is needed:

- export as Markdown
- export as JSON
- printable review layout / PDF-friendly page
- copyable reviewer blocks and moderator summary
- evidence table and citation-style output

### 4. Dashboard and navigation polish

Current gap:

- there are pieces of admin/home/login flow, but the information architecture is still thin

What is needed:

- cleaner home/dashboard split
- session list filtering and sorting
- obvious entry points for recent papers, saved sessions, and API usage
- better navigation between analyze, results, keys, and account pages

### 5. Mobile and responsive finishing

Current gap:

- pages are broadly responsive, but the results interface in particular needs stronger mobile behavior

What is needed:

- mobile-first pass on results page
- sidebar collapse behavior
- touch-friendly evidence panels
- long-text readability and overflow handling

## Practical Priority Order

Recommended actual build order:

1. `P0.1` session ownership and access control
2. `P0.2` real quota and abuse protection
3. `P0.3` background execution model
4. `P1.1` scholarly retrieval stack completion
5. `P1.2` user asset model
6. `P1.3` billing and entitlement closure
7. `P1.4` evaluation and regression coverage
8. `P2` UI and workflow polish

## Decision Note

UI is intentionally placed in `P2`.

Reason:

- current UI is already good enough to support iteration
- the bigger risks are unauthorized access, uncontrolled compute usage, fragile execution, and shallow retrieval
- once those foundations are stable, UI polish will create more durable value

