# Council UI Refactor Execution Plan

Updated: 2026-05-01

## Goal

Restructure Council from a mixed single-page `analyze` experience into a clearer two-surface product:

- `New Review` for creating and configuring a review
- `Session Workspace` for consuming, resuming, and exporting a running or completed review

This refactor is primarily an information architecture and navigation correction. Visual redesign should follow the route and state split, not lead it.

## Current Checkpoint

Current implementation state:

- Phase 5A visual pass is complete
- Phase 5B style debt reduction is now complete in the working tree

Completed so far:

- Phase 1A
- Phase 1B
- Phase 1C
- Phase 2A
- Phase 2B
- Phase 3A
- Phase 3B
- Phase 4A
- Phase 4B
- Phase 5A (first pass)
- Phase 5B

Current state:

- `/review/new` and `/review/[id]` are active routes
- `/analyze` now redirects to the new route structure
- authenticated app pages share one shell/navigation model
- review pages no longer duplicate app-level navigation inside the page-local header
- `/review/new` now uses a dedicated draft layout with explicit paper/setup/template sections
- `/review/new` now uses a right-side summary rail for launch CTA, draft summary, and template quick access
- `/review/[id]` now uses an explicit session workspace shell
- session workspace now exposes left-side canvas switching for `timeline / compare / map`
- session actions now live in session context via share / export / rerun / duplicate as new
- duplicate-as-new now restores draft configuration and reopens arXiv-backed sessions as `/review/new?arxiv=...`
- uploaded-PDF duplicate-as-new now restores configuration and prompts the user to re-upload the PDF
- draft and session review surfaces now share a first-pass visual system layer for headers, cards, and layout rhythm
- review surfaces now use shared presentation primitives for page shells, section frames, rail cards, pills, and action buttons
- `review-surface.tsx` now delegates draft-local and session-local state to focused hooks instead of carrying all local UI state inline

Next planned phase:

- Validation and targeted cleanup only; no larger IA change is currently planned inside this document

## Why This Refactor

Current problems:

- `/analyze` currently mixes two different jobs:
  - draft/setup flow
  - live session workspace
- route semantics are overloaded through query params such as:
  - `arxiv`
  - `session`
  - `tab`
  - `new`
- setup state and session state are coupled in one large page component
- page headers and navigation differ across landing, dashboard, analyze, and share
- the user mental model is unstable:
  - "Am I still creating a review?"
  - "Am I already inside a session?"
  - "Why does the page layout change so dramatically without changing pages?"

## Product Decision

Adopt the following primary app structure:

```text
/
/login
/home
/home/reviews
/review/new
/review/[id]
/share/[id]
/keys
```

Interpretation:

- `/review/new` owns review draft creation
- `/review/[id]` owns session viewing and interaction
- `/analyze` becomes a compatibility entrypoint only, then is removed later

## Target Information Architecture

```text
Council
Marketing / Entry
  Landing `/`
  Login `/login`
  API / Pricing `/keys`
Authenticated App
  Home Dashboard `/home`
  Review Library `/home/reviews`
  New Review `/review/new`
  Session Workspace `/review/[id]`
Public Output
  Shared Review `/share/[id]`
```

## Navigation Model

Navigation should exist at three layers.

### 1. Global App Nav

Used consistently across:

- `/home`
- `/home/reviews`
- `/review/new`
- `/review/[id]`

Target nav items:

- `Council` or logo -> `/home`
- `Home`
- `Reviews`
- `New Review`
- usage/quota indicator
- language selector
- account menu

Do not place session-specific actions here.

### 2. Step Navigation for `/review/new`

`/review/new` should behave like a creation flow, not a workspace.

Target step model:

1. Paper
2. Review Setup
3. Confirm & Start

Primary CTA:

- `Start Review`

Secondary CTAs:

- `Save Template`
- `Load Template`
- `Back to Dashboard`

### 3. Context Navigation for `/review/[id]`

`/review/[id]` should behave like a workspace.

Navigation layers inside the page:

- session top bar:
  - back to reviews
  - paper title
  - session status
  - share
  - export
  - rerun
  - duplicate as new
- left canvas view switch:
  - timeline
  - compare
  - map
- right rail tool switch:
  - sources
  - chat

