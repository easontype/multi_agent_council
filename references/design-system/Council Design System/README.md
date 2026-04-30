# Council Design System

A design system for **Council** — a multi-agent paper review workspace.

> The paper review workspace with debate, evidence, and editable reviewer teams.

This system captures Council's visual language: calm neutral canvases, muted academic agent colors, pragmatic indigo accents, and a dual-family typography pairing (system sans for UI, Georgia serif for paper titles and "Moderator Verdict" display text).

---

## Index

| File / Folder | Purpose |
|---|---|
| `README.md` | You are here. Product context, content + visual foundations, iconography. |
| `SKILL.md` | Skill manifest — makes this folder invocable as a Claude Skill. |
| `colors_and_type.css` | CSS custom properties: color tokens, type scale, semantic element styles. |
| `preview/` | Small HTML cards that populate the Design System review tab. |
| `assets/` | Logos, icons, and reusable visual assets. |
| `ui_kits/council/` | High-fidelity React recreation of Council's `/analyze` workspace. |

---

## Product Context

### What Council is

Council is a web app that runs **multi-agent debates over research papers**. A user uploads a PDF or drops an arXiv ID, configures a panel of specialist reviewer agents (Methods Critic, Literature Auditor, Replication Skeptic, Contribution Evaluator, Constructive Advocate, etc.), and watches them argue the paper out — with optional cross-examination, RAG-backed evidence, and a moderator verdict at the end.

### Strategic positioning

> "The paper review workspace with debate, evidence, and editable reviewer teams."

Core differentiators (from `COUNCIL_PRODUCT_PLAN.md`):
- Reviewer **specialization** (editable team members)
- **Disagreement as signal** (divergence detection between agents)
- **Structured synthesis** (not a single-answer chatbot)
- **Evidence-backed critique** (RAG, citations)
- **Pre-submission / revision / rebuttal workflows**

It explicitly does **not** want to compete with ChatPDF on pure chat.

### Surfaces

Council is a single web product, but it has several distinct surfaces:

1. **`/analyze` — the workspace.** PDF/paper preview on the left, review-setup sidebar on the right (mode, rounds, editable agent cards, saved teams). Once started, the right swaps to the live **discussion timeline** (or compare grid) and a sidebar with **cited sources** / **chat with paper**.
2. **`/share/[id]` — read-only shared session.** A calm Georgia-serif page with the moderator verdict, confidence badge, round-by-round turn cards, and a download-markdown button. More "document" than "app."
3. **Home / landing** (implied, not yet in repo).

### Pricing tiers (context for UI labels)

- **Free** — 1 hosted review/month, 5 TLDRs, 30 chat turns.
- **Council Studio** — $19 one-time, workflow unlock + BYOK.
- **Council Hosted** — $15/month, economy inference quota.
- **Council Team** — $49/month, 3 seats, shared templates.

### Sources consulted

