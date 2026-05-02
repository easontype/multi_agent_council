# Council Paper Cache + Topic Selection Execution Plan

> Version 2.0  
> Updated 2026-05-03  
> Status: active execution plan

---

## Summary

This document replaces the earlier concept draft with an implementation plan that matches the current repository state.

The next step is to introduce a canonical paper asset layer and add topic selection to `/review/new` without breaking the existing staged draft flow.

Current product constraints:

- `/review/new` is a staged draft route. Paper ingest does not happen until the user clicks `Start review`.
- `ingestPaper()` already deduplicates `documents` by `source_url + content_hash`.
- Sessions do not currently have a canonical paper model. They are only linked to paper content through `seat.library_id` and `session.context`.
- `uploaded_files` stores upload metadata and checksum, but does not preserve raw PDF bytes for durable reprocessing.

Implementation defaults for this plan:

- Keep the staged draft UX.
- Add a new paper asset layer above `documents`.
- Keep `documents` as the content/chunk storage layer.
- Defer AI topic suggestion, background jobs, and a full papers dashboard.

---

## Current State

### What already exists

- `src/lib/paper-ingest.ts`
  - Fetches arXiv PDFs, extracts text, embeds documents, and reuses an existing `document` when `source_url + content_hash` match.
- `src/app/api/papers/upload/route.ts`
  - Ingests the selected paper and immediately creates a session.
- `src/components/review/use-review-draft-state.ts`
  - Manages staged paper selection in `/review/new`.
- `src/hooks/use-council-review.ts`
  - Calls `/api/papers/upload` only after the user clicks `Start review`.
- `src/lib/core/council-paper-chat.ts`
  - Resolves the active paper library from `seat.library_id`.

### What does not exist yet

- No canonical `paper_assets` or `papers` table.
- No `paper_asset_id` or `paper_id` column on `council_sessions`.
- No topic preset step in `/review/new`.
- No pre-start paper cache lookup endpoint.
- No durable raw-PDF store for replaying historical uploads.

### Consequences

- Re-ingest reuse works at the `documents` layer, but not at the session/domain level.
- There is no stable paper identity for listing all sessions tied to the same paper.
- Topic choice is implicit in the current session topic/goal generation and cannot be intentionally chosen by the user.

---

## Target Design

### Product behavior

The user flow remains:

1. Open `/review/new`
2. Stage a paper by arXiv ID or PDF upload
3. Choose a review topic
4. Configure team / rounds
5. Click `Start review`

When `Start review` is clicked:

1. Resolve or create a canonical paper asset
2. Ensure the asset has a primary `document + library`
3. Create the session with `paper_asset_id`
4. Bind seats to the asset's primary library

### Data model

This plan uses a v1 paper asset model instead of the earlier `papers + session.paper_id` proposal.

#### `paper_assets`

Purpose: canonical paper identity and processing state.

Fields:

- `id`
- `workspace_id` nullable
- `canonical_title`
- `abstract`
- `authors`
- `year`
- `arxiv_id` nullable unique
- `canonical_checksum_sha256` nullable
- `status` text default `pending`
- `processing_error`
- `marker_processed` boolean default `false`
- `document_id` nullable
- `primary_library_id` nullable
- `created_at`
- `updated_at`
- `processed_at`

Status values:

- `pending`
- `processing`
- `ready`
- `failed`

#### `paper_asset_sources`

Purpose: track how a paper asset was identified.

Fields:

- `id`
- `paper_asset_id`
- `source_kind`
- `source_locator` nullable
- `checksum_sha256` nullable
- `uploaded_file_id` nullable
- `created_at`

Source kinds:

- `arxiv`
- `upload`
- `pdf_url`
- `text`

Identity rules:

- arXiv uses `source_kind='arxiv' + source_locator=<arxiv_id>`
- upload uses `source_kind='upload' + checksum_sha256`
- pdf URL uses `source_kind='pdf_url' + source_locator + checksum_sha256`
- text is not guaranteed to dedupe across sessions in v1

#### `paper_libraries`

Purpose: explicit mapping between a paper asset and its content library.

Fields:

- `id`
- `paper_asset_id`
- `library_id`
- `document_id`
- `is_primary`
- `created_at`

#### `council_sessions`

Add:

- `paper_asset_id` nullable FK

Keep:

- `topic`
- `goal`
- `seats`

Do not add a separate topic table in v1. Topic selection still persists into `session.topic` and `session.goal`.

### Design defaults

- One paper asset has one primary library in v1.
- Sessions reuse the asset's primary library instead of creating a new library each time.
- `documents` remain the source of truth for chunked content.
- Old sessions remain compatible even when `paper_asset_id` is null.

---

## Execution Phases

### Phase A: Asset Foundation

Goal: create canonical paper identity without changing the staged front-end flow.

Work:

- Extend `ensureCouncilSchema()` with:
  - `paper_assets`
  - `paper_asset_sources`
  - `paper_libraries`
  - `council_sessions.paper_asset_id`
- Add a paper asset service responsible for:
  - resolving an existing asset from source identity
  - creating a new asset when no match exists
  - attaching `document_id` and `primary_library_id`
  - updating `status`, `marker_processed`, and `processing_error`
