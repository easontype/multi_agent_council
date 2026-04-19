# User Data Model Plan

Updated: 2026-04-19

## Purpose

This document defines how Council should evolve from a session-centric prototype into a proper account-centric product.

The goal is to make user data:

- durable
- clearly owned
- easy to query
- easy to secure
- easy to delete or export
- extensible to teams, billing, shared assets, and future cache infrastructure

This is an architecture plan, not just a schema note.

## Current State

Council already persists several useful things, but the data model is still uneven.

## Progress Update

Current implementation status as of 2026-04-19:

- completed: internal `users / workspaces / workspace_memberships`
- completed: auth-to-account resolution layer
- completed: session ownership fields moved toward `workspace_id / created_by_user_id`
- completed: API key ownership fields added
- completed: server-side `team_templates`
- completed: `uploaded_files` metadata for PDF upload paths
- in progress: migration away from legacy email-centric ownership
- not started: formal paper asset layer, audit/deletion/export primitives, billing entitlement layer

### 1. Authentication exists, but user identity is thin

Current auth:

- `next-auth`
- JWT session strategy
- provider login via GitHub / Google
- optional credentials login for admin/dev

Relevant code:

- `src/auth.ts`

What this means:

- the app can identify a logged-in person
- but it does not maintain a proper internal user record
- ownership is still often keyed by raw email string

Update:

This statement is now partially outdated.

The codebase now has:

- `users`
- `workspaces`
- `workspace_memberships`
- an auth-to-account resolver that maps a logged-in session to internal ids

What is still thin is the provider/account-linking model, not the existence of internal user records.

### 2. Review sessions are persisted

Current stored session assets:

- `council_sessions`
- `council_turns`
- `council_conclusions`
- `council_evidence`

Relevant code:

- `src/lib/db/council-db.ts`
- `src/lib/core/council.ts`

Current ownership fields already present on sessions:

- `workspace_id`
- `created_by_user_id`
- `owner_user_email`
- `owner_api_key_id`
- `owner_agent_id`
- `access_token_hash`
- `is_public`

This is a meaningful improvement, but it is still not a full account asset model because other asset families have not all been normalized yet.

### 3. API keys are persisted

Current stored key assets:

- `council_api_keys`
- `council_pending_keys`

Relevant code:

- `src/lib/api-keys.ts`

This already covers:

- hashed key storage
- Stripe linkage
- revocation
- tier and daily limit

But the ownership model is still weak because keys are not attached to a first-class user or workspace entity.

Update:

This is also now partially outdated.

`council_api_keys` now includes:

- `workspace_id`
- `created_by_user_id`

The remaining weakness is not the absence of ownership fields, but the lack of a complete entitlement/audit/billing control layer around them.

### 4. Paper content is persisted, but not as a user library

The app already stores paper content in platform tables:

- `documents`
- `document_chunks`

Relevant code:

- `src/lib/paper-ingest.ts`
- `src/lib/tools/handlers/rag.ts`
- `src/lib/core/council-paper-chat.ts`
- `src/lib/agents/agentic-runtime.ts`

This is the current RAG knowledge layer.

But today it is not modeled as:

- "this paper belongs to user X"
- "this paper belongs to workspace Y"
- "this paper is shared with team Z"

So the app has persistence, but not clean asset ownership.

### 5. Some user-facing assets are not server-persisted

Most obvious example:

- saved team templates were originally in browser `localStorage`

Relevant code:

- `src/lib/team-template-store.ts`

Update:

This is now partially addressed.

The codebase now has:

- server-side `team_templates`
- API routes for template list/save/delete
- a client adapter that is server-first with local fallback

What is still missing:

- workspace sharing semantics
- versioning/history
- stronger conflict handling

### 6. Anonymous ownership is fragile

Anonymous session access relies on a cookie-backed access token.

This is useful for lightweight hosted entry, but weak as a long-term asset model.

If the cookie disappears:

- the user can lose effective control of the session
- support and recovery become difficult

This statement still stands.

## Problem

Council currently stores data, but not under a coherent account model.

