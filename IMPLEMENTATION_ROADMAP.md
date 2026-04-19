# Council Implementation Roadmap

Updated: 2026-04-19

## Purpose

This document consolidates:

- `GEMINI_CONTEXT_CACHING_PLAN.md`
- `USER_DATA_MODEL_PLAN.md`

into one execution-order roadmap.

The goal is not just to list features.
It is to define the safest implementation sequence so the system becomes:

- cheaper to run
- easier to secure
- easier to maintain
- easier to extend

## Core Principle

Council should be built in this order:

1. stabilize identity and ownership
2. stabilize asset boundaries
3. stabilize execution lifecycle
4. add provider-side cost optimization
5. add billing-aware policy and operations

This order matters.

If context caching is added before ownership and lifecycle are clean, the system will gain a new billable asset class without a reliable way to:

- attribute ownership
- enforce cleanup
- enforce plan rules
- debug cost leaks

## What Exists Today

Today the system already has:

- persisted sessions, turns, conclusions, evidence
- API key tables
- JWT-based login
- database-backed paper storage via `documents/document_chunks`
- session sharing
- RAG retrieval

But it still lacks:

- first-class users
- first-class workspaces
- server-side ownership for all assets
- job/lifecycle infrastructure
- provider cache lifecycle
- billing entitlement layer
- audit and deletion primitives

## Progress Update

Current implementation status as of 2026-04-19:

- Completed: Phase 1 core foundation
- Completed: Phase 2 initial ownership slice
- In progress: deeper Phase 2 normalization and migration follow-through
- Not started: Phase 3 and beyond

Specifically completed in code:

- `users`
- `workspaces`
- `workspace_memberships`
- auth-to-account resolution layer
- `council_sessions.workspace_id`
- `council_sessions.created_by_user_id`
- workspace-aware session listing and creation
- workspace-owned API key creation and revoke path
- server-side `team_templates`
- `uploaded_files` metadata for PDF upload flows

Still pending before Phase 2 can be considered complete:

- formal `paper_assets`
- `libraries`
- `library_documents`
- broader backfill from legacy email ownership
- route-by-route ownership migration for the remaining asset surfaces

## Full Delivery Sequence

## Phase 0: Freeze the foundation

### Goal

Stop adding new product behavior on top of weak ownership assumptions.

### Work

1. Define canonical ownership model.
2. Define internal ids for user, workspace, asset, and job records.
3. Decide which tables become product assets versus implementation tables.
4. Define migration rules from current email-based ownership.

### Why first

Without this, later work will keep adding more `owner_*` fields in inconsistent ways.

### Deliverables

- ownership ADR or equivalent design note
- migration map from existing tables
- list of canonical asset types

## Phase 1: Identity and workspace base

### Goal

Replace email-centric ownership with stable internal identity.

### Work

1. Add `users`.
2. Add `workspaces`.
3. Add `workspace_memberships`.
4. Resolve auth session to internal `user_id`.
5. Create one default personal workspace for each user.

### Why now

Everything else depends on knowing who owns what.

### Must change

- `src/auth.ts`
- auth/session resolution path
- new DB schema module(s)

### Success condition

A logged-in request resolves to:

- `user_id`
- `workspace_id`
- role/membership context

instead of just email.

### Status

Completed.

Implemented via:

- `src/lib/db/account-db.ts`
- `src/lib/auth-account.ts`
- session route integration and schema wiring

## Phase 2: Re-root current assets under workspace ownership

### Goal

Make existing product data belong to a real account boundary.

### Work

1. Add `workspace_id` and `created_by_user_id` to `council_sessions`.
2. Keep legacy ownership fields temporarily for migration compatibility.
3. Attach `council_api_keys` to `workspace_id` and `created_by_user_id`.
4. Add server-side `team_templates`.
5. Add `uploaded_files` ownership metadata for PDF uploads.

### Why now

This converts the current product from prototype persistence to real account persistence.

### Must change

- `src/lib/db/council-db.ts`
- `src/lib/core/council.ts`
- `src/lib/api-keys.ts`
- `src/lib/team-template-store.ts`
- upload routes