## User Flows

### Flow A: New user

```text
Landing
-> New Review
-> choose paper
-> configure review
-> start review
-> Session Workspace
-> share/export
```

### Flow B: Returning user

```text
Home
-> Recent Reviews or Reviews Library
-> Session Workspace
-> resume if needed
-> inspect sources/chat
-> export or share
```

### Flow C: Power user / repeated workflow

```text
Home
-> New Review
-> load saved template
-> start review
-> Session Workspace
-> duplicate as new
-> New Review with prefilled config
```

## Page Responsibilities

### `/review/new`

Owns:

- arXiv input
- PDF upload
- paper staging
- review mode
- rounds
- editable team seats
- saved templates
- cost estimate
- final confirmation
- session creation and redirect

Must not own:

- session transcript
- source panel
- paper chat
- share/export controls

### `/review/[id]`

Owns:

- session loading
- restore/resume behavior
- discussion timeline
- compare view
- debate map
- source panel
- chat with paper
- share/export/publish actions
- rerun/duplicate session actions

Must not own:

- initial source picking
- team composition as the default primary interaction

## UI Shell Targets

### `/review/new`

```text
Top nav
Page header
Main step flow
Right summary rail
```

Main column:

- paper step
- configuration step
- confirmation step

Right rail:

- review summary
- template shortcuts
- sticky start CTA

### `/review/[id]`

```text
Top nav
Session top bar
Left debate canvas
Right workspace rail
```

Left canvas:

- roster/status
- timeline / compare / map
- moderator synthesis

Right rail:

- sources
- chat
- session metadata
- actions

## State Model Split

This refactor should explicitly separate two front-end state domains.

### ReviewDraft

Fields should include:

- source type
- arXiv id or uploaded file
- staged paper metadata
- mode
- rounds
- team agents
- selected template
- estimated cost

### ReviewSession

Fields should include:

- session id
- phase/status
- messages
- alerts
- evidence/source refs
- conclusion
- share state
- resumable state

## Route Migration Plan

### Phase 0: Compatibility

Keep `/analyze` temporarily, but downgrade it to a router/redirect surface.

Rules:

- `/analyze?arxiv=...` -> `/review/new?arxiv=...`
- `/analyze?session=...` -> `/review/[id]`
- `/analyze` with upload/new intent -> `/review/new`

### Phase 1: New route creation

Create:

- `src/app/review/new/page.tsx`
- `src/app/review/[id]/page.tsx`

Keep:

- `src/app/share/[id]/page.tsx`
- `src/app/home/page.tsx`
- `src/app/home/reviews/page.tsx`

### Phase 2: Remove `/analyze` as primary implementation

Once both new pages are stable:

- keep only redirect logic in `/analyze`
- later remove `/analyze` entirely if no external dependency remains

## Component Migration Plan

### Reuse for `/review/new`

Candidates to reuse or adapt:

- `src/app/analyze/_components/paper-source-picker.tsx`
- `src/components/council/review-setup-panel.tsx`
- `src/app/analyze/_components/setup-sidebar.tsx`

Likely changes:

- `SetupSidebar` should become a real `SummaryRail`, not a collapsible setup sidebar
- `PaperPreview` becomes optional or secondary, not the dominant left-side artifact

### Reuse for `/review/[id]`

Candidates to reuse directly:

- `src/components/council/discussion-timeline.tsx`
- `src/components/council/review-sidebar.tsx`
- `src/components/council/source-panel.tsx`
- `src/components/council/chat-with-paper.tsx`
- `src/components/council/session-restore-banner.tsx`

Likely changes:

- workspace shell should live under `src/components/review/session/*`
- session actions and metadata should stay inside session context, not draft context

## Current File Hotspots

Primary current hotspot:

- `src/components/review/review-surface.tsx`

This file still owns:

- paper source picking
- pending upload handoff
- session restore logic
- draft/session mode branching
- share/export state
- workspace tab state

This remains the main surface to simplify further after the IA split is stable.

## Proposed File Targets

### Routes

- `src/app/review/new/page.tsx`
- `src/app/review/[id]/page.tsx`
- `src/app/analyze/page.tsx` as temporary redirect wrapper

### Shared app shell

