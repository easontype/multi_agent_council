# Design System Audit

## Scope

References reviewed:
- `Council Design System/README.md`
- `Council Design System/colors_and_type.css`
- `Council Design System/ui_kits/council/chrome.jsx`
- `Council Design System/ui_kits/council/setup.jsx`
- `Council Design System/ui_kits/council/timeline.jsx`
- `Council Design System/ui_kits/council/sources.jsx`

Implementation reviewed:
- `src/app/analyze/page.tsx`
- `src/app/share/[id]/page.tsx`
- `src/components/council/*`

Notes:
- This audit focuses on visual and content alignment only. It does not recommend code changes yet.
- Findings below are representative. Some token issues repeat many times across the same files.

## A. Tokens Inconsistent

- Non-token colors are used throughout the workspace instead of the palette defined in `colors_and_type.css`. Repeated examples include `#1a1a1a`, `#222`, `#333`, `#444`, `#555`, `#666`, `#777`, `#888`, `#999`, `#aaa`, `#bbb`, `#ccc`, `#ddd`, `#e8e6df`, `#e8e8eb`, `#d6d3d1`, `#57534e`, `#dbe4ff`, `#4f46e5`, `#5f5f68`, `#fbfbfb`, `#fbfbfc`, `#fcfcfd`, `#f5f5f6`, and `#22c55e`. Representative refs: `src/app/analyze/page.tsx:287-406`, `src/app/share/[id]/page.tsx:52-160`, `src/components/council/source-panel.tsx:65-211`, `src/components/council/review-setup-panel.tsx:618-964`, `src/components/council/paper-preview.tsx:41-161`.

- Fractional type sizes and spacing values drift from the tokenized type scale. The design system scale is `10/11/12/13/14/15/16/18/24/30/36`, but the implementation repeatedly uses `10.5`, `11.5`, `12.5`, `13.5`, and letter-spacing values like `0.03em`, `0.04em`, `0.06em`. Representative refs: `src/components/council/review-setup-panel.tsx:27-48, 621-642, 881-945, 1207-1272`, `src/components/council/agent-message.tsx:66-183`, `src/components/council/chat-with-paper.tsx:64-166`, `src/app/share/[id]/page.tsx:22-38`.

- Several shadows are outside the approved shadow set. The design system only allows `0 1px 2px rgba(15,23,42,0.05)`, `0 1px 4px rgba(0,0,0,0.04)`, `0 2px 8px rgba(0,0,0,0.07)`, `0 8px 22px rgba(17,24,39,0.16)`, and `0 24px 60px rgba(15,23,42,0.16)`. Current outliers include `0 10px 30px rgba(15, 23, 42, 0.06)` in `src/components/council/paper-preview.tsx:139-143` and avatar pulse treatment `0 4px 12px ${agent.color}44` in `src/components/council/agent-avatar.tsx:26-38`.

- Success status uses `#22c55e` in `src/app/analyze/page.tsx:158` and `src/components/council/agent-avatar.tsx:37`, but the design token set defines success foreground as `#16a34a` and deep success as `#15803d`.

- Some icons hardcode stroke colors instead of inheriting via `currentColor`, which breaks the iconography rule. Refs: `src/components/council/tool-card.tsx:20,37` and `src/components/council/source-panel.tsx:206`.

## B. Component Visual Deviations

- `AgentMessage` does not match the design-system message bubble. The spec calls for a bordered bubble with `2px` left accent, top/right/bottom hairline borders, `0 12px 12px 0` radius, and a subtle vertical tint. The current implementation renders complete messages as flat timeline rows with only a bottom separator, and only streaming messages get a left accent. Ref: `src/components/council/agent-message.tsx:126-183`.

- The roster in the timeline does not match the reference roster. The design system uses a tighter top strip with overlapping avatar circles, compact meta text, and an in-progress pill. The current implementation uses wrapped chip-like pills for every agent, which reads as a tag list instead of a debate roster. Ref: `src/components/council/discussion-timeline.tsx:11-51`.

- `SourcePanel` cards are close in spirit but off-spec in structure. The reference source card uses `3px` left accent plus `0 10px 10px 0` radius, Georgia title styling, metadata rows, and citation pills. The current cards use all-corner `8px` rounding, sans title text, no author/meta row, and no source pills. Ref: `src/components/council/source-panel.tsx:138-188`.

- The source rail itself is flatter than the reference. The design-system rail has a stronger sidebar shell and header strip. Current `SourcePanel` content starts directly on the panel background with no sticky header section and no header count treatment matching the UI kit. Refs: `src/components/council/review-sidebar.tsx:20-49` and `src/components/council/source-panel.tsx:58-111`.

- `ReviewSetupPanel` is only partially aligned with the setup kit. It has the right broad structure, but many controls use generic card/button chrome rather than the kit’s tighter segmented controls. The top-level setup rail header and inline cost treatment from the reference are missing, and the panel is split into several standalone cards rather than reading as one cohesive sidebar system. Refs: `src/app/analyze/page.tsx:467-533` and `src/components/council/review-setup-panel.tsx:1363-1606`.

