# Council Red Team Remediation

Date: 2026-05-16

This document records the vulnerabilities that were successfully exercised against the local `council` instance, plus a concrete remediation plan.

Scope of work:

- Black-box and gray-box attack simulation against the local app running on `http://localhost:3001`
- No production assumptions
- No code changes performed during attack execution

## Executive Summary

Four issues were successfully validated:

1. Critical: `paperAssetId` IDOR allows unauthorized users to create sessions from assets they do not own, then query the attached paper library.
2. High: Anonymous quota enforcement can be bypassed on bare Node / local dev by rotating `User-Agent`.
3. Medium: Credentials auth is enabled locally and usable with a plaintext admin password from `.env.local`.
4. Medium: PDF validation is inconsistent across routes; fake PDFs are rejected by `/api/papers/upload` but still reach parser/error paths in `/api/papers/asset` and `/api/papers/ingest`.

There is also an architectural privacy issue that amplifies the IDOR:

- Global paper asset reuse is not tenant-scoped. Two unrelated clients receive the same `paperAssetId` for the same paper.

## Validated Findings

### 1. Critical: `paperAssetId` IDOR with downstream paper exfiltration

Severity: Critical

Impact:

- Any actor who learns a valid `paperAssetId` can create a new session from that asset without proving ownership.
- The new session is then owned by the attacker, who can use session-bound endpoints such as `/api/sessions/[id]/chat` to extract content from the underlying paper library.

Why it happens:

- `src/app/api/sessions/from-asset/route.ts` loads the asset with `getPaperAssetById(paperAssetId)` and does not perform any owner or workspace authorization check before calling `createCouncilSession`.
- `src/lib/paper-assets.ts` implements `getPaperAssetById()` as an unrestricted `SELECT * FROM paper_assets WHERE id = $1`.

Validated attack:

1. Anonymous client A created or resolved a paper asset with `POST /api/papers/asset`.
2. Anonymous client B, with no shared auth state or cookies, called `POST /api/sessions/from-asset` using only the returned `paperAssetId`.
3. Server returned `201` and set a new `council_session_<id>` cookie for the attacker-owned session.
4. Client B then called `POST /api/sessions/[id]/chat` and successfully received grounded answers from the paper library.

Observed PoC result:

```json
{
  "paperAssetId": "OL9iNthUGV7jO1cosK93n",
  "sessionId": "VXy4ykGuLqwKbi-EhxB7Z",
  "chatStatus": 200
}
```

### 2. High: Anonymous quota bypass via `User-Agent` rotation

Severity: High

Impact:

- On the local deployment model, anonymous rate limits can be bypassed cheaply.
- This enables session creation spam, paper ingest abuse, and cost amplification.

Why it happens:

- `src/lib/web-quota.ts` avoids `X-Forwarded-For`, which is good, but on bare Node it falls back to `ip = "unknown"`.
- The anonymous fingerprint then becomes `unknown | council_anon cookie | user-agent`.
- The code reads `council_anon`, but the repo does not set that cookie anywhere.
- Result: the only stable distinguisher in local dev is `User-Agent`, which is attacker-controlled.

Validated attack:

- 5 requests to `POST /api/sessions` using the same `User-Agent`:
  - First 3 returned `201`
  - Next 2 returned `429`
- 5 more requests using 5 different `User-Agent` strings:
  - All 5 returned `201`

Observed PoC result:

```json
{
  "fixed": [201, 201, 201, 429, 429],
  "rotated": [201, 201, 201, 201, 201]
}
```

### 3. Medium: Development credentials auth is live and exploitable

Severity: Medium

Impact:

- Anyone with repo or host access can log in using the configured local admin password.
- This is acceptable only if explicitly intended for isolated developer use. It is not safe if the app is exposed on a shared machine, tunnel, or staging environment.

Why it happens:

- Credentials provider is enabled in non-production by default.
- `.env.local` contains:
  - `AUTH_ADMIN_EMAIL=admin@council.local`
  - `AUTH_ADMIN_PASSWORD=admin123`
- `/api/auth/providers` exposes the credentials provider.

Validated attack:

1. Requested `/api/auth/csrf`
2. Posted to `/api/auth/callback/credentials`
3. Received `302 -> /home` and `authjs.session-token`
4. Used the issued session cookie against `/api/me`

Observed PoC result:

```json
{
  "loginStatus": 302,
  "location": "http://localhost:3001/home",
  "sessionCookiePresent": true,
  "meStatus": 200
}
```

### 4. Medium: Inconsistent PDF validation across routes

Severity: Medium

Impact:

- Fake PDFs are rejected early in one route but still hit parser or deeper error paths in others.
- This increases parser attack surface and makes defensive behavior inconsistent.

Why it happens:

- `/api/papers/upload` performs magic-byte validation before parsing.
- `/api/papers/asset` and `/api/papers/ingest` accept the upload buffer and send it to `extractTextFromPdfBuffer()` without the same `%PDF` check.

Validated attack:

- Uploaded the same text file renamed to `fake.pdf` to 3 endpoints.

Observed results:

```text
/api/papers/upload  -> 400  "File does not appear to be a valid PDF"
/api/papers/asset   -> 502  "An internal error occurred. Please try again."
/api/papers/ingest  -> 500  "An internal error occurred. Please try again."
```

### 5. Architectural privacy issue: global paper asset reuse is cross-tenant

Severity: Medium

Impact:

- Asset identity is shared globally across users and anonymous clients.
- This leaks existence information and makes `paperAssetId` materially more useful to attackers.
- It also amplifies the IDOR because one tenant's asset becomes a reusable global handle.

Validated attack:

- Two distinct anonymous clients submitted the same arXiv ID to `POST /api/papers/asset`.
- Both received the same `paperAssetId`.

Observed PoC result:

```json
{
  "sameAssetId": true,
  "paperAssetId": "OL9iNthUGV7jO1cosK93n",
  "reusedAsset": true
}
```

## Root Cause Summary

The main issue is a broken trust boundary around `paper_assets`.

The current design mixes two ideas:

- Canonical content deduplication
- User authorization

Today, a globally reusable `paperAssetId` acts as both a cache key and an access handle. That is the wrong abstraction. Cache identity and access identity must be separated.

## Remediation Plan

### Priority 0: Fix `paperAssetId` authorization

Target outcome:

- Knowing a `paperAssetId` must never be sufficient to create or access a session unless the requester is authorized for that asset.

Required changes:

1. Introduce explicit asset ownership metadata.
2. Enforce ownership in every route that accepts `paperAssetId`.
3. Decouple canonical document cache from tenant-visible asset records.

Recommended schema direction:

Add ownership columns to `paper_assets`:

```sql
ALTER TABLE paper_assets
  ADD COLUMN IF NOT EXISTS owner_user_email TEXT,
  ADD COLUMN IF NOT EXISTS owner_access_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
```

But the stronger design is:

- `canonical_papers`
  - global dedupe object keyed by arXiv ID / checksum
  - contains normalized metadata and document/library linkage
- `workspace_paper_assets`
  - tenant-owned wrapper row
  - references `canonical_papers(id)`
  - enforces owner/workspace visibility

Implementation requirements:

- Replace unrestricted `getPaperAssetById()` usage in request paths with a scoped accessor:
  - `getPaperAssetByIdForRequest(req, assetId)`
  - returns asset only if:
    - authenticated workspace owner/member is allowed, or
    - anonymous owner cookie token matches an asset-level hash
- Update `POST /api/sessions/from-asset`
  - reject unauthorized asset access with `404`
- Review all `paperAssetId` consumers:
  - `/api/sessions/from-asset`
  - `/api/papers/[id]`
  - `/api/papers/[id]/retry`
  - any future preload/setup route

Anonymous ownership design:

- When an anonymous user creates an asset, mint an asset-scoped token
- Store only its hash
- Set a cookie such as `council_asset_<assetId>`
- Require that cookie to reuse that asset anonymously later

Do not:

- Use `workspace_id IS NULL` as implicit public access
- Treat cache reuse as authorization

### Priority 1: Repair anonymous quota identity

Target outcome:

- Anonymous quota should not be bypassable by rotating `User-Agent`.

Required changes:

1. Issue a stable server-generated anonymous cookie.
2. Use that cookie as the primary local-dev anonymous identifier.
3. Treat missing cookie issuance as part of the request lifecycle.

Implementation direction:

- Introduce `council_anon` issuance middleware or issue it from first quota-guarded route.
- Value should be random, opaque, and signed or MACed.
- Fingerprint order:
  - trusted platform IP if present
  - stable server-issued anonymous cookie
  - user-agent only as a weak auxiliary signal

Recommended logic:

```ts
if (authenticatedUser) actor = `user:${email}`
else if (anonCookie)   actor = `anon:${anonCookieId}`
else                   mint anon cookie and use minted id
```

On local dev / bare Node:

- Never let `user-agent` be the main bucket key
- If trusted IP is unavailable, the server-issued cookie must carry the identity

Add tests:

- same cookie + rotated UA should still hit the same quota bucket
- different cookie + same UA should be treated as different anonymous actors
- missing cookie should cause issuance, not weak fallback

