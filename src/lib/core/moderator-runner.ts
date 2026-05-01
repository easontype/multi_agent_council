import { runLLM, streamLLM } from "../llm/claude";
import { db } from "../db/db";
import { saveTurn, saveConclusion } from "../db/council-db";
import {
  buildBoundedModeratorPrompt,
  buildModeratorSystemPrompt,
  extractFirstJsonObject,
  normalizeConclusion,
} from "../prompts/council-prompts";
import { MODERATOR_ROUND } from "./council-types";
import type { OllamaMessage } from "../llm/ollama";
import type { CouncilSession, CouncilTurn, CouncilConclusion, CouncilEventHandler } from "./council-types";

const MODERATOR_MAX_TOKENS = 1_200;
const MODERATOR_JSON_RETRY_MAX_TOKENS = 900;

export async function runModeratorTurn(
  session: CouncilSession,
  allTurns: CouncilTurn[],
  onEvent: CouncilEventHandler,
  touchHeartbeat: () => Promise<void>,
  preferredLanguage?: string,
): Promise<CouncilConclusion> {
  onEvent({ type: "moderator_start" });

  // Count distinct real URLs cited per role — quality signal for evidence weighting.
  const evidenceCounts: Record<string, number> = {};
  try {
    const { rows } = await db.query(
      `SELECT ce.role, COUNT(DISTINCT sr->>'uri') AS cited_uris
       FROM council_evidence ce,
            LATERAL jsonb_array_elements(ce.source_refs) AS sr
       WHERE ce.session_id = $1
         AND ce.status = 'completed'
         AND sr->>'uri' IS NOT NULL
         AND sr->>'uri' <> ''
       GROUP BY ce.role`,
      [session.id],
    );
    for (const row of rows as Array<{ role: string; cited_uris: string }>) {
      evidenceCounts[row.role] = Number(row.cited_uris);
    }
  } catch {
    // Non-fatal — proceed without evidence counts
  }

  const moderatorSystemPrompt = buildModeratorSystemPrompt(preferredLanguage);
  const prompt = buildBoundedModeratorPrompt(session, allTurns, evidenceCounts);
  const messages: OllamaMessage[] = [
    { role: "system", content: moderatorSystemPrompt },
    { role: "user", content: prompt },
  ];

  let raw = "";
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const delta of streamLLM(
    prompt,
    moderatorSystemPrompt,
    session.moderator_model,
    messages,
    (usage) => {
      inputTokens = usage.inputTokens;
      outputTokens = usage.outputTokens;
    },
    MODERATOR_MAX_TOKENS,
  )) {
    raw += delta;
    await touchHeartbeat();
  }

  // If the first pass produced no valid JSON, do one non-streaming retry with a stricter prompt.
  let finalRaw = raw;
  if (!extractFirstJsonObject(raw)) {
    try {
      const retryPrompt = [
        "The following is a debate synthesis that was not formatted as JSON. Convert it to the required JSON shape.",
        "Output ONLY the JSON object, no prose, no markdown fences.",
        "",
        "Required shape:",
        '{ "summary": "...", "consensus": "...", "dissent": [{"question": "...", "seats": {"RoleName": "position"}}], "action_items": [{"action": "...", "priority": "blocking|recommended|optional"}], "veto": "...", "confidence": "high|medium|low", "confidence_reason": "..." }',
        "",
        "Text to convert:",
        raw.trim(),
      ].join("\n");
      const retried = await runLLM(
        retryPrompt,
        "You are a strict JSON formatter. Output JSON only.",
        session.moderator_model,
        MODERATOR_JSON_RETRY_MAX_TOKENS,
      );
      if (extractFirstJsonObject(retried)) finalRaw = retried;
    } catch {
      // Non-fatal — use original raw as fallback
    }
  }

  await saveTurn({
    session_id: session.id,
    round: MODERATOR_ROUND,
    role: "Moderator",
    model: session.moderator_model,
    content: finalRaw.trim(),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });

  if (finalRaw.trim()) {
    onEvent({ type: "moderator_delta", delta: finalRaw.trim() });
  }

  const parsed = normalizeConclusion(finalRaw);
  const conclusion = await saveConclusion({
    session_id: session.id,
    summary: parsed.summary,
    consensus: parsed.consensus,
    dissent: parsed.dissent,
    action_items: parsed.action_items,
    veto: parsed.veto,
    confidence: parsed.confidence,
    confidence_reason: parsed.confidence_reason,
  });

  await touchHeartbeat();
  onEvent({ type: "conclusion", conclusion });
  return conclusion;
}
