# Council Product Plan

Updated: 2026-04-18

## Goal

Council already has a real product core:

- multi-agent debate
- optional round-2 cross-examination
- divergence detection
- multi-model support
- PDF upload + arXiv/DOI search
- RAG-backed evidence gathering

The immediate gap is not differentiation. The gap is first-session utility and monetization structure.

Council should position itself as:

> The paper review workspace with debate, evidence, and editable reviewer teams.

## Product Direction

### Core thesis

Council should keep its strongest moat:

- reviewer specialization
- disagreement as signal
- structured synthesis instead of a single-answer chatbot

But it needs stronger entry features so users do not churn after the first run:

- Chat with Paper
- Export
- Share
- saved reviewer teams
- transparent cost/usage controls

### Strategic rule

Do not compete with ChatPDF only on chat.

Compete on:

- debate
- reviewer configuration
- pre-submission workflow
- revision workflow
- evidence-backed critique

## Recommended Feature Backlog

## P0

These are the highest-value near-term features.

### 1. Chat with Paper

Why:

- users often want one-off questions before paying the cost of a full debate
- strong onboarding feature
- matches user expectations from ChatPDF / SciSpace

Scope:

- per-session chat tab after ingest
- uses same RAG library as debate
- answer with citations to paper chunks

### 2. Export Markdown / PDF

Why:

- review output becomes portable and useful
- reduces perceived product fragility

Scope:

- export moderator summary
- export all reviewer turns
- export cited sources / evidence
- Markdown first, PDF second

### 3. Share Session

Why:

- labs, advisors, and coauthors need read-only sharing

Scope:

- private by default
- public toggle per session
- read-only share page
- revocable links

### 4. Saved Team Templates

Why:

- directly leverages Council’s unique editable reviewer system
- increases retention

Scope:

- save current team as template
- load template into analyze setup
- allow rename / duplicate / delete

### 5. Cost Preview Before Run

Why:

- critical if hosted + BYOK coexist
- reduces pricing anxiety

Scope:

- show estimated cost band before starting
- show whether request uses hosted quota or user API keys

## P1

### 6. Quick TLDR Mode

Why:

- full debate is too slow for lightweight browsing

Scope:

- 20-30 second summary mode
- 1 model
- no multi-agent loop
- still grounded in paper chunks

### 7. Revision Diff Review

Why:

- more defensible than generic chat
- directly useful in real paper-writing workflow

Scope:

- upload v1 and v2
- identify fixed issues, unresolved issues, regressions

### 8. Rebuttal Simulator

Why:

- fits submission workflow
- highly differentiated

Scope:

- author writes rebuttal
- selected reviewer agents respond as skeptical reviewers

### 9. Multi-paper Comparison

Why:

- useful for literature triage and advisor workflows

Scope:

- compare 2-3 papers
- novelty, evidence, methods, likely acceptance strength

## P2

### 10. Batch Literature Review

Input research question -> search -> synthesize multiple papers into structured review.

### 11. Citation Context Analysis

Support / contradict / mention classification, surfaced visually.

### 12. Citation Graph / Discovery Map

Graph view for related work and influence paths.

### 13. Alerts / New Paper Monitoring

Saved search with email or digest notifications.

### 14. Browser Extension

Trigger Council review directly from arXiv / Scholar.

## Suggested Build Order

### This week

1. Export Markdown
2. Share link
3. Chat with Paper
4. Saved team templates
5. Cost preview

### Next month

1. Quick TLDR mode
2. Revision diff review
3. Rebuttal simulator
4. Multi-paper comparison

### Later

1. Batch literature review
2. Citation graph
3. Alerts
4. Extension

## Monetization Strategy

## Main recommendation

Council should not sell unlimited hosted multi-agent review as a one-time purchase.

That is too risky because:

- multi-agent review has real variable inference cost
- round 2 increases cost unpredictably
- premium models like Claude Sonnet / Opus can erase margin fast

Instead use a hybrid model:

- one-time unlock for workflow features
- hosted subscription for convenience
- BYOK for power users and expensive models

## Pricing Model

### Free

Purpose:

- let users feel the product’s value
- avoid high hosted inference cost

Recommended limits:

- 1 hosted full review per month
- 5 Quick TLDR runs per month
- 30 Chat with Paper turns per month
- 1 saved team template
- Markdown export with watermark
- share links expire after 7 days

### Council Studio

Price:

- $19 one-time

Purpose:

- sell software capability, not unlimited model spend

Includes:

- custom reviewer team editing
- system prompt editing
- saved team templates
- export
- sharing
- BYOK support for OpenAI / Anthropic / Google
- a few hosted trial runs

Recommended bundled hosted usage:

- 5 hosted economy full reviews

Important rule:

- after bundled hosted quota is consumed, Studio users should primarily use BYOK

### Council Hosted

Price:

- $15/month

Purpose:

- convenience plan for people who do not want to manage API keys

Recommended limits:

- 40 economy full reviews per month
- 100 Quick TLDR runs per month
- 300 chat turns per month
- 10 saved team templates
- full export and sharing

