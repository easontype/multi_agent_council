import { expect, test } from "@playwright/test";
import { parseToolCalls } from "../src/lib/tools/parser";
import { normalizeSeatTurnContent } from "../src/lib/council-turn-normalizer";
import { buildBoundedModeratorPrompt, buildBoundedRound2Prompt } from "../src/lib/council-bounded-prompts";
import type { CouncilTurn } from "../src/lib/council-types";

test("parseToolCalls distinguishes complete malformed and truncated blocks", async () => {
  expect(parseToolCalls('[TOOL_CALL]{"tool":"rag_query","args":{"question":"x"}}[/TOOL_CALL]')).toEqual({
    status: "complete",
    calls: [{ tool: "rag_query", args: { question: "x" } }],
  });

  expect(parseToolCalls('[TOOL_CALL]{"tool":"rag_query"[/TOOL_CALL]')).toEqual({
    status: "malformed",
    calls: [],
  });

  expect(parseToolCalls('[TOOL_CALL]{"tool":"rag_query","args":{"question":"x"}}')).toEqual({
    status: "truncated",
    calls: [],
  });
});

test("normalizeSeatTurnContent enforces canonical round structure", async () => {
  const raw = [
    "Position",
    "This paper is promising but the claims outrun the evidence.",
    "",
    "Risks",
    "- Missing ablations on data quality.",
    "- Evaluation coverage is too thin.",
    "",
    "Evidence",
    "- Transformer Paper | https://arxiv.org/abs/1706.03762",
  ].join("\n");

  const normalized = normalizeSeatTurnContent(raw, 1);
  expect(normalized).toContain("**Position**");
  expect(normalized).toContain("**Key Assumptions**");
  expect(normalized).toContain("**Main Risks**");
  expect(normalized).toContain("**Strongest Counterargument**");
  expect(normalized).toContain("**Evidence**");
  expect(normalized.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(400);
});

function makeTurn(role: string, round: number, content: string): CouncilTurn {
  return {
    id: `${role}-${round}`,
    session_id: "session-1",
    round,
    role,
    model: "gemma-4-31b-it",
    content,
    input_tokens: 0,
    output_tokens: 0,
    created_at: new Date().toISOString(),
  };
}

test("bounded prompts stay compact even with oversized stored turns", async () => {
  const hugeEvidence = Array.from({ length: 40 }, (_, index) => `- Source ${index + 1} | https://example.com/${index + 1} | repeated context repeated context repeated context repeated context`).join("\n");
  const round1Content = normalizeSeatTurnContent([
    "**Position**",
    "The paper is directionally useful but underspecified in critical places.",
    "",
    "**Key Assumptions**",
    "- The benchmark is representative.",
    "- The reported gain survives different seeds.",
    "",
    "**Main Risks**",
    "- Missing ablations.",
    "- Weak error analysis.",
    "",
    "**Strongest Counterargument**",
    "The claimed gain could still be meaningful if the missing checks are small.",
    "",
    "**Evidence**",
    hugeEvidence,
  ].join("\n"), 1);

  const round2Content = normalizeSeatTurnContent([
    "**Challenge**",
    "Methods Critic overstates how much the benchmark gap changes the overall conclusion.",
    "",
    "**Stance**",
    "My Round 1 position is unchanged until a cross-dataset check appears.",
    "",
    "**Evidence**",
    hugeEvidence,
  ].join("\n"), 2);

  const round1Turns = [
    makeTurn("Methods Critic", 1, round1Content),
    makeTurn("Literature Auditor", 1, round1Content),
    makeTurn("Replication Skeptic", 1, round1Content),
  ];
  const round2Turns = [
    makeTurn("Methods Critic", 2, round2Content),
    makeTurn("Literature Auditor", 2, round2Content),
  ];

  const round2Prompt = buildBoundedRound2Prompt(
    { topic: "Test topic", context: "Test context", goal: "Reach a decision" },
    round1Turns,
    round2Turns,
  );
  const moderatorPrompt = buildBoundedModeratorPrompt(
    { topic: "Test topic", context: "Test context", goal: "Reach a decision" },
    [...round1Turns, ...round2Turns],
    { "Methods Critic": 3, "Literature Auditor": 2, "Replication Skeptic": 1 },
  );

  expect(round2Prompt.length).toBeLessThan(9_500);
  expect(moderatorPrompt.length).toBeLessThan(10_500);
  expect(round2Prompt).not.toContain("repeated context repeated context repeated context repeated context repeated context repeated context");
  expect(moderatorPrompt).toContain("[cited URLs: 3]");
});
