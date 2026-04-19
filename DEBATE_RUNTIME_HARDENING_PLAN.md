# Debate Runtime Hardening Plan

This document is the execution plan for fixing the Council debate runtime.
It is intentionally focused on runtime correctness, bounded output, and
recoverable failure modes rather than prompt tuning.

## Goals

1. Make every seat and moderator output path obey hard output budgets.
2. Separate intermediate tool-loop text from the final persisted answer.
3. Prevent truncated tool calls from silently ending a seat turn.
4. Bound tool payloads before they are fed back into the model.
5. Normalize seat and moderator outputs into stable machine-checked shapes.
6. Keep Round 2 and moderator prompts bounded as debates grow.
7. Expose backend state transitions clearly in the UI.
8. Lock the fixes with targeted tests.

## Why This Order

The current system fails because runtime boundaries are weak:

- output limits are advisory in prompts, not enforced in code
- text-loop runs can store intermediate drafts as final answers
- truncated tool calls can disappear without an explicit error
- large tool payloads can be re-injected into later rounds

If those boundaries are not fixed first, any formatting or UI work will sit on
top of unstable behavior and regress quickly.

## Execution Order

### Phase 0: Runtime Budget Enforcement

Scope:

- `src/lib/council.ts`
- `src/lib/agentic-runtime.ts`
- `src/lib/claude.ts`
- `src/lib/openai.ts`
- `src/lib/gemini.ts`
- `src/lib/ollama.ts`

Changes:

1. Thread `maxTokens` through every provider adapter.
2. Remove hard-coded provider defaults like `8192` where seat/runtime-specific
   budgets should apply.
3. Keep separate defaults for:
   - seat round 1
   - seat round 2
   - moderator synthesis
4. Record the effective output budget used per call when practical.

Why:

- This is the direct fix for uncontrolled seat length and token spikes.
- The current runtime passes budgets from `council.ts` but most provider paths
  ignore them.

Acceptance criteria:

- seat round 1 and round 2 budgets are honored across the shared runtime,
  including Gemma-first defaults and API provider paths
- no seat path can silently expand to provider-level `8192` output tokens unless
  explicitly intended

Status: completed (initial pass)

Implementation notes:

- `maxTokens` now flows through the shared runtime into the native request
  parameters used by Gemma-hosted, OpenAI-compatible, and Ollama-backed paths.
- text-loop calls now pass runtime budgets into the shared `streamLLM` wrapper.
- moderator synthesis and divergence classification now use explicit budgets.
- Anthropic API, OpenAI-compatible API, Gemini API, and Ollama paths now all
  consume runtime-provided output budgets instead of falling back to provider
  defaults.

Residual risk:

- API-level budget enforcement still depends on provider support, so effective
  output caps should continue to be verified provider by provider as adapters
  evolve.

### Phase 1: Final-Answer Boundary

Scope:

- `src/lib/agentic-runtime.ts`
- `src/lib/council.ts`

Changes:

1. Stop appending every visible pre-tool draft into the final turn text.
2. Persist only the last finalized answer from the loop.
3. Keep intermediate text for streaming UI only.
4. If a loop ends after tool usage without a valid final answer, emit an
   explicit runtime failure instead of storing a partial draft.

Why:

- This is the direct fix for repeated sections, unstable formatting, and turns
  that include both "I will check" and the final answer.

Acceptance criteria:

- each persisted seat turn contains one final answer only
- no intermediate analysis text is stored as if it were final output

Status: completed (initial pass)

Implementation notes:

- `runAgenticRuntime` now streams intermediate drafts to the UI but only
  persists the last non-tool round as the final seat answer.
- Once a seat has consumed tool results, the runtime enters an
  `awaitingFinalAnswer` state and requires a clean follow-up answer before the
  turn can complete successfully.
- Tool loops that hit the round/tool budget without a final answer now raise an
  explicit runtime error instead of returning a partial draft.

### Phase 2: Truncated Tool Call Recovery

Scope:

- `src/lib/tools/parser.ts`
- `src/lib/agentic-runtime.ts`

Changes:

1. Detect incomplete `[TOOL_CALL]` blocks explicitly.
2. Distinguish:
   - no tool requested
   - malformed tool request
   - truncated tool request
3. Retry or fail loudly when a tool request is truncated.
4. Emit structured runtime errors to the SSE stream when repair fails.

Why:

- Silent failure here makes a broken seat look successful.

Acceptance criteria:

- incomplete tool call output never gets treated as a clean final answer
- malformed tool-request paths are visible and diagnosable

Status: completed (initial pass)

Implementation notes:

- `parseToolCalls` now returns explicit parse states for complete, malformed,
  truncated, and no-tool outputs.
