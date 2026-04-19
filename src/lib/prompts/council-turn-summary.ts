import type { CouncilTurn } from "../core/council-types";

const ROUND2_ROUND1_SECTION_BUDGET = 4_500;
const ROUND2_ROUND2_SECTION_BUDGET = 2_200;
const MODERATOR_SECTION_BUDGET = 8_000;

function clampWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const regex = /\*\*([^*]+)\*\*\n([\s\S]*?)(?=\n\*\*[^*]+\*\*\n|$)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    sections[match[1].trim().toLowerCase()] = match[2].trim();
  }

  return sections;
}

function flattenBullets(text: string, maxItems: number, maxWordsPerItem: number): string {
  const items = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => clampWords(item, maxWordsPerItem));

  return items.length ? items.join("; ") : "none";
}

function boundSectionBlock(
  title: string,
  sections: string[],
  maxChars: number,
): string {
  const accepted: string[] = [];
  let used = 0;
  let omitted = 0;

  for (const section of sections) {
    const nextLength = (accepted.length ? 2 : 0) + section.length;
    if (accepted.length > 0 && used + nextLength > maxChars) {
      omitted += 1;
      continue;
    }
    if (accepted.length === 0 && section.length > maxChars) {
      accepted.push(section.slice(0, maxChars));
      used = accepted[0].length;
      continue;
    }
    accepted.push(section);
    used += nextLength;
  }

  if (omitted > 0) {
    accepted.push(`... ${omitted} additional item(s) omitted to stay within context budget.`);
  }

  return [title, ...accepted].join("\n\n");
}

function summarizeRound1Turn(turn: CouncilTurn): string {
  const sections = parseSections(turn.content);
  return [
    `### ${turn.role}`,
    `- position: ${clampWords(sections["position"] || "not clearly stated", 40)}`,
    `- assumptions: ${flattenBullets(sections["key assumptions"] || "", 3, 12)}`,
    `- risks: ${flattenBullets(sections["main risks"] || "", 2, 16)}`,
    `- counterargument: ${clampWords(sections["strongest counterargument"] || "not clearly stated", 32)}`,
    `- evidence: ${flattenBullets(sections["evidence"] || "", 4, 12)}`,
  ].join("\n");
}

function summarizeRound2Turn(turn: CouncilTurn): string {
  const sections = parseSections(turn.content);
  return [
    `### ${turn.role}`,
    `- challenge: ${clampWords(sections["challenge"] || "not clearly stated", 48)}`,
    `- stance: ${clampWords(sections["stance"] || "not clearly stated", 24)}`,
    `- evidence: ${flattenBullets(sections["evidence"] || "", 4, 12)}`,
  ].join("\n");
}

function summarizeTurnForModerator(turn: CouncilTurn, evidenceCount: number): string {
  const summary = turn.round === 1 ? summarizeRound1Turn(turn) : summarizeRound2Turn(turn);
  return `### [Round ${turn.round}] ${turn.role} [cited URLs: ${evidenceCount}]\n${summary
    .replace(/^### .+\n/, "")
    .trim()}`;
}

export function buildBoundedRound2Context(
  round1Turns: CouncilTurn[],
  round2TurnsSoFar: CouncilTurn[],
): string[] {
  const round1Summaries = round1Turns.map(summarizeRound1Turn);
  const parts = [
    boundSectionBlock("Round 1 summaries:", round1Summaries, ROUND2_ROUND1_SECTION_BUDGET),
  ];

  if (round2TurnsSoFar.length > 0) {
    const round2Summaries = round2TurnsSoFar.map((turn) => summarizeRound2Turn(turn));
    parts.push(boundSectionBlock("Round 2 arguments already made by other seats:", round2Summaries, ROUND2_ROUND2_SECTION_BUDGET));
  }

  return parts;
}

export function buildBoundedModeratorTranscript(
  allTurns: CouncilTurn[],
  evidenceCounts: Record<string, number>,
): string {
  const summaries = allTurns.map((turn) => summarizeTurnForModerator(turn, evidenceCounts[turn.role] ?? 0));
  return boundSectionBlock("Debate summaries:", summaries, MODERATOR_SECTION_BUDGET);
}