- The agent cards in setup are directionally correct, but still drift from the reference. The top strip exists, yet footer controls, chip hierarchy, description panel tone, and custom badge styling do not fully match the reference card. The blue custom badge (`#4f46e5`) and `#dbe4ff` border are also outside the official brand token set. Ref: `src/components/council/review-setup-panel.tsx:1167-1308`.

- `PaperPreview` does not match the chrome reference. The reference preview sits on a warm layered shell (`#fcfcfb` outer, white inner) with a more editorial header strip. The current implementation uses a white root, a gray preview bed (`#f5f5f7`), and a heavier custom shadow that feels more app-generic than Council-specific. Ref: `src/components/council/paper-preview.tsx:54-161`.

- The shared page is the largest visual divergence. The design system sets a 760px read-only page with the same Council language: sticky translucent header, editorial verdict block, round dividers, and debate message cards. The current `share/[id]` page is a generic document page with simple turn cards and no roster, no message-bubble treatment, and no Council-specific round divider. Ref: `src/app/share/[id]/page.tsx:1-275`.

- Several local helper surfaces are visually generic rather than system-native. `ThinkingBlock`, `ToolCard`, and `CompareView` use neutral boxes and table-like panels that do not map cleanly to any reference component in the design kit. Refs: `src/components/council/thinking-block.tsx:30-79`, `src/components/council/tool-card.tsx:56-72`, `src/components/council/compare-view.tsx:104-321`.

## C. Content Tone Deviations

- `AI-Assisted Builder` uses a banned word. The design system explicitly says to avoid “AI” and prefer `reviewer`, `agent`, `team builder`, or equivalent. Ref: `src/components/council/review-setup-panel.tsx:641`.

- `Council Architect` may be acceptable as a product noun, but the surrounding copy is more assistant-like than pragmatic tool copy: `Fine-tune this reviewer before the debate starts.` and `Answer a few questions and generate a full custom panel` are more explanatory and productized than the rest of the system language. Refs: `src/components/council/review-setup-panel.tsx:167, 1448-1449`.

- Several helper lines are too verbose or generic relative to the design system’s direct, literal tone. Representative examples: `Configure the panel before starting the debate.`, `Save custom reviewer teams locally so you can reuse them on the next paper.`, `Ask focused questions against the ingested paper library.`, `Click Start Review to convene the panel`. Refs: `src/app/analyze/page.tsx:479, 532`, `src/components/council/chat-with-paper.tsx:68`, `src/components/council/discussion-timeline.tsx:103-104`.

- Status casing drifts into title-style state labels that are not product nouns: `In Progress`, `Concluded`, `Staged`. The design system is stricter about sentence case outside product names and microlabels. Ref: `src/app/analyze/page.tsx:152-159`.

- There are visible encoding / placeholder artifacts in user-facing strings and parsing logic. These are not tone-consistent and should be treated as content bugs, not only implementation bugs. Refs: `src/components/council/review-setup-panel.tsx:182`, `src/components/council/thinking-block.tsx:31,49`, `src/components/council/source-panel.tsx:130`, `src/components/council/compare-view.tsx:198,208`, `src/components/council/agent-message.tsx:18-25`.

- Positive note: no emoji usage was found in the audited surfaces, which is aligned with the design system. `Link copied!` is also explicitly allowed by the design system and is not a problem.

## D. Missing Components

- The analyze workspace does not surface the design-system moderator verdict card in the right rail. The reference includes a fully styled verdict surface with confidence pill and footer metadata; the live workspace only has a small “Review concluded” banner in `SourcePanel`. Refs: `Council Design System/ui_kits/council/sources.jsx` vs `src/components/council/source-panel.tsx:197-214`.

- The timeline conclusion state is missing the reference export action inside the conclusion banner. The UI kit’s conclusion strip includes a lightweight export control, but the live timeline only shows a static banner. Ref: `src/components/council/discussion-timeline.tsx:108-122`.

- The source card metadata system from the design kit is not implemented. The reference cards support title plus metadata and cited-by labeling as structured pills; current cards only show title, snippet, and a plain `cited by` line. Ref: `Council Design System/ui_kits/council/sources.jsx` vs `src/components/council/source-panel.tsx:159-188`.

- The share page is missing the full read-only Council debate presentation: sticky translucent chrome, roster, styled round divider, and reference message bubbles. It currently renders only a simplified verdict block and transcript cards. Ref: `src/app/share/[id]/page.tsx:1-275`.

- The setup rail is missing the stronger reference header system that combines microlabel, inline cost, and a more cohesive segmented-control cluster. Current setup information is distributed between the page shell, panel body, and bottom CTA area. Refs: `src/app/analyze/page.tsx:467-533` and `src/components/council/review-setup-panel.tsx:1363-1606`.

## Suggested Fix Order

- First pass: replace non-token colors, sizes, spacing, and icon color inheritance.
- Second pass: align `AgentMessage`, `SourcePanel`, `PaperPreview`, and the shared page to the reference component shells.
- Third pass: rewrite setup/chat/helper copy to match the content rules and remove AI-facing phrasing.
- Fourth pass: add the missing moderator verdict, export action, source metadata, and shared-page chrome.