- Text-loop runtime performs one repair turn when a `[TOOL_CALL]` block is cut
  off or invalid.
- If repair fails, the runtime throws a specific error instead of silently
  treating the response as a successful no-tool answer.

### Phase 3: Tool Payload Bounding

Scope:

- `src/lib/tool-compressor.ts`
- `src/lib/tools/handlers/rag.ts`
- `src/lib/tools/handlers/web.ts`
- `src/lib/agentic-runtime.ts`
- `src/lib/council-db.ts`

Changes:

1. Bound tool payloads by size and content type, not just tool name.
2. Make `rag_query` return a compact model-facing shape with strict limits.
3. Separate:
   - raw tool output for audit/export
   - model-fed compressed output
   - UI preview output
4. Apply compression to any oversized payload regardless of tool name.

Why:

- The current compressor targets the wrong main risk.
- `rag_query` is often the actual large payload in academic debates.

Acceptance criteria:

- model-facing tool payloads have a clear upper bound
- DB storage, UI preview, and model replay no longer share the same raw field

Status: completed (initial pass)

Implementation notes:

- `rag_query` and `semantic_search` now emit compact evidence blocks instead of
  replaying large raw chunks.
- Tool compression now triggers on oversized payloads by size, not only on a
  fixed tool allowlist.
- The compressor fallback hard-cap has been reduced substantially so oversized
  tool results cannot flow back into later seat prompts unchanged.
- Full raw/model/UI payload separation is still pending; this pass focuses on
  stopping prompt bloat in the live runtime.

### Phase 4: Seat Output Normalization

Scope:

- `src/lib/council-prompts.ts`
- `src/lib/council.ts`
- new helper file if needed under `src/lib/`

Changes:

1. Parse and normalize Round 1 output into a fixed shape:
   - position
   - key assumptions
   - main risks
   - strongest counterargument
   - evidence
2. Parse and normalize Round 2 output into:
   - challenge
   - stance
   - evidence
3. Apply one formatting pass when the answer is structurally close but invalid.
4. Hard-cap words/characters after normalization.

Why:

- Prompt instructions alone do not produce stable structure.
- Round 2 and moderator quality depend on stable seat outputs.

Acceptance criteria:

- persisted seat turns have consistent structure
- output length is bounded even when the model ignores prompt wording

Status: completed (initial pass)

Implementation notes:

- Seat turns now pass through a deterministic normalizer before persistence.
- Round 1 and Round 2 use different canonical section sets and separate word
  caps.
- Missing or weakly labeled sections are filled from fallback paragraphs and
  then reformatted into stable headings and bullet lists.

### Phase 5: Moderator Output Consistency

Scope:

- `src/lib/council.ts`
- `src/hooks/use-council-review.ts`

Changes:

1. Stop streaming raw unvalidated moderator text as the canonical UI message.
2. Stream progress separately from final validated conclusion.
3. Ensure final moderator transcript, stored conclusion, and UI state are the
   same payload.
4. Make fallback JSON formatting deterministic and visible in logs.

Why:

- The UI can currently show a different moderator result from what is stored.

Acceptance criteria:

- moderator UI, DB conclusion, and export all match

Status: completed (initial pass)

Implementation notes:

- Moderator synthesis is still generated via streaming internally, but raw
  unvalidated text is no longer pushed to the UI incrementally.
- The server now emits the validated final moderator payload only after any
  formatter retry has finished, so UI transcript and stored moderator turn stay
  aligned.
- Separate progress events are still pending if live moderator typing is needed
  later.

### Phase 6: Prompt Context Bounding

Scope:

- `src/lib/council-prompts.ts`
- `src/lib/council.ts`
- new summarizer helpers if needed

Changes:

1. Replace full raw-turn replay in Round 2 with bounded structured summaries.
2. Replace full raw-turn replay in moderator synthesis with compact per-seat
   summaries plus selected evidence references.
3. Cap total prompt assembly size with deterministic trimming rules.

Why:

- Even perfect seat formatting will still grow linearly without a summary layer.

Acceptance criteria:

- Round 2 and moderator prompts have predictable maximum size

Status: completed (initial pass)

Implementation notes:

- Main runtime now uses bounded prompt builders for Round 2 and moderator
  synthesis instead of replaying full stored turn text.
- Per-turn summaries are derived deterministically from normalized seat output
  and then assembled under fixed character budgets.
- Older unbounded prompt helpers remain in place for compatibility, but the
  live debate path now goes through the bounded variants.

### Phase 7: UI State Coverage

Scope:

- `src/hooks/use-council-review.ts`
- `src/types/council.ts`
- relevant UI components under `src/components/council/`

Changes:

1. Handle backend events currently ignored by the client:
   - `round_start`
   - `divergence_check`
   - `round2_skipped`
   - `high_divergence_warning`
   - `session_done`