The main weaknesses are:

- no `users` table
- no internal immutable user id
- ownership is often email-based
- no first-class workspace or membership model
- no per-user or per-workspace paper library
- no durable server-side template storage
- no formal retention, export, or deletion policy
- no clear model for future shared assets such as Gemini context caches

That creates long-term problems in:

- authorization
- billing
- support
- auditability
- data migration
- privacy compliance
- enterprise expansion

## Architectural Principle

Council should stop treating the session as the primary data root.

Instead, Council should adopt this ownership hierarchy:

1. `users`
2. `workspaces`
3. `workspace_memberships`
4. owned assets

Owned assets include:

- sessions
- papers
- libraries
- templates
- API keys
- provider caches
- exports
- uploads
- billing records

The session then becomes one asset inside an account/workspace graph, not the root of the whole product.

## What Must Change

## A. Add a first-class users table

### What to add

A persistent `users` table.

Suggested fields:

- `id`
- `primary_email`
- `display_name`
- `avatar_url`
- `auth_provider`
- `auth_provider_user_id`
- `status`
- `created_at`
- `updated_at`
- `last_seen_at`

### Why

Email is not a safe long-term ownership key.

Problems with email-as-owner:

- users can change email
- OAuth providers can return different shapes
- one person can sign in with more than one provider
- future account merge flows become painful

### Maintainability goal

All product ownership should point to stable internal ids, not user-supplied strings.

## B. Add workspaces even if there is only one personal workspace at first

### What to add

Tables:

- `workspaces`
- `workspace_memberships`

Suggested direction:

- every new user gets one default personal workspace
- assets belong to a workspace by default
- direct user ownership is minimized

### Why

If the app later adds:

- teams
- org billing
- shared libraries
- review collaboration

then workspace ownership becomes necessary.

Adding it early avoids rewriting ownership later.

### Maintainability goal

Use one ownership pattern for both solo and team accounts.

## C. Move sessions from email ownership to workspace ownership

### What to change

`council_sessions` should eventually reference:

- `workspace_id`
- `created_by_user_id`

Optional compatibility fields can remain during migration:

- `owner_user_email`
- `owner_api_key_id`

### Why

The session is a product asset.
It should be queryable by workspace and actor, not only by email or access token.

### Maintainability goal

Keep ownership explicit and normalized.

## D. Add a formal paper/library asset model

### What to add

New tables or equivalent structure:

- `paper_assets`
- `paper_asset_sources`
- `libraries`
- `library_documents`

Suggested ownership:

- `workspace_id`
- `created_by_user_id`

Possible metadata:

- normalized title
- source type
- arXiv id / DOI
- upload filename
- source URL
- checksum / fingerprint
- ingest status

### Why

Right now, `documents` and `document_chunks` act as the technical store, but not as a product asset layer.

Council needs both:

- product asset layer
- retrieval/storage implementation layer

### Maintainability goal

Keep user-facing ownership and lifecycle in asset tables, while `documents/document_chunks` remain implementation detail for retrieval.

## E. Add server-side saved templates

### What to add

A `team_templates` table or equivalent.

Suggested fields:

- `id`
- `workspace_id`
- `created_by_user_id`
- `name`
- `mode`
- `rounds`
- `agents_json`
- `visibility`
- `created_at`
- `updated_at`
- `archived_at`

### Why

Templates are product assets.
They should not live only in one browser.

### Maintainability goal

Template persistence should use the same ownership model as sessions and papers.

## F. Attach API keys to a real owner

### What to change

`council_api_keys` should eventually include:

- `workspace_id`
- `created_by_user_id`

Optional:

- `last_rotated_by_user_id`
- `revoked_by_user_id`

### Why

An API key is an account asset and a security object.
It needs a clear owner, lifecycle, and audit trail.

### Maintainability goal

Keys should belong to workspaces, not float as semi-independent billing artifacts.

## G. Add upload/blob ownership and lifecycle

### What to add

A model for uploaded files, even if storage stays on disk or object storage.

Suggested table:

- `uploaded_files`

Suggested fields:

- `id`
- `workspace_id`
- `created_by_user_id`
- `storage_provider`
- `storage_key`
- `filename`
- `mime_type`
- `size_bytes`
- `checksum`
- `status`
- `created_at`
- `deleted_at`

### Why

If users upload PDFs, the system must be able to answer:

- who owns this file
- where is it stored
- when can it be deleted
- which sessions depend on it

### Maintainability goal

Do not let file ownership live only in temporary route logic.

## H. Add retention, export, and deletion model

### What to add

Lifecycle support for:

- soft delete
- hard delete jobs
- export jobs
- retention policies

Suggested supporting tables:

- `deletion_requests`
- `export_jobs`

### Why

A real product needs to support:

- user-requested deletion
- account closure
- privacy compliance
- support tooling

### Maintainability goal

Deletion should be a controlled lifecycle, not ad hoc manual SQL.

## I. Add audit and activity records

### What to add

An audit layer for sensitive mutations.

Suggested table:

- `audit_events`

Good candidates to record:

- session deleted
- session shared publicly
- API key created
- API key revoked
- cache deleted
- billing tier changed
- user invited to workspace

### Why

Without audit trails, debugging and support become guesswork.

### Maintainability goal

Security-significant actions should be observable independent of app logs.

## J. Add account-level billing model

### What to add

A billing ownership model separate from ad hoc Stripe references on keys.

Suggested tables:

- `billing_accounts`
- `billing_subscriptions`
- `billing_entitlements`

### Why

Today the app has some Stripe linkage, but not a coherent entitlement model for:

- user plans
- workspace plans
- seat limits
- quota policies
- premium features such as longer cache TTL

### Maintainability goal

Billing should feed policy through one entitlement layer, not through scattered route checks.

## K. Add provider cache ownership now, not later

### What to add

If Gemini context caching is implemented, cache metadata should include:

- `workspace_id`
- `created_by_user_id`
- `source_paper_asset_id`
- `session_id`

### Why

Context caches will become billable infrastructure assets.
They need ownership, retention, and cleanup from day one.

### Maintainability goal

Do not introduce a second unowned asset class right after fixing the first one.

## L. Add support for identity changes and account merge

### What to add

A plan for:

- email change
- provider relink
- duplicate account merge
- guest-to-account claiming

### Why

These problems appear late if ignored, but they are expensive to fix retroactively.

### Maintainability goal

All ownership should survive identity changes without rewriting business data.

## What Must Be Added

At minimum, this product should gain these tables or equivalent models:

- `users`
- `workspaces`
- `workspace_memberships`
- `paper_assets`
- `libraries`
- `library_documents`
- `team_templates`
- `uploaded_files`
- `billing_accounts`
- `billing_subscriptions`
- `billing_entitlements`
- `audit_events`
- `deletion_requests`
- `export_jobs`

At minimum, these existing areas need migration work:

- `src/auth.ts`
- `src/lib/db/council-db.ts`
- `src/lib/core/council.ts`
- `src/lib/api-keys.ts`
- `src/lib/paper-ingest.ts`
- `src/lib/tools/handlers/rag.ts`
- `src/lib/team-template-store.ts`
- session and sharing API routes
- Stripe success / webhook flow

## Why This Architecture Is Maintainable

This design stays maintainable because it separates:

- identity
- ownership
- product assets
- storage implementation
- billing
- audit
- lifecycle operations

That separation prevents several failure patterns:

- using email as a database key everywhere
- mixing billing state into session tables
- mixing file storage facts into review session rows
- treating browser localStorage as durable product state
- treating provider caches as unowned infrastructure

## Why This Architecture Is Extensible

This model supports future features without schema panic:

- team workspaces
- shared paper libraries
- admin tooling
- enterprise retention policies
- API key management by team role
- server-side template gallery
- user export and delete flows
- shared Gemini cache reuse within a workspace

## Recommended Delivery Plan

## Phase 0: Stabilize identity and ownership

1. Add `users`.
2. Add `workspaces`.
3. Add `workspace_memberships`.
4. Start resolving auth sessions to internal user ids.