- GitHub repo: [`easontype/multi_agent_council`](https://github.com/easontype/multi_agent_council) (main branch)
  - `COUNCIL_PRODUCT_PLAN.md` — strategy, pricing, cost model
  - `src/app/analyze/page.tsx` — main workspace layout, header chrome, session states
  - `src/app/share/[id]/page.tsx` — read-only share page
  - `src/components/council/review-setup-panel.tsx` — mode toggle, agent cards, Team Builder modal, Agent Detail modal
  - `src/components/council/discussion-timeline.tsx` — roster, round dividers, conclusion banner
  - `src/components/council/agent-message.tsx` — streaming messages, evidence chips
  - `src/components/council/compare-view.tsx` — dimension-by-agent grid
  - `src/components/council/source-panel.tsx` — cited sources list
  - `src/components/council/chat-with-paper.tsx` — sidebar chat
  - `src/lib/review-presets.ts` — agent role meta (names, focus labels, avatar letters, accent colors)

---

## Content Fundamentals

Council's copy is **professional, pragmatic, and academic-adjacent**. It sounds like it was written by someone who has actually submitted papers, not by a marketing team.

### Tone & voice

- **Direct and literal.** "Start Review." "Copy Share URL." "Make Private." No cute verbs.
- **Second person when addressing the user** — "Your Debate Team", "Configure the panel before starting the debate."
- **Imperative for actions** — "Ask a question to inspect the paper without rerunning the full debate."
- **No exclamation points.** The closest the product gets to excitement is "Link copied!"
- **No emoji.** Anywhere. Empty/placeholder states use SVG line icons instead.

### Casing

- **Sentence case** for body copy and button labels: "Build Team", "Add Manual Seat", "Make Private", "Open Shared Page".
- **Title Case for product nouns**: Council Studio, Council Hosted, Gap Analysis, Academic Critique, Team Builder, Saved Teams.
- **UPPERCASE + letter-spacing** for microlabels: `REVIEW SETUP`, `PANEL`, `EVIDENCE`, `UNDER REVIEW`, `CITED SOURCES`, `ROUNDS`. Font-weight 700, letter-spacing 0.06–0.08em, color `#a1a1aa`/`#9ca3af`.

### Vibe

- Writes to researchers — "rebuttal stress test", "cross-examination", "pre-submission workflow", "replication skeptic."
- Never hypes the AI. Agents are described by what they do ("Tests whether the paper design, assumptions, and analysis actually support the claims"), not by how smart they are.
- Honest about limits — empty states say *"Sources cited by reviewers will appear here"* rather than promising magic.
- Cost is surfaced honestly: `$0.08 - $0.15` rendered right next to the Start Review button.

### Specific examples

| Context | Copy |
|---|---|
| Start button (default) | `Start Review` |
| Start button (ingesting) | `Preparing paper library...` |
| Empty timeline | `Ready to begin` / `Click Start Review to convene the panel` |
| Empty sources | `Sources cited by reviewers will appear here` |
| Empty chat | `Ask a question to inspect the paper without rerunning the full debate.` |
| Conclusion banner | `Panel discussion concluded` / `All 5 reviewers have submitted their assessments.` |
| Builder intro | `This builder creates a whole debate team, not just one custom seat. You can still edit every generated agent afterward.` |
| Warning (< 2 agents) | `Keep at least two active agents so the debate has meaningful disagreement.` |
| Share page label | `Read-only share` |
| Team empty state | `Save custom reviewer teams locally so you can reuse them on the next paper.` |
| Error | `Review concluded, but no discussion messages were rendered.` |

### Words to use

Panel · Council · Debate · Convene · Reviewer · Seat · Round · Cross-examination · Verdict · Dissent · Consensus · Critique · Gap · Rebuttal · Evidence · Cited · Synthesis · Moderator

### Words to avoid

AI (say "reviewer" or "agent"), magic, instantly, supercharge, revolutionary, unleash. Council sounds like a tool for grown-ups.

---

## Visual Foundations

### Canvas & background

- **Three near-white backgrounds** layer the UI:
  - `#ffffff` — card and content surfaces.
  - `#fafafa` / `#fafaf9` — sidebars, saved-team cards, secondary panels.
  - `#fcfcfb` / `#fbfaf6` — the share page and moderator-verdict surface (a warmer, more paper-like tone).
- **No gradients** as background. No textures, no illustrations behind content. The canvas is calm so the debate content pops.
- **Sticky headers use `backdrop-filter: blur(12–20px)`** on a semi-transparent white (`rgba(255,255,255,0.9–0.96)`) with a 1px bottom border. This is Council's signature chrome pattern.

### Typography

- **Primary UI**: system sans stack — `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif`.
- **Display / paper titles / moderator verdict**: `'Georgia', 'Times New Roman', serif`. This is the academic fingerprint of the brand — it appears only for paper titles, moderator verdict headings, round-divider numerals, and the share page H1.
- **Mono** (for code / tools / system-prompt editing): `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`.
- **Type scale is small and dense.** Body is 12–14px. Display peaks around 30px on the share page. Microlabels go down to 10px. This is deliberate: Council is a workspace, not a landing page.
- **Letter-spacing** is *negative* on display (`-0.015em` to `-0.03em`) and *positive on uppercase microlabels* (`+0.06em` to `+0.12em`).

### Color

Neutrals dominate; color is used sparingly for agents, status, and a single indigo accent.

- **Neutrals (zinc-family)**: `#18181b` → `#27272a` → `#3f3f46` → `#52525b` → `#71717a` → `#9ca3af` → `#a1a1aa` → `#d4d4d8` → `#e4e4e7` → `#ececf1` → `#f0f0f2` → `#f5f5f7` → `#fafafa` → `#ffffff`.
- **Primary CTA**: `#111827` (near-black) with white text. This is the default "Start Review", "Save Agent", "Generate Team", etc.
- **Brand indigo**: `#6366f1` (brand wordmark, Beta chip), with tints `#eef2ff`, `#c7d2fe`, `#3730a3`, `#f8faff`, `#6673bf`. Used for the Council wordmark, Custom badges, and the Team Builder card.
- **Agent palette** (muted, academic, desaturated — used as accent strips, avatars, and 8% tinted backgrounds):
  `#43506b` slate-blue · `#65505f` mauve · `#466671` deep teal · `#496973` teal · `#8a5f3b` warm brown · `#78614a` taupe · `#8b6740` ochre · `#59674b` olive · `#5f7154` moss · `#7a4c54` burgundy · `#6f5c48` walnut · `#5f6672` cool gray.
- **Semantic**: success `#16a34a`/`#15803d`/`#f0fdf4`/`#bbf7d0`; warning `#f59e0b`/`#8b6b35`/`#d97706`; danger `#dc2626`/`#b91c1c`/`#ef4444`/`#fecaca`/`#fef2f2`.
- **Confidence colors (moderator verdict)**: high `#3f6b52`, medium `#8b6b35`, low `#8a4545`.

### Spacing & layout

- **Padding rhythm**: cards use `16px 18px` or `18px 20px`. Compact rows use `10px 20px`. Dense chips use `2px 7–10px`.
- **Gap rhythm**: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24.
- **Max content width**: 760px for the share page. The analyze workspace is full-viewport, split 3:2 or 3:wide-sidebar.

### Corner radii

- Chips & small elements: `4px`, `6px`.
- Buttons & inputs: `8px`, `10px`, `12px`.
- Cards & modals: `12px`, `14px`, `16px`, `20px`.
- Pills / fully-rounded: `999px` — used for saved-team action buttons, agent focus tags, avatar circles, toolbar toggles.
- Never more than one radius family in the same cluster.

### Borders

- Hairline 1px borders in very soft greys: `#f0f0f2`, `#ececf1`, `#ebebed`, `#e4e4e7`, `#f5f5f7`.
- **Left-accent border** only for cited source cards (a `3px solid ${agentColor}` strip) and streaming messages (a `2px solid ${agentColor}` left border that blends into a color-tinted gradient). Not a decorative tic elsewhere.
- **Dashed borders** (`1px dashed #c7c7cf`) for the "Add Manual Seat" button and other empty/add affordances.

### Shadows

Two systems:
- **Hairline elevation** for flat cards: `0 1px 4px rgba(0,0,0,0.04)` or `0 1px 2px rgba(15,23,42,0.05)`.
- **Floating elevation** for modals and primary CTAs:
  - CTA: `0 8px 22px rgba(17,24,39,0.16)`.
  - Modal: `0 24px 60px rgba(15,23,42,0.16)`.
- **Agent-tinted glows** on avatars: `0 8px 18px ${agentColor}2c` — pulls the agent color into its own UI without shouting.
- No inner shadows.

### Hover & press

- **Hover on buttons**: background shifts one step darker (`#fafafa → #f5f5f7`, `transparent → #f5f5f7`), color darkens slightly (`#888 → #333`). 100–200ms `ease`.
- **Hover on cards / source items**: subtle box-shadow appears (`0 2px 8px rgba(0,0,0,0.07)`).
- **Hover on agent chips**: background tint doubles (`${agentColor}07 → ${agentColor}15`), border saturates (`${agentColor}33 → ${agentColor}66`).
- **Press**: no scale/shrink. Color darkens.
- **Active states on toggle-buttons**: filled black pill (`#111827` / `#fff`), inactive is ghost.

### Transparency & blur

- **`backdrop-filter: blur(10–20px)`** is a signature — appears on sticky headers, modal backdrops (`rgba(15,23,42,0.28) + blur(10px)`), and modal inner frames.
- **8%–12% color tints** (`${color}08–${color}15`) are how Council colors agent-tinted surfaces without resorting to heavy fills.

### Animation

- **Short and functional.** Durations 100–200ms, easing usually default `ease`.
- Message entry: `msg-fadein` — `opacity 0 → 1`, `translateY(4px) → 0`, 200ms.
- Streaming cursor: blink every 0.8s.
- Status pulse: opacity 1 → 0.2 → 1, 1.2s, for the "in progress" dot.
- Spinner: 0.8s linear.
- No bounces, no spring easing, no confetti.

### Cards

- **Flat card**: `#fff` background, `1px solid #ebebed`/`#ececf1`, `14–16px` radius, `16–18px` padding, optional `0 1px 4px rgba(0,0,0,0.04)` shadow.
- **Agent card**: adds a `4px` gradient bar across the top (`linear-gradient(90deg, ${agentColor}, ${agentColor}66)`), an avatar circle with glow, two chip rows (Focus + Seat Role), a description panel in `#fbfbfc`, and a footer with edit/toggle buttons.
- **Source card**: `3px` left border in the agent color, tinted background when active, hairline border otherwise.

### Density

Council is a **pro-user dense** UI. Rows are 34–44px tall in the header, avatars are 16–36px. Padding is tight. This is intentional: reviewers comparing five agents need to see them simultaneously.

---

## Iconography

Council's approach to iconography is **minimal, inline, and pragmatic.**

### How icons show up in the codebase

- **Hand-rolled inline SVGs** defined as local React components inside the file that uses them (`BackIcon`, `SpinnerIcon`, `ChevronIcon`, `FileTextIcon`, `ExternalLinkIcon`, `BookOpenIcon`). No icon library is imported.
- **Style**: **outlined**, `stroke-width: 2` (sometimes 1.5 for large ambient icons, 2.5 for emphasized small ones), `stroke-linecap: round`, `stroke-linejoin: round`, `fill: none`. This is the Feather / Lucide visual family.
- **Size**: icons are rendered at 9–36px, almost always in small inline contexts (next to a text label, inside a button, in an empty state).
- **Color**: icons inherit via `stroke="currentColor"` and are muted by default (`#bbb`, `#ccc`, `#aaa`). They *become* the color of the semantic context — status red, success green, agent accent, etc.

### Exact icons present in the codebase

| Usage | Icon | Size |
|---|---|---|
| Back-to-home button | Arrow-left | 15px |
| Loading spinner | ¾ circle, rotating | 13px |
| Chevron expand/collapse | Chevron-right / left | 12–14px |
| Paper under review | Document with folded corner | 13px |
| External link (source cards, evidence chips) | Link-out rectangle with arrow | 9–11px |
| Cited sources section | Open book | 13px |
| Waiting state | Clock (circle + hands) | 36px |
| Empty sources | Magnifying glass | 28px |
| Conclusion banner | Check-circle | 15–16px |

### Emoji

**Never.** No emoji anywhere in the codebase.

### Unicode as icons

Rare but present. Confidence dots (`•`), en/em dashes in copy. Nothing load-bearing.

### PNG / raster icons

None in this repo.

### Logos

Council uses a **wordmark only** — `Council` in the system font, 13–16px, `font-weight: 700`, color `#6366f1` (indigo) in app chrome, `#374151` (near-black) on the share page. No logo mark / icon. The "Beta" chip sits next to it in the analyze header: `uppercase`, 9px, 700 weight, `#eef2ff` bg, `#6366f1` text, `3px` radius.

### What to do when adding a new icon

1. Match the existing Feather/Lucide style — outlined, 2px stroke, round caps/joins, `currentColor`.
2. Size it to match the adjacent text (typically 11–15px inline, 28–36px for empty states).
3. Mute it to `#bbb`/`#ccc`/`#aaa` by default. Let the parent's color take over when semantic.
4. Inline it as a small local component — do not add a dependency.
5. If you must pull from a CDN, use **Lucide** — it matches exactly.

**Substitution note**: If you need a richer icon set, Lucide (`https://unpkg.com/lucide-static`) is the zero-friction match. No icon packs are currently shipped in this repo.

---

## Fonts

Council uses system fonts — **no web fonts are loaded**. Georgia and system sans are assumed to be available on the OS.

- UI: `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif`
- Display: `'Georgia', 'Times New Roman', serif`
- Mono: `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`

**No font files need to be shipped** with this design system. If a consumer wants Inter-proper rather than the system fallback, it can be loaded from Google Fonts. Georgia is assumed universal.

---

## Caveats

- **No logo mark exists.** Council uses a wordmark in the system font; there is no SVG/PNG logo asset in the repo. If the brand evolves to need a mark, it will need to be designed.
- **Home / landing page not in repo** — only `/analyze` and `/share/[id]` surfaces were implemented when I read the code. The UI kit includes only what is actually built.
- **`src/components/council/agent-avatar.tsx`, `thinking-block.tsx`, `tool-card.tsx`, `paper-preview.tsx`** are referenced but not in the imported tree. Their behavior is inferred from usage sites (avatar = a colored circle with initials letter + optional pulse ring).