- `src/components/app/app-top-nav.tsx`
- `src/components/app/app-shell.tsx`

### New review UI

- `src/components/review/new/review-create-header.tsx`
- `src/components/review/new/review-draft-header.tsx`
- `src/components/review/new/review-draft-layout.tsx`

### Session workspace UI

- `src/components/review/session/session-top-bar.tsx`
- `src/components/review/session/session-workspace-layout.tsx`
- `src/components/review/session/session-actions.tsx`

## Execution Phases

### Phase 1A: Route creation and compatibility redirect

Status:

- Completed

### Phase 1B: Internal navigation migration

Status:

- Completed

### Phase 1C: Smoke verification for route split

Status:

- Completed

### Phase 2A: Shared app navigation shell

Status:

- Completed

### Phase 2B: Remove page-local nav duplication

Status:

- Completed

### Phase 3A: New Review layout split

Status:

- Completed

### Phase 3B: Summary rail and draft UX

Status:

- Completed

### Phase 4A: Session Workspace shell cleanup

Deliverables:

- convert current results layout into explicit workspace layout
- make left debate canvas and right workspace rail more intentional

Success criteria:

- session page reads like a workspace, not a leftover branch of the setup page

Status:

- Completed

### Phase 4B: Session actions and context controls

Deliverables:

- reorganize share/export/rerun/duplicate actions
- clarify session metadata and status placement

Success criteria:

- session actions appear only in session context and are easy to find

Status:

- Completed

### Phase 5A: Visual system pass

Deliverables:

- typography cleanup
- spacing normalization
- header visual consistency

Success criteria:

- product surfaces feel visually coherent

Status:

- Completed (first pass)

### Phase 5B: Style debt reduction

Deliverables:

- reduce inline-style sprawl where practical
- centralize repeated layout/presentation patterns

Success criteria:

- future UI changes become cheaper and less fragile

Status:

- Completed

## Engineering Notes

### Hooks and state

Current `useCouncilReview` remains useful for session streaming and hydration, but it still serves both draft and session surfaces through `ReviewSurface`.

`Duplicate as New` now relies on a draft-prefill handoff layer so session context can reopen draft setup without reusing the old analyze page model.

### Redirect and restore behavior

Restore logic now lives with session routes rather than draft creation entry.

Meaning:

- loading an existing session belongs to `/review/[id]`
- restoring last-opened session should not interfere with creating a fresh draft at `/review/new`

### Duplicate-as-new

This is now a first-class path:

- open session
- click `Duplicate as New`
- navigate to `/review/new` with restored team configuration
- if the session came from arXiv, reopen the arXiv source directly
- if the session came from an uploaded PDF, prompt for re-upload while keeping the panel setup

## Risks

### Product risks

- temporary inconsistency while old and new routes coexist
- user confusion if `/analyze` still exposes old UI too long

### Technical risks

- session restore behavior may regress during route split
- upload handoff still depends on client-side prefill / pending-upload behavior
- existing Playwright flows likely need updates to reflect the new session workspace structure

### Scope risks

- trying to fully redesign visuals before the route split will slow the project
- renaming too many components at once may increase churn without product gain

## Testing and Validation

Minimum acceptance flows:

1. Landing -> New Review -> Start -> Session Workspace
2. Home -> Recent Review -> Session Workspace
3. Home -> Reviews -> open session
4. Session Workspace -> Share -> open `/share/[id]`
5. Session Workspace -> Export
6. Session Workspace incomplete session -> Resume
7. Session Workspace -> Duplicate as New
8. New Review -> PDF upload -> Start
9. New Review -> arXiv input -> Start

Testing layers:

- update Playwright flows for route changes
- preserve session runtime tests
- manually verify pending upload and resume behavior

## Out of Scope for First Implementation

Do not block the route split on:

- full design-system rewrite
- replacing all inline styles
- large council runtime refactors
- billing/product entitlement redesign
- share page redesign

## Definition of Done

This refactor is considered complete when:

- users no longer use `/analyze` as the primary review surface
- creating a review and consuming a session happen on different routes
- global nav is consistent across app pages
- session actions are only shown in session context
- draft actions are only shown in draft context
- core flows pass:
  - start
  - resume
  - share
  - export
  - duplicate as new