Goal:

Stop creating new product behavior on top of email-only ownership.

## Phase 1: Re-root existing assets

1. Add `workspace_id` and `created_by_user_id` to sessions.
2. Attach API keys to workspace ownership.
3. Add server-side team templates.
4. Add upload metadata ownership.

Goal:

Move the current product from session-centric to account-centric ownership.

## Phase 2: Formalize paper assets and libraries

1. Add `paper_assets`.
2. Add `libraries` and `library_documents`.
3. Map current `documents/document_chunks` usage behind owned paper assets.
4. Add paper deduplication and source tracking.

Goal:

Turn technical storage into a proper product library.

## Phase 3: Add lifecycle and compliance primitives

1. Add audit events.
2. Add deletion requests.
3. Add export jobs.
4. Add retention policy hooks.

Goal:

Make support, privacy, and operations manageable.

## Phase 4: Add billing and plan-aware policy

1. Add billing accounts and entitlements.
2. Route quota rules through entitlements.
3. Bind premium features to workspace plan.
4. Integrate future provider cache policy into entitlements.

Goal:

Make billing a clean policy input rather than a set of route-level exceptions.

## What Is Still Missing Beyond the Basic Data Model

Even after the tables above, Council will likely still need these concerns addressed:

### 1. Background job ownership

Long-running tasks such as:

- session runs
- exports
- ingestion
- cache cleanup

should have job records with owner and status, not live only inside request lifecycles.

### 2. Backfill and migration strategy

Existing data already uses:

- `owner_user_email`
- `owner_api_key_id`
- anonymous access tokens

The migration plan needs a deterministic backfill path, not just new schema.

### 3. Role model

If workspaces are added, define roles early:

- owner
- admin
- editor
- viewer

Otherwise sharing rules will drift.

### 4. Data classification

Not all stored data has the same sensitivity.

At minimum classify:

- authentication identity
- uploaded paper content
- generated reports
- API keys
- billing metadata

This drives encryption, retention, and logging policy.

### 5. Secrets and encryption boundaries

Some assets should be encrypted or specially protected at rest:

- pending plaintext API keys
- any future provider tokens
- potentially sensitive uploaded documents

### 6. Admin and support tooling

Once data becomes durable, someone needs safe tools to:

- inspect ownership
- reassign assets
- recover access
- fulfill deletion requests

### 7. Backup and restore assumptions

Durable user assets imply:

- backup policy
- restore plan
- corruption recovery expectations

### 8. Abuse and spam controls

Ownership alone is not enough.

The product also needs:

- rate limiting
- upload abuse control
- public share abuse control
- bot mitigation

### 9. Derived-data cleanup

Deleting a paper may also require deleting:

- chunks
- embeddings
- exports
- context caches
- session references

The system needs dependency-aware cleanup rules.

### 10. Product analytics boundaries

If analytics are added, decide clearly:

- which events are operational
- which are product analytics
- which are personally identifiable

Otherwise telemetry becomes a privacy risk.

## Non-Goals for the First Refactor

Do not try to solve everything in one migration.

The first refactor should not attempt:

- full enterprise RBAC
- cross-org collaboration
- complex legal-hold workflows
- provider-agnostic identity federation
- multi-region data residency

The first goal is narrower:

replace email-centric ownership with internal identity and workspace-centric asset ownership.

## Summary

Council already persists meaningful product data.

What it lacks is a coherent ownership model across users, workspaces, papers, templates, sessions, keys, uploads, billing, and future provider caches.

The correct direction is:

- make users first-class
- make workspaces the ownership root
- treat sessions as one asset type, not the whole data model
- formalize paper/library ownership
- move templates and uploads to durable server-side storage
- add audit, deletion, export, and billing primitives

That is the path to a codebase that is easier to secure, easier to operate, and much easier to extend.

## Immediate Next Step

The next highest-leverage step is:

- add `paper_assets`
- add `libraries`
- add `library_documents`

That is the point where the product will stop conflating:

- user-owned paper assets
- low-level retrieval implementation tables