### Success condition

Sessions, keys, templates, and uploads are queryable by workspace and actor.

### Status

In progress.

Completed so far:

- session ownership fields added and wired into create/list paths
- API key ownership fields added and wired into create/revoke/list paths
- server-side `team_templates` storage and routes added
- `uploaded_files` metadata table added and written from upload flows

Still required:

- paper/library asset normalization
- wider route migration
- legacy/backfill migration plan

## Phase 3: Formal paper asset model

### Goal

Separate user-facing paper ownership from low-level retrieval storage.

### Work

1. Add `paper_assets`.
2. Add `paper_asset_sources`.
3. Add `libraries`.
4. Add `library_documents`.
5. Map session/paper relationships through owned asset records.
6. Keep `documents/document_chunks` as the retrieval layer.

### Why now

This is the point where the current "knowledge base" becomes a proper product library.

### Must change

- `src/lib/paper-ingest.ts`
- RAG lookup path
- paper/chat/session binding logic

### Success condition

The app can answer:

- which workspace owns a paper
- which sessions use it
- whether it came from upload, arXiv, or another source
- what should be deleted when the paper is deleted

### Status

Not started.

Current prerequisite work already in place:

- workspace ownership foundation
- upload metadata foundation
- session ownership foundation

## Phase 4: Job and lifecycle infrastructure

### Goal

Move long-running work out of request-bound execution.

### Work

1. Add `jobs` or equivalent background task table.
2. Track ingest jobs.
3. Track session run jobs.
4. Track export jobs.
5. Track cleanup jobs.
6. Add job status, heartbeat, retry, and failure reason fields.

### Why now

The system already has long-running behaviors.
They should not remain tied to SSE/request lifecycle if the product is going to scale.

### Success condition

Long-running work is resumable, inspectable, and recoverable.

## Phase 5: Audit, deletion, export, and retention primitives

### Goal

Make owned data operable and governable.

### Work

1. Add `audit_events`.
2. Add `deletion_requests`.
3. Add `export_jobs`.
4. Add soft-delete and hard-delete policy boundaries.
5. Define derived-data cleanup rules.

### Why before caching

Provider cache will introduce another billable, deletable derived asset.
Deletion and audit should exist before that layer lands.

### Success condition

The app can safely handle:

- account deletion
- paper deletion
- export requests
- support/debug needs

## Phase 6: Cost instrumentation baseline

### Goal

Measure economics before optimizing them.

### Work

1. Record per-run token usage at session/run level.
2. Record model/provider usage by seat and moderator.
3. Record estimated cost for ingest, debate, and follow-up chat.
4. Establish event or reporting hooks for usage accounting.

### Why now

If caching is added before measurement, there will be no clean baseline to compare against.

### Success condition

The team can answer:

- which flows are expensive
- which models drive cost
- whether a later cache hit actually improved margin

## Phase 7: Gemini context cache groundwork

### Goal

Prepare provider-side caching without yet coupling it into debate execution.

### Work

1. Add provider-neutral cache interface.
2. Add Gemini cache adapter.
3. Add local cache metadata table.
4. Add paper fingerprinting.
5. Add cache-ready paper payload builder.

### Why here

At this point the system already has:

- owned papers
- owned sessions
- jobs
- cleanup primitives
- usage accounting baseline

That makes cache implementation much safer.

### Success condition

The app can map one paper asset to one reusable provider cache record.

## Phase 8: Basic cache acquisition and reuse

### Goal

Get real cost reduction on repeated paper reads.

### Work

1. Create or reuse cache during analyze/ingest flow.
2. Save cache reference on session or job context.
3. Route eligible Gemini model runs through cached context.
4. Keep fallback to existing prompt path for unsupported models or failures.

### Must change

- `src/lib/llm/gemini.ts`
- new cache modules
- analyze routes
- session runtime integration

### Success condition

Multiple seats reading the same paper reuse one provider-side context cache instead of paying full repeated input cost.

## Phase 9: TTL, cleanup, and cache lifecycle enforcement

### Goal

Prevent cache-related billing leaks.

### Work

