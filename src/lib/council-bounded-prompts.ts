import type { CouncilSession, CouncilTurn } from "./council-types";
import { buildDebateBrief } from "./council-prompts";
import { buildBoundedModeratorTranscript, buildBoundedRound2Context } from "./council-turn-summary";

export function buildBoundedRound2Prompt(
  session: Pick<CouncilSession, "topic" | "context" | "goal">,
  round1Turns: CouncilTurn[],
  round2TurnsSoFar: CouncilTurn[] = [],
): string {
  return [
    buildDebateBrief(session),
    "",
    ...buildBoundedRound2Context(round1Turns, round2TurnsSoFar),
    "",
    "Now make your Round 2 argument. You may use tools to verify disputed claims. Keep your final written response under 220 words.",
    "Structure your response with exactly two sections:",
    "**Challenge** - Name the seat(s) and the specific claim you are contesting. State concisely why their evidence or logic is insufficient (2-3 sentences max).",
    "**Stance** - One sentence: state whether your Round 1 position has changed. If yes, cite the specific evidence that moved you. If no, state what it would take to move you.",
    "Update your position only if the evidence requires it. Do not capitulate to social pressure.",
    "When claims conflict, use tools to verify the disputed points.",
    "If you used tools, end with an **Evidence** section (title + URL only, no raw output).",
    "NEVER reproduce raw tool output, JSON, or paper lists verbatim.",
  ].join("\n");
}

export function buildBoundedModeratorPrompt(
  session: Pick<CouncilSession, "topic" | "context" | "goal">,
  allTurns: CouncilTurn[],
  evidenceCounts: Record<string, number> = {},
): string {
  return [
    buildDebateBrief(session),
    "",
    buildBoundedModeratorTranscript(allTurns, evidenceCounts),
    "",
    "Return the final JSON conclusion.",
  ].join("\n");
}
