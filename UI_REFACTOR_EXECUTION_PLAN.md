# Council UI Refactor Execution Plan

Updated: 2026-05-01

## Goal

Restructure Council from a mixed single-page `analyze` experience into a clearer two-surface product:

- `New Review` for creating and configuring a review
- `Session Workspace` for consuming, resuming, and exporting a running or completed review

This refactor is primarily an information architecture and navigation correction. Visual redesign should follow the route and state split, not lead it.

## Current Checkpoint

Last implementation commit:

- `f272149` `Split review routes and add shared app shell`

Completed so far:

- Phase 1A
- Phase 1B
- Phase 1C
- Phase 2A
- Phase 2B

Current state:

- `/review/new` and `/review/[id]` are active routes
- `/analyze` now redirects to the new route structure
- authenticated app pages share one shell/navigation model
- review pages no longer duplicate app-level navigation inside the page-local header

Next planned phase:

- Phase 3A: split `New Review` into clearer page-local sections and move it away from the old mixed analyze layout

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
├─ Marketing / Entry
│  ├─ Landing `/`
│  ├─ Login `/login`
│  └─ API / Pricing `/keys`
│
├─ Authenticated App
│  ├─ Home Dashboard `/home`
│  ├─ Review Library `/home/reviews`
│  ├─ New Review `/review/new`
│  └─ Session Workspace `/review/[id]`
│
└─ Public Output
   └─ Shared Review `/share/[id]`
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

Current code mixes these two domains in `src/app/analyze/page.tsx`. That split is one of the main goals of the refactor.

## Route Migration Plan

### Phase 0: Compatibility

Keep `/analyze` temporarily, but downgrade it to a router/redirect surface.

Rules:

- `/analyze?arxiv=...` -> `/review/new?arxiv=...`
- `/analyze?session=...` -> `/review/[id]`
- `/analyze` with upload/new intent -> `/review/new`

This avoids breaking existing links while removing `/analyze` from active product design.

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

- `src/app/analyze/_components/session-header.tsx`
- `src/app/analyze/_components/review-results.tsx`
- `src/components/council/discussion-timeline.tsx`
- `src/components/council/review-sidebar.tsx`
- `src/components/council/source-panel.tsx`
- `src/components/council/chat-with-paper.tsx`
- `src/components/council/session-restore-banner.tsx`

Likely changes:

- `SessionHeader` should become a workspace-specific top bar
- `ReviewResults` should be renamed closer to its actual role, such as `SessionWorkspaceLayout`

## Current File Hotspots

Primary current hotspot:

- `src/app/analyze/page.tsx`

This file currently owns:

- paper source picking
- pending upload handoff
- session restore logic
- setup sidebar state
- share/export state
- results layout state
- sidebar tab state

This is the main page to decompose first.

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
- `src/components/review/new/review-step-flow.tsx`
- `src/components/review/new/review-summary-rail.tsx`
- `src/components/review/new/paper-source-step.tsx`
- `src/components/review/new/review-config-step.tsx`
- `src/components/review/new/confirm-start-step.tsx`

### Session workspace UI

- `src/components/review/session/session-top-bar.tsx`
- `src/components/review/session/session-workspace-layout.tsx`
- `src/components/review/session/session-actions.tsx`
- reuse or wrap existing council components where possible

## Execution Phases

### Phase 1A: Route creation and compatibility redirect

Deliverables:

- create `/review/new`
- create `/review/[id]`
- convert `/analyze` into compatibility redirect logic

Success criteria:

- setup entry can be reached directly through `/review/new`
- session workspace can be reached directly through `/review/[id]`
- old `/analyze` links still land on the correct new route

Status:

- Completed

### Phase 1B: Internal navigation migration

Deliverables:

- update landing CTAs to `/review/new`
- update dashboard and reviews links to `/review/new` and `/review/[id]`
- update login and pricing entrypoints to `/review/new`

Success criteria:

- app-owned navigation no longer points primarily at `/analyze`

Status:

- Completed

### Phase 1C: Smoke verification for route split

Deliverables:

- verify draft entry
- verify session entry
- verify legacy `/analyze` redirect
- verify upload and arXiv entry still hand off correctly

Success criteria:

- no broken primary entrypoints after route split

Status:

- Completed

### Phase 2A: Shared app navigation shell

Deliverables:

- create shared top/app nav
- normalize nav structure across app pages

Success criteria:

- home, reviews, new review, and session pages share one app-level nav model

Status:

- Completed

### Phase 2B: Remove page-local nav duplication

Deliverables:

- reduce page-specific duplicated header/nav code
- move account/language/quota placement toward one consistent shell

Success criteria:

- app pages feel structurally related, not separately assembled

Status:

- Completed

### Phase 3A: New Review layout split

Deliverables:

- separate paper step, setup step, and confirm step
- reduce dependence on the current setup sidebar pattern

Success criteria:

- `New Review` reads like a creation flow, not a workspace

### Phase 3B: Summary rail and draft UX

Deliverables:

- build right summary rail
- add clearer review summary and sticky start CTA
- define save/load template placement

Success criteria:

- user can understand draft state at a glance

### Phase 4A: Session Workspace shell cleanup

Deliverables:

- convert current results layout into explicit workspace layout
- make left debate canvas and right workspace rail more intentional

Success criteria:

- session page reads like a workspace, not a leftover branch of the setup page

### Phase 4B: Session actions and context controls

Deliverables:

- reorganize share/export/rerun/duplicate actions
- clarify session metadata and status placement

Success criteria:

- session actions appear only in session context and are easy to find

### Phase 5A: Visual system pass

Deliverables:

- typography cleanup
- spacing normalization
- header visual consistency

Success criteria:

- product surfaces feel visually coherent

### Phase 5B: Style debt reduction

Deliverables:

- reduce inline-style sprawl where practical
- centralize repeated layout/presentation patterns

Success criteria:

- future UI changes become cheaper and less fragile

## Engineering Notes

### Hooks and state

Current `useCouncilReview` remains useful for session streaming and hydration, but should be consumed mainly by `/review/[id]`.

`/review/new` may need a lighter draft-focused state hook or store, separate from live session logic.

### Redirect and restore behavior

Restore logic should live with session pages, not draft creation pages.

Meaning:

- loading an existing session belongs to `/review/[id]`
- restoring last-opened session should not interfere with creating a fresh draft at `/review/new`

### Duplicate-as-new

This should become a first-class path:

- open session
- click `Duplicate as New`
- navigate to `/review/new` with prefilled configuration from prior session

This is easier after route separation.

## Risks

### Product risks

- temporary inconsistency while old and new routes coexist
- user confusion if `/analyze` still exposes old UI too long

### Technical risks

- session restore behavior may regress during route split
- upload handoff may break if pending file assumptions are tied to `/analyze`
- existing Playwright tests likely depend on current `/analyze` flow and will need updates

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

Those can follow after the IA correction lands.

## Recommended First Work Ticket Breakdown

1. Add new routes and redirect logic
2. Extract shared app top nav
3. Move setup UI into `/review/new`
4. Move session UI into `/review/[id]`
5. Fix restore and upload handoff edge cases
6. Update tests
7. Run visual and UX cleanup pass

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