2. Surface skipped rounds and high-divergence warnings in the UI.
3. Keep the session model aligned with backend execution state.

Why:

- Without state visibility, runtime failures and path changes are easy to miss.

Acceptance criteria:

- all emitted debate events are either rendered or explicitly recorded in state

Status: completed (initial pass)

Implementation notes:

- The client now handles `round_start`, `divergence_check`, `round2_skipped`,
  `high_divergence_warning`, and `session_done`.
- Review session state keeps lightweight alert metadata so skipped rounds and
  high-divergence states are visible in the main timeline.
- This is intentionally a minimal presentation layer; richer state-specific UI
  treatments can still be added later.

### Phase 8: Test Coverage

Scope:

- `tests/`
- new unit tests under the appropriate source-adjacent test location if needed

Changes:

1. Add runtime tests for provider budget enforcement.
2. Add tests ensuring only final answer text is persisted.
3. Add tests for malformed and truncated tool call handling.
4. Add tests for seat output normalization.
5. Add tests for moderator final-payload consistency.

Why:

- Current UI-mocked tests do not protect the actual runtime failure modes.

Acceptance criteria:

- each regression above has a direct automated test

Status: completed (initial pass)

Implementation notes:

- Added focused runtime regression coverage for tool-call parsing states, seat
  output normalization, and bounded prompt assembly.
- These tests run without a browser flow and directly lock the new parser,
  normalizer, and prompt-bounding helpers.
- Provider-specific budget assertions and full SSE/runtime integration coverage
  are still good follow-up work, but the main regression-prone logic added in
  this pass is now exercised.

## Working Rules

1. Only one phase is in progress at a time.
2. Do not start prompt tuning until Phase 0 through Phase 3 are complete.
3. Prefer explicit runtime errors over silent fallback when correctness is at risk.
4. Keep audit storage separate from model-facing replay data.
5. After each phase:
   - update this document
   - run the most relevant tests
   - note residual risk before continuing

## Current Status

Completed in the live debate path:

- Phase 0 through Phase 8 all have an initial implementation in place.
- Council runtime is now API-only; Codex CLI and Claude CLI paths have been
  removed from the active execution path.
- Seat turns are normalized, tool calls are repaired or failed explicitly, tool
  payloads are bounded, and Round 2 / moderator prompts now use bounded
  summaries instead of replaying full raw turns.
- UI state now records skipped rounds and divergence warnings.
- Focused runtime regression tests now cover parser states, seat normalization,
  and bounded prompt assembly.

## Remaining Work

The following items are still worth doing even though the first pass is
complete:

1. Finish true payload separation.
   - The current runtime bounds model-facing payloads, but DB audit storage,
     model replay payloads, and UI preview payloads are still not fully split
     into separate fields.
   - This mainly affects long-term traceability and export fidelity, not the
     immediate debate runtime behavior.

2. Expand automated coverage around real runtime flows.
   - Missing coverage still includes:
     - provider-specific budget assertions
     - persistence assertions that only final answer text is saved
     - moderator retry path consistency
     - SSE integration around error/repair flows

3. Decide whether bounded prompt builders should fully replace legacy prompt
   builders.
   - The live path already uses bounded variants.
   - Older unbounded helpers remain in the repo for compatibility and should
     either be deleted or clearly marked legacy.

4. Decide whether moderator should regain a separate progress event.
   - Current behavior favors correctness: UI only receives the validated final
     moderator payload.
   - If live “typing” UX is still desired, it should return as a non-canonical
     progress stream, not as the saved final transcript.

5. Clean up remaining compatibility-only schema/storage artifacts.
   - `runtime_class` is now effectively fixed to `strict_runtime`.
   - It can stay for backward compatibility, or be removed later with a proper
     migration and export update.

## Discussion Items

These are the main questions that still need product or engineering judgment:

1. Audit model:
   - Do you want full raw tool outputs retained for audit/export, or should the
     system only keep compressed/model-facing results by default?

2. Moderator UX:
   - Is transcript correctness more important than live streaming appearance?
     The current implementation picks correctness.

3. Legacy helper cleanup:
   - Should legacy prompt helpers and compatibility fields be deleted now, or
     left in place until the next refactor window?

4. Test strategy:
   - Do you want more source-adjacent runtime tests, or broader end-to-end SSE
     tests that simulate full council runs?

## Recommended Next Step

If the goal is stability first, do the next pass in this order:

1. Add deeper runtime/integration tests around final-answer persistence,
   moderator retry consistency, and tool-repair failure paths.
2. Split audit/raw/model/UI payload storage if you still need high-fidelity
   export and replay.
3. Remove legacy unbounded prompt helpers and compatibility-only fields once
   the above is covered by tests.
