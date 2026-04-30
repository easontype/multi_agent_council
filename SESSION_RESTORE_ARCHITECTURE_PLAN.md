# Council Session Restore Architecture Plan

## Goal

Make saved review sessions durable, reloadable, and easier to extend without pushing more state-mapping logic into React pages and hooks.

The immediate product goal is simple:

1. A review session saved in PostgreSQL must remain the source of truth.
2. Leaving `/analyze` must not make a completed or in-progress review feel lost.
3. Frontend restore must flow through explicit service and hydrator layers instead of ad hoc page logic.

## Target Architecture

### Presentation

- `src/app/analyze/page.tsx`
- `src/app/home/page.tsx`
- `src/app/home/reviews/page.tsx`
- `src/hooks/use-council-review.ts`

Responsibilities:

- Read route/query state
- Trigger application actions such as `start`, `loadSession`, `resumeSession`
- Render either setup or restored discussion results

Presentation must not map raw SQL/API bundle data into `DiscussionSession` inline.

### Application

- `src/lib/services/council-session-service.ts`

Responsibilities:

- Fetch a persisted council session bundle from `/api/sessions/[id]`
- Derive restore metadata such as frontend phase and resumability
- Become the single client-side entry point for restore/resume flows

### Domain / View-Model Mapping

- `src/lib/services/council-session-hydrator.ts`

Responsibilities:

- Convert `{ session, turns, conclusion, evidence }` into `DiscussionSession`
- Convert persisted council seats into UI agents
- Rebuild tool cards and source references deterministically

This isolates restore behavior from page and hook churn.

### Infrastructure

- PostgreSQL remains the primary store
- Existing routes remain the canonical transport:
  - `GET /api/sessions`
  - `GET /api/sessions/[id]`
  - `POST /api/sessions/[id]/run`

No new persistence layer is introduced in this refactor.

## Data Ownership Rules

### Source Of Truth

- PostgreSQL is the only canonical storage for review sessions.
- Client storage is optional and only for convenience metadata like `lastOpenedSessionId`.

### Access Control

- Ownership remains server-side via existing `owner_user_email`, anonymous access token cookie, and `is_public`.
- Client restore must never bypass `GET /api/sessions/[id]`.

## Implementation Order

### Phase 1: Restore Boundary

1. Add a hydrator that maps persisted bundle data into `DiscussionSession`
2. Add a client-side session service that loads a session bundle and returns hydrated data plus restore metadata

Acceptance:

- Restore logic no longer lives inside `analyze/page.tsx`
- `use-council-review` can load saved sessions without knowing raw API shape

### Phase 2: Hook Refactor

1. Extend `useCouncilReview` with `loadSession(sessionId)`
2. Keep `start()` as the new-session path
3. Add `resumeSession(sessionId)` as the future live-reconnect path

Acceptance:

- Hook supports both "new review" and "restore saved review"
- Restore does not require manually rebuilding session state in the page

### Phase 3: Routing

1. Support `/analyze?session=<id>`
2. Change reviews lists to open `/analyze?session=<id>` instead of bare `/analyze`

Acceptance:

- Opening a saved review from dashboard or reviews page restores the same session

### Phase 4: Client Convenience State

1. Cache only the last opened session id locally
2. Keep the server bundle as the only durable review payload

Acceptance:

- Refresh and return flows feel continuous
- No transcript duplication between SQL and browser storage

### Phase 5: Running Session Resume

1. Use `POST /api/sessions/[id]/run` with `{ resume: true }` for in-progress sessions
2. Reuse the same hydrator before reconnecting SSE

Acceptance:

- Running sessions can reconnect without starting from scratch

## Non-Goals In This Pass

- No schema migration
- No cache invalidation layer
- No multi-device sync beyond current server-backed behavior
- No redesign of SSE contracts

## Risks

### Hydration Fidelity

Persisted evidence is stored separately from turns, so restored tool cards will be reconstructed rather than byte-for-byte replayed from the live stream.

### Session Status Mapping

Frontend phase is narrower than backend session status, so restore must intentionally map:

- `pending` -> `idle` or `running`, depending on whether work has started
- `running` -> `running`
- `concluded` -> `concluded`
- `failed` -> `error`

## Current Progress

- Phase 1: completed
- Phase 2: completed
- Phase 3: completed
- Phase 4: completed
- Phase 5: completed (initial pass)

## Immediate Next Step

Deepen the restore UX with clearer state messaging, and add integration coverage for saved-session load plus resumable running-session behavior.