### Council Team

Price:

- $49/month

Purpose:

- small research groups
- advisors + students

Recommended limits:

- 150 economy full reviews per month
- shared team templates
- shared libraries / shared sessions
- 3 seats included

### Premium Quality Usage

Recommendation:

- do not include premium hosted model usage generously in flat subscriptions
- route premium quality through BYOK or extra credit packs

Examples:

- Claude Sonnet-heavy review
- Opus moderator
- very long-context reviews

## Cost Model

These are operational planning estimates, not billing-grade exact numbers.

## Assumptions

Typical full review session:

- one paper after ingest: about 10k tokens of useful review context
- 5 reviewer agents
- about 40% of sessions go to round 2
- average effective reviewer turns per session: about 7
- average reviewer turn: about 12k input + 1k output
- moderator turn: about 40k input + 1.5k output
- embeddings done once at ingest

## Estimated variable cost per action

### Quick TLDR

- economy: about $0.006 to $0.015
- standard: about $0.05 to $0.08

### Chat with Paper, per turn

- economy: about $0.002 to $0.005
- standard: about $0.015 to $0.03

### Full Council Review

- economy: about $0.08 to $0.15
- standard: about $0.55 to $0.75
- premium: about $1.10 to $1.40

## Model tier interpretation

### Economy

Use for hosted default:

- GPT-5 mini or Gemini Flash-tier models
- cheap embeddings
- local model optional for lightweight parsing / helper steps

### Standard

Use when quality matters and margin still acceptable:

- Claude Sonnet 4 class

### Premium

Use sparingly:

- Sonnet seats plus Opus moderator
- or similar high-cost stack

## Why hosted flat pricing is dangerous

If a user pays only one time and repeatedly runs premium hosted reviews:

- revenue is capped
- inference cost is uncapped

That is structurally bad.

Studio should therefore be:

- workflow unlock
- BYOK-first

Hosted should therefore be:

- subscription
- economy-stack-first

## Infrastructure Cost Assumptions

For a small production setup, rough monthly fixed cost may look like:

- Vercel Pro: about $20/month
- Supabase Pro: about $25/month
- domain / email / monitoring / misc: about $15-$35/month

Estimated total fixed cost:

- about $60-$80/month

This excludes heavy overages and enterprise add-ons.

## Example Unit Economics

Example hosted subscriber:

- 20 economy full reviews per month
- 100 chat turns per month
- 20 TLDR runs per month

Estimated monthly variable cost:

- reviews: 20 x $0.10 = $2.00
- chat: 100 x $0.003 = $0.30
- TLDR: 20 x $0.01 = $0.20

Total:

- about $2.50 per active hosted user per month

If Council Hosted is priced at $15/month:

- gross margin remains healthy on economy stack

If the same usage is served with standard Sonnet-heavy review:

- review cost alone can approach about $12 per user per month

That makes a $15 flat plan too tight.

Conclusion:

- hosted default should use economy stack
- premium quality should be BYOK or paid add-on

## Packaging Rules

### Free tier should optimize for conversion

Do not over-give full hosted debate.

### Studio should optimize for power users

Sell:

- custom teams
- prompts
- exports
- sharing
- BYOK

### Hosted should optimize for convenience

Sell:

- no API key setup
- predictable monthly allowance
- acceptable but not extravagant quality

### Premium should optimize for margin protection

Sell:

- credits
- BYOK
- explicit per-run cost transparency

## Recommended Feature-to-Plan Mapping

### Free

- 1 hosted full review per month
- Quick TLDR
- limited chat
- no serious team library

### Studio

- editable agents
- custom prompts
- saved team templates
- export
- share
- BYOK

### Hosted

- all Studio workflow features
- hosted economy inference quota

### Team

- collaboration
- shared templates
- shared sessions
- hosted quota pool

## Immediate Execution Plan

### Product

1. Build Export Markdown
2. Build Share link
3. Build Chat with Paper
4. Build saved team templates
5. Add pre-run cost preview

### Business

1. Keep Free tier small but useful
2. Reframe $19 as Studio unlock, not unlimited inference
3. Launch Hosted subscription with economy defaults
4. Put premium quality behind BYOK or credits

### UX

1. Surface quality mode clearly
2. Surface whether run uses hosted quota or user API keys
3. Surface estimated cost before run
4. Surface evidence and exportability after run

## Sources

Pricing and infrastructure references checked on 2026-04-18:

- OpenAI API pricing: https://platform.openai.com/docs/pricing
- OpenAI API pricing overview: https://openai.com/api/pricing/
- OpenAI embeddings pricing: https://platform.openai.com/docs/pricing
- Anthropic Claude pricing: https://docs.anthropic.com/en/docs/about-claude/pricing
- Google Vertex AI Gemini pricing: https://cloud.google.com/vertex-ai/generative-ai/pricing
- Vercel pricing: https://vercel.com/pricing
- Vercel Pro plan: https://vercel.com/docs/plans/pro
- Supabase billing overview: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
- Supabase compute usage examples: https://supabase.com/docs/guides/platform/manage-your-usage/compute