### Priority 2: Lock down development credentials auth

Target outcome:

- Credentials auth should be opt-in, not automatic in non-production.

Required changes:

1. Remove hardcoded fallback credentials from source.
2. Make credentials provider disabled unless explicitly enabled.
3. Remove dev credential hints from the login UI.

Recommended policy:

```ts
const enableCredentials = process.env.AUTH_ENABLE_CREDENTIALS === "true";
```

And:

- If `AUTH_ENABLE_CREDENTIALS !== "true"`, do not register the provider
- Never ship fallback secrets in code
- Never render local login hints in UI

Operational guidance:

- Treat `.env.local` as sensitive host state
- Confirm it is excluded from version control
- Rotate any secrets that have ever been shared outside the machine

### Priority 3: Unify PDF validation

Target outcome:

- All upload and ingest paths should reject malformed non-PDF input before parser invocation.

Required changes:

1. Extract a shared `validatePdfUploadBuffer()` helper.
2. Call it from all 3 routes:
  - `/api/papers/upload`
  - `/api/papers/asset`
  - `/api/papers/ingest`
3. Reject fake PDFs before calling `extractTextFromPdfBuffer()`.

Shared validation should include:

- file size limit
- `%PDF` magic bytes
- optional MIME sanity check
- parser timeout
- page count limit
- text cap

Recommended helper contract:

```ts
function validatePdfMagic(buffer: Buffer): void
function validatePdfForTier(file: File | Buffer, limits: PdfLimits): void
```

### Priority 4: Reduce privacy leakage from global asset reuse

Target outcome:

- Users should not learn more than necessary about other users' cached papers.

Required changes:

1. Stop returning globally meaningful `paperAssetId` values across tenants.
2. Separate canonical paper cache from tenant-owned paper references.
3. Reconsider `reusedAsset` exposure.

Safer behavior:

- Two tenants may point to the same canonical paper internally
- But each tenant gets a different tenant-scoped asset record ID
- `reusedAsset` should only refer to reuse within the same tenant unless there is a deliberate product reason otherwise

## Concrete Code Tasks

### Auth and access control

- Add `resolvePaperAssetAccess(req, assetId)` in `src/lib/paper-assets.ts` or a dedicated access module
- Refactor `src/app/api/sessions/from-asset/route.ts` to require that resolver
- Audit all `paperAssetId` routes for direct fetches

### Data model

- Introduce canonical paper vs tenant asset split, or at minimum asset-level ownership hashes for anonymous users
- Add migrations and backfill existing assets

### Quota

- Add anonymous cookie issuance utility
- Update `src/lib/web-quota.ts`
- Ensure routes can attach cookie when first anonymous request lands

### PDF validation

- Create shared helper in `src/lib/paper-ingest.ts` or `src/lib/pdf-limits.ts`
- Replace duplicate per-route logic

### Login

- Remove hardcoded `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD`, `DEV_AUTH_SECRET`
- Gate credentials provider behind explicit env only
- Remove dev fallback hint from login form

## Required Tests

Add or update tests for the following:

1. `from-asset` unauthorized anonymous reuse returns `404`
2. `from-asset` unauthorized cross-workspace reuse returns `404`
3. authorized anonymous asset reuse with correct cookie succeeds
4. quota remains blocked when only `User-Agent` changes
5. all upload routes reject fake PDFs with the same status family and safe message
6. credentials provider is absent unless `AUTH_ENABLE_CREDENTIALS=true`
7. two tenants creating the same paper do not receive the same tenant asset ID

## Verification Checklist After Fix

### IDOR

- Anonymous client A creates asset
- Anonymous client B reuses `paperAssetId` without owner token
- Expect `404`

### Quota

- 5 anonymous requests with rotating UA but same server-issued anon cookie
- Expect limit to trigger normally

### Credentials auth

- `/api/auth/providers` should not expose `credentials` unless explicitly enabled

### PDF validation

- Fake PDF should fail consistently across:
  - `/api/papers/upload`
  - `/api/papers/asset`
  - `/api/papers/ingest`

## Recommended Fix Order

1. Block `from-asset` IDOR immediately
2. Add anonymous quota cookie and remove UA-only bucketing
3. Disable implicit credentials auth
4. Unify PDF validation
5. Refactor paper asset model to separate canonical cache from tenant access

## Notes

The most important architectural lesson is this:

`paperAssetId` currently behaves like an authorization bearer reference even though it was designed as a cache object reference.

That must be corrected first. Until then, any future feature that accepts `paperAssetId` is likely to reintroduce the same class of bug.