- Wrap existing `ingestPaper()` behind a higher-level asset flow instead of letting session creation talk to `documents` directly.

Acceptance criteria:

- Two reviews of the same arXiv paper resolve to the same paper asset.
- Two uploads of the same PDF resolve to the same paper asset by checksum.
- Existing `documents` reuse still works; no duplicate embedding for cache hits.

### Phase B: Session Creation Refactor

Goal: make `/api/papers/upload` create sessions from paper assets instead of directly from ad hoc ingest results.

Work:

- Refactor `/api/papers/upload` to:
  1. parse the source
  2. resolve or create a paper asset
  3. ingest only when the asset has no primary document/library
  4. create a session with `paper_asset_id`
  5. bind all seats to the asset's primary library
- Extend `createCouncilSession()` input with `paperAssetId?: string | null`
- Update session persistence and row mapping to include `paper_asset_id`
- Update paper chat library resolution:
  - prefer `session.paper_asset_id -> paper_assets.primary_library_id`
  - fallback to legacy `seat.library_id`

Acceptance criteria:

- New sessions persist `paper_asset_id`.
- Cached papers create new sessions without re-ingesting the paper.
- Existing legacy sessions still work for debate and paper chat.

### Phase C: Topic Selection in `/review/new`

Goal: let the user intentionally choose the review focus before session creation.

Work:

- Add `PAPER_TOPIC_PRESETS`:
  - `methodology`
  - `novelty`
  - `reproducibility`
  - `statistics`
  - `impact`
  - `custom`
- Extend draft state with:
  - selected preset id
  - custom topic
  - custom goal
- Extend the `start()` payload from `useCouncilReview()` with:
  - `topic`
  - `goal`
  - optional `topicPresetId`
- Update `/api/papers/upload` to accept topic inputs and pass them into session creation.
- Add a new topic step to `/review/new`.

Rules:

- Preset topic uses the preset's fixed `topic` and `goal`.
- Custom topic requires `topic`.
- Custom goal is optional.
- If custom goal is empty, use a generic default:
  - `Provide rigorous multi-perspective academic critique of the selected topic.`

Acceptance criteria:

- Starting from a preset produces deterministic `session.topic` and `session.goal`.
- Starting from a custom topic persists the user-supplied topic.
- Duplicate-as-new restores the prior topic selection.

### Phase D: Cache Visibility, Backfill, and Compatibility

Goal: make the new model observable and incrementally adoptable.

Work:

- Add a lightweight lookup endpoint for arXiv draft-stage cache status.
- Show a cache badge in `/review/new` for arXiv papers:
  - `ready`
  - `processing`
  - `failed`
  - `unknown`
- Add a backfill script for older sessions and documents:
  - infer asset identity from arXiv URLs, library tags, and session context where possible
  - populate `paper_asset_id` only when the mapping is reliable
- Keep nullable compatibility for sessions that cannot be backfilled.

Acceptance criteria:

- Draft flow can show arXiv cache status before start.
- Backfill can attach at least old arXiv-backed sessions to paper assets.
- Unmappable historical rows do not break any existing flow.

---

## API and Type Changes

### Type changes

Add to council session types:

- `paper_asset_id?: string | null`

Extend session creation input:

- `paperAssetId?: string | null`

### `POST /api/papers/upload`

Request additions:

- `topic`
- `goal`
- `topicPresetId` optional

Response additions:

- `paperAssetId`
- `cacheStatus`
- `reusedAsset`

### New lookup endpoint

Add:

- `GET /api/papers/lookup?arxivId=...`

Response shape:

- `status`
- `paperAssetId`
- `title`
- `markerProcessed`
- `sessionCount` optional

---

## Testing Plan

### Unit tests

- asset resolution by arXiv id
- asset resolution by upload checksum
- asset creation on cache miss
- topic preset payload generation
- custom topic and default-goal generation

### Integration tests

- first-time paper upload creates:
  - paper asset
  - primary library
  - session with `paper_asset_id`
- second review of the same paper reuses the asset and library
- legacy sessions without `paper_asset_id` still load and chat correctly

### UI tests

- `/review/new` blocks start when custom topic is selected but blank
- preset selection updates summary state correctly
- duplicate-as-new restores topic choice
- arXiv draft flow shows cache badge states

### Backfill tests

- old arXiv sessions can be mapped to assets
- unknown or ambiguous historical rows remain null without breaking the app

---

## Explicit Non-Goals for This Iteration

These are intentionally deferred:

- AI-generated topic suggestion endpoint
- full papers dashboard or `/home/papers`
- durable raw-PDF storage for all historical uploads
- multi-library-per-paper strategies
- background job queue or detached ingest workers
- full `paper_assets -> multiple documents` support

---

## Rollout Notes

- Build the asset layer first, then switch session creation to use it.
- Add topic selection only after the session creation path accepts explicit topic/goal input.
- Keep all new foreign keys nullable during rollout.
- Prefer lazy or scripted backfill over mandatory migration of historical rows.

---

## Definition of Done

This plan is complete when all of the following are true:

- a canonical paper asset exists for newly created reviews
- new sessions persist `paper_asset_id`
- cached papers reuse their existing primary library
- `/review/new` includes topic selection
- old sessions remain compatible
- arXiv draft flow can show pre-start cache state
