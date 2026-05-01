import { runLLM } from "../llm/claude";
import { extractFirstJsonObject } from "../prompts/council-prompts";
import { sanitizeText } from "../utils/text";
import { DEFAULT_GEMMA_MODEL } from "../llm/gemma-models";
import type { CouncilTurn, DivergenceReport } from "./council-types";

const DEFAULT_DIVERGENCE_CLASSIFIER_MODEL = DEFAULT_GEMMA_MODEL;
const DIVERGENCE_CLASSIFIER_MAX_TOKENS = 220;

export async function classifyDivergence(round1Turns: CouncilTurn[]): Promise<DivergenceReport> {
  const formatted = round1Turns.map((t) => `### ${t.role}\n${t.content}`).join("\n\n");
  const prompt = [
    "Read these Round 1 debate positions and classify the level of disagreement.",
    'Return JSON only: { "level": "none|low|moderate|high", "summary": "one sentence", "proceed_to_round2": true|false }',
    "- none: all seats reach the same conclusion (round 2 unnecessary)",
    "- low: different framing, same direction (round 2 optional, skip it)",
    "- moderate: genuine disagreement on key points (round 2 valuable)",
    "- high: fundamental opposition with unresolved contradictions (round 2 essential)",
    "",
    "Round 1 positions:",
    formatted,
  ].join("\n");

  try {
    const raw = await runLLM(
      prompt,
      "You are a strict debate classifier. Output JSON only. No prose, no fences.",
      DEFAULT_DIVERGENCE_CLASSIFIER_MODEL,
      DIVERGENCE_CLASSIFIER_MAX_TOKENS,
    );
    const jsonText = extractFirstJsonObject(raw);
    if (!jsonText) throw new Error("no JSON");
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const level = (["none", "low", "moderate", "high"] as const).includes(
      String(parsed.level) as DivergenceReport["level"],
    )
      ? (String(parsed.level) as DivergenceReport["level"])
      : "moderate";
    return {
      level,
      summary: sanitizeText(parsed.summary) || "Classification complete.",
      proceed_to_round2: level === "moderate" || level === "high",
    };
  } catch {
    return { level: "moderate", summary: "Classification unavailable.", proceed_to_round2: true };
  }
}