1. Add short default TTL.
2. Extend TTL only when needed.
3. Delete cache on safe completion.
4. Add garbage collector job.
5. Record cache status transitions and cleanup outcomes.

### Why after basic reuse

First prove cache reuse works, then harden lifecycle.

### Success condition

There are no long-lived orphaned provider caches silently accumulating cost.

## Phase 10: Prompt and round compression

### Goal

Reduce token waste beyond provider cache reuse.

### Work

1. Add moderator conflict digest.
2. Keep round 2 input bounded.
3. Avoid replaying entire round-1 transcript.
4. Split paper context from debate context intentionally.

### Why here

Provider cache reduces repeated paper cost.
This phase reduces transcript bloat and second-order waste.

### Success condition

Round-2 and synthesis costs drop materially without reducing answer quality.

## Phase 11: Billing and entitlement layer

### Goal

Make cost-sensitive features plan-aware.

### Work

1. Add `billing_accounts`.
2. Add `billing_subscriptions`.
3. Add `billing_entitlements`.
4. Route quota and premium features through entitlements.
5. Bind future cache policy to plan.

Examples:

- longer cache TTL for paid tiers
- Pro moderator only on premium plans
- batch mode for lower-cost async plans

### Why now

This phase turns infrastructure capability into controlled product policy.

### Success condition

Feature and quota decisions come from one entitlement layer, not ad hoc route logic.

## Phase 12: Support, admin, and recovery tooling

### Goal

Make the system operable by humans.

### Work

1. Add safe admin queries and support views.
2. Add asset reassignment / recovery flows.
3. Add guest-to-account claim flow if anonymous mode remains.
4. Add account merge and provider relink strategy.

### Why last

This depends on all prior ownership and audit layers being real.

### Success condition

Ops/support can investigate and fix real customer issues without direct manual SQL as the default.

## Cross-Cutting Rules

These rules should apply throughout all phases.

### Rule 1: Asset ownership must be explicit

Every durable asset should have an owner root:

- `workspace_id`
- `created_by_user_id`

### Rule 2: Product tables and implementation tables should stay separate

Examples:

- `paper_assets` is a product table
- `documents/document_chunks` is a retrieval implementation layer
- provider cache metadata is a product/ops table
- raw provider cache itself is external infrastructure

### Rule 3: Route handlers should not own lifecycle logic

Routes should trigger workflows, not contain all business state transitions themselves.

### Rule 4: New billable infrastructure needs cleanup from day one

This applies to:

- provider caches
- uploads
- exports
- jobs

### Rule 5: Billing policy should come after observability

Do not add plan-specific execution branches until usage and cost are measurable.

## P0 Build Order

If the team wants the narrowest practical starting slice, do this first:

1. `users`
2. `workspaces`
3. `workspace_memberships`
4. session ownership migration to `workspace_id` and `created_by_user_id`
5. API key ownership migration
6. server-side `team_templates`
7. `uploaded_files`
8. `paper_assets`
9. `libraries` + `library_documents`
10. `jobs`
11. `audit_events`
12. usage/cost instrumentation baseline

Only after that:

13. Gemini cache interface + metadata table
14. paper fingerprinting
15. cache-ready payload builder
16. analyze-time cache acquisition
17. runtime cache reuse
18. TTL and GC

Current checkpoint:

- Done: 1 through 7
- Next recommended item: 8 (`paper_assets`)

## What Not To Do Yet

Do not front-load these:

- full enterprise RBAC
- multi-org collaboration complexity
- batch execution system before job foundation exists
- cross-provider generic caching
- long-lived premium cache policy before entitlement layer exists

## Summary

The correct implementation order is:

1. identity
2. workspace ownership
3. asset normalization
4. job/lifecycle infrastructure
5. audit/deletion/export
6. cost observability
7. Gemini cache groundwork
8. Gemini cache reuse
9. cache lifecycle enforcement
10. prompt compression
11. billing entitlements
12. support/admin tooling

This sequence keeps the architecture coherent.
It avoids adding cost-optimization features onto a weak ownership base.
And it gives Council the best path toward being secure, maintainable, and commercially viable.
