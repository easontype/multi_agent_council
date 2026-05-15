/**
 * council-prompts.ts — Prompt builders, seat templates, and planner functions
 * for the Council debate engine.
 */

import { runLLM } from "../llm/claude";
import type {
  CouncilSeat,
  CouncilSession,
  CouncilTurn,
  CouncilConclusion,
  CouncilEvidenceSource,
  CouncilPlan,
  CouncilPlanInput,
  DissentItem,
  ActionItem,
  QuestionItem,
} from "../core/council-types";
import { EXPERIMENTAL_SEAT_DEFINITIONS, BIOMEDICAL_SEAT_DEFINITIONS, PHYSICS_SEAT_DEFINITIONS } from "../core/council-academic";
import { sanitizeText, clamp } from "../utils/text";
import { buildBoundedModeratorTranscript, buildBoundedRound2Context } from "./council-turn-summary";

// ─── Debate brief / round prompts ─────────────────────────────────────────────

export function buildDebateBrief(session: Pick<CouncilSession, "topic" | "context" | "goal">): string {
  // User-supplied content wrapped in XML tags to prevent prompt injection.
  return [
    "Debate topic:",
    `<user_input>${session.topic}</user_input>`,
    session.goal    ? `\nDecision goal:\n<user_input>${session.goal}</user_input>`    : "",
    session.context ? `\nContext:\n<user_input>${session.context}</user_input>`       : "",
  ].filter(Boolean).join("\n");
}

export function buildRound1Prompt(session: Pick<CouncilSession, "topic" | "context" | "goal">, preferredLanguage?: string): string {
  const langLabel = preferredLanguage ? LANGUAGE_LABELS[preferredLanguage] : undefined
  return [
    buildDebateBrief(session),
    "",
    "You are speaking in round 1 as an academic reviewer. Use tools to gather evidence first, then write your final response in concise Markdown. Keep your final written response under 400 words.",
    "Use tools if you need evidence before making claims. Do not assert facts you cannot verify.",
    "Write in reviewer tone: specific, impersonal, evidence-led, and ready to paste into a research memo.",
    "",
    "Use exactly these Markdown section headings:",
    "**Position** — Your core stance in 1-2 sentences.",
    "**Key Assumptions** — What must be true for your position to hold (2-3 bullet points max).",
    "**Main Risks** — The top 1-2 risks from your perspective.",
    "**Strongest Counterargument** — The best case against your own view, stated honestly in 1-2 sentences.",
    "If you used tools, end with an **Evidence** section listing the concrete URLs, files, or document titles you relied on.",
    "Do not use tables. Prefer compact bullets and short academic prose.",
    "NEVER reproduce raw tool output, JSON, or paper lists verbatim. Synthesize what you found; cite title + URL only.",
    langLabel ? `\nIMPORTANT: Write your entire response in ${langLabel}.` : "",
  ].filter(s => s !== "").join("\n");
}

// ─── Experimental science prompt variants ─────────────────────────────────────

const EXPERIMENTAL_SEAT_ROLES = new Set([
  ...EXPERIMENTAL_SEAT_DEFINITIONS,
  ...BIOMEDICAL_SEAT_DEFINITIONS,
  ...PHYSICS_SEAT_DEFINITIONS,
].map((d) => d.role));

export function isExperimentalTemplate(seats: CouncilSeat[]): boolean {
  return seats.some((s) => EXPERIMENTAL_SEAT_ROLES.has(s.role));
}

export function buildExperimentalRound1Prompt(
  session: Pick<CouncilSession, "topic" | "context" | "goal">,
  preferredLanguage?: string,
): string {
  const langLabel = preferredLanguage ? LANGUAGE_LABELS[preferredLanguage] : undefined;
  return [
    buildDebateBrief(session),
    "",
    "You are speaking in Round 1 as a specialized technical reviewer for an experimental science paper. Use tools (rag_query, search_papers, web_search) to retrieve evidence from the paper AND from external literature BEFORE writing your final assessment.",
    "Ground every claim in specific data: cite figure numbers, exact values with units, section names, or paper titles. Do NOT make generic statements like 'the performance is good' — always compare to a benchmark.",
    "",
    "Follow EXACTLY the structure defined in your system prompt.",
    "If your system prompt does not define a specific format, use these headings:",
    "**Position** — Your core technical assessment in 1–2 sentences.",
    "**Evidence Base** — Specific experimental data, figures, or literature that support your position (cite precisely: 'Fig. 3b shows a BET surface area of 142 m²/g, but no pore size distribution is provided').",
    "**Comparison Standard** — What the field considers adequate for this claim type. Cite a reference paper if possible.",
    "**Critical Gap** — The single most important missing piece that weakens the paper's central claim.",
    "If you used tools, end with an **Evidence** section listing title + URL of each source.",
    "Keep your final written response under 500 words. Prioritize specificity and numbers over breadth.",
    langLabel ? `\nIMPORTANT: Write your entire response in ${langLabel}.` : "",
  ].filter(s => s !== "").join("\n");
}

export function buildBoundedExperimentalRound2Prompt(
  session: Pick<CouncilSession, "topic" | "context" | "goal">,
  round1Turns: CouncilTurn[],
  round2TurnsSoFar: CouncilTurn[] = [],
  preferredLanguage?: string,
): string {
  const langLabel = preferredLanguage ? LANGUAGE_LABELS[preferredLanguage] : undefined;
  return [
    buildDebateBrief(session),
    "",
    ...buildBoundedRound2Context(round1Turns, round2TurnsSoFar),
    "",
    "Now make your Round 2 argument as a direct technical rebuttal. You may use tools to verify disputed data or find additional evidence.",
    "Write in concise Markdown with EXACTLY these sections:",
    "**Challenge** — Name the specific seat and the exact claim or data point you contest. In 2–3 sentences, explain why their evidence or interpretation is insufficient. Be technical and cite specifics (e.g., 'Characterization Auditor claims XRD confirms phase purity, but the peak at 2θ = 31.2° is consistent with an impurity phase — the authors do not address this.').",
    "**Proposed Resolution** — What specific experiment, measurement, or additional data would definitively resolve this dispute? Be concrete (e.g., 'XPS survey scan to quantify surface oxygen content, compared against a blank substrate.').",
    "**Stance** — One sentence: has your Round 1 position changed? If yes, state what evidence moved you. If no, state what it would take to move you.",
    "Update your position only if the evidence requires it. Do not capitulate to social pressure.",
    "If you used tools, end with an **Evidence** section (title + URL only).",
    "Keep your response under 400 words.",
    langLabel ? `\nIMPORTANT: Write your entire response in ${langLabel}.` : "",
  ].filter(s => s !== "").join("\n");
}

export function buildRound2Prompt(
  session: Pick<CouncilSession, "topic" | "context" | "goal">,
  round1Turns: CouncilTurn[],
  round2TurnsSoFar: CouncilTurn[] = [],
  preferredLanguage?: string
): string {
  const round1Section = round1Turns
    .map((turn) => `### ${turn.role}\n${turn.content}`)
    .join("\n\n");

  const parts: string[] = [
    buildDebateBrief(session),
    "",
    "Round 1 positions:",
    round1Section,
  ];

  if (round2TurnsSoFar.length > 0) {
    const round2Section = round2TurnsSoFar
      .map((turn) => `### ${turn.role} (Round 2 — already argued)\n${turn.content}`)
      .join("\n\n");
    parts.push(
      "",
      "Round 2 arguments already made by other seats — read before you respond:",
      round2Section,
    );
  }

  parts.push(
    "",
    "Now make your Round 2 argument as an academic rebuttal note. You may use tools to verify disputed claims. Keep your final written response under 300 words.",
    "Write in concise Markdown with exactly these sections:",
    "**Challenge** — Name the seat(s) and the specific claim you are contesting. State concisely why their evidence or logic is insufficient (2-3 sentences max).",
    "**Stance** — One sentence: state whether your Round 1 position has changed. If yes, cite the specific evidence that moved you. If no, state what it would take to move you.",
    "Update your position only if the evidence requires it. Do not capitulate to social pressure.",
    "When claims conflict, use tools to verify the disputed points.",
    "If you used tools, end with an **Evidence** section (title + URL only, no raw output).",
    "Do not use tables or conversational filler.",
    "NEVER reproduce raw tool output, JSON, or paper lists verbatim.",
  );

  const langLabel = preferredLanguage ? LANGUAGE_LABELS[preferredLanguage] : undefined
  if (langLabel) parts.push(`\nIMPORTANT: Write your entire response in ${langLabel}.`)

  return parts.filter(Boolean).join("\n");
}

// ─── Adversarial debate prompts ────────────────────────────────────────────────

export function buildAdversarialRound1Prompt(
  session: Pick<CouncilSession, "topic" | "context" | "goal">,
  preferredLanguage?: string,
): string {
  const langLabel = preferredLanguage ? LANGUAGE_LABELS[preferredLanguage] : undefined;
  return [
    buildDebateBrief(session),
    "",
    "You are in a structured adversarial debate. Your system prompt defines your assigned position and team.",
    "Round 1: Build the strongest possible case for your assigned position.",
    "Use tools (rag_query, search_papers, web_search) to gather supporting evidence before writing.",
    "Ground every claim in specific data: cite exact values, paper titles, or source URLs.",
    "",
    "Write in concise Markdown with EXACTLY these sections:",
    "**Position** — Your team's core claim in 1–2 sentences.",
    "**Arguments** — 2–3 distinct supporting arguments, each with evidence. Be specific: cite figures, metrics, or literature.",
    "**Anticipated Objections** — The 1–2 strongest arguments the opposing side will raise. Preemptively address each.",
    "**Confidence** — One sentence: how certain are you, and what evidence would most challenge your position?",
    "If you used tools, end with an **Evidence** section (title + URL only).",
    "Keep your response under 500 words.",
    langLabel ? `\nIMPORTANT: Write your entire response in ${langLabel}.` : "",
  ].filter(s => s !== "").join("\n");
}

export function buildAdversarialRound2Prompt(
  session: Pick<CouncilSession, "topic" | "context" | "goal" | "seats">,
  seat: CouncilSeat,
  round1Turns: CouncilTurn[],
  round2TurnsSoFar: CouncilTurn[],
  preferredLanguage?: string,
): string {
  const langLabel = preferredLanguage ? LANGUAGE_LABELS[preferredLanguage] : undefined;
  const myTeam = seat.team ?? "default";

  const teamMap = new Map(session.seats.map(s => [s.role, s.team ?? "default"]));
  const alliedTurns = round1Turns.filter(t => (teamMap.get(t.role) ?? "default") === myTeam);
  const opposingTurns = round1Turns.filter(t => (teamMap.get(t.role) ?? "default") !== myTeam);

  const formatTurns = (turns: CouncilTurn[]) =>
    turns.map(t => `### ${t.role}\n${t.content}`).join("\n\n");

  const parts: string[] = [
    buildDebateBrief(session),
    "",
  ];

  if (alliedTurns.length) {
    parts.push("=== Your Team's Round 1 Positions ===", formatTurns(alliedTurns), "");
  }
  if (opposingTurns.length) {
    parts.push("=== Opposing Team's Round 1 Positions ===", formatTurns(opposingTurns), "");
  }
  if (round2TurnsSoFar.length) {
    const r2Formatted = round2TurnsSoFar.map(t => {
      const tTeam = teamMap.get(t.role) ?? "default";
      const label = tTeam === myTeam ? "ally" : "opponent";
      return `### ${t.role} [${label}]\n${t.content}`;
    }).join("\n\n");
    parts.push("=== Round 2 Rebuttals So Far ===", r2Formatted, "");
  }

  parts.push(
    "Now write your Round 2 rebuttal. You may use tools to verify contested claims.",
    "Write in concise Markdown with EXACTLY these sections:",
    "**Challenge** — Name the opposing seat and the exact claim you are rebutting. Explain in 2–4 sentences why their evidence or reasoning is insufficient. Be specific: cite their exact wording and counter with data.",
    "**New Argument** — One new supporting argument for your position that your team has not yet raised. Evidence required.",
    "**Stance** — One sentence: has your Round 1 position changed? If yes, state what evidence moved you. If no, state what would be needed to move you.",
    "If you used tools, end with an **Evidence** section (title + URL only).",
    "Keep your response under 400 words.",
    langLabel ? `\nIMPORTANT: Write your entire response in ${langLabel}.` : "",
  );

  return parts.filter(s => s !== "").join("\n");
}

// ─── Moderator prompt ──────────────────────────────────────────────────────────

const MODERATOR_SYSTEM_PROMPT_BASE = [
  "You are the council moderator. Your job is to synthesize a structured debate transcript into a final, actionable academic peer-review conclusion.",
  "",
  "## Evidence weighting",
  "Each seat is annotated with [cited URLs: N]. Use this to calibrate how much to trust each seat's claims.",
  "  - N >= 2: strong evidence; weight this seat heavily.",
  "  - N = 1: partial evidence; weight with moderate confidence.",
  "  - N = 0: opinion only; do not let it override evidence-backed claims.",
  "When an evidence-backed seat and an opinion-only seat conflict, side with the evidence-backed seat unless the logic gap is obvious.",
  "",
  "## Conflict resolution rules",
  "When seats disagree:",
  "  1. Empirical disagreements go in dissent and should lower confidence.",
  "  2. Strategic disagreements go in dissent and should produce conservative action items.",
  "  3. A single blocking concern belongs in veto only if it is specific, plausible, and unresolved.",
  "  4. If all seats align, set consensus and use dissent = null.",
  "",
  "## Editorial decision rules",
  '  "Accept"         = no blocking concerns, all major claims are supported',
  '  "Minor Revision" = 1-2 fixable gaps, no fundamental validity issue',
  '  "Major Revision" = 3+ blocking concerns, or one issue that requires new experiments/data',
  '  "Reject"         = a fundamental validity flaw that cannot be fixed by revision alone',
  "",
  "## Confidence calibration",
  '  "high"   = seats cite real URLs, claims are cross-verified, and no blocking concern remains',
  '  "medium" = some URL evidence but uneven support, or one meaningful unresolved disagreement',
  '  "low"    = little evidence, major unresolved disagreement, or an unaddressed veto',
  "",
  "## Output format",
  "Return ONLY valid JSON - no prose, no markdown fences, no trailing text.",
  "Fill every field. Use null explicitly if a field does not apply.",
  "Be concise: summary = 2-4 sentences; each action item = one verb phrase; each dissent question = one sentence.",
  "",
  "action_items rules:",
  '  - Each item is an object: { "action": "Verb + specific thing", "priority": "blocking|recommended|optional" }',
  "  - blocking = must be resolved before proceeding",
  "  - recommended = should be done, but does not block progress",
  "  - Start with a verb and name the concrete revision.",
  "",
  "dissent rules:",
  '  - Each item is { "question": "...", "seats": { "RoleName": "position" }, "resolution_path": "specific steps to resolve" }',
  "  - resolution_path must name concrete experiments, measurements, or sections to add.",
  "  - Include only disagreements that remain unresolved after all rounds.",
  "",
  "questions rules:",
  "  - One entry per blocking or recommended action item (max 6, blocking first).",
  "  - question = the exact peer-review question a reviewer would ask at submission.",
  "  - raised_by = the seat role that most prominently raised this concern.",
  '  - literature = the single most relevant citation that seat provided: "Title (Year) | URL" or null.',
  "  - suggestion = one concrete, specific fix (name the experiment, section, or comparison table).",
  "",
  "{",
  '  "summary": "2-4 sentences covering the core conclusion and most important academic tradeoff",',
  '  "editorial_decision": "Accept | Minor Revision | Major Revision | Reject",',
  '  "editorial_rationale": "1-2 sentences: the decisive factor in this decision",',
  '  "consensus": "the shared conclusion all or most seats agree on, or null",',
  '  "dissent": [{"question": "...", "seats": {"RoleName": "position"}, "resolution_path": "..."}] or null,',
  '  "questions": [{"question": "...", "raised_by": "RoleName", "literature": "Title (Year) | URL or null", "suggestion": "..."}],',
  '  "action_items": [{"action": "Verb + specific action.", "priority": "blocking|recommended|optional"}],',
  '  "veto": "a specific blocking concern or null",',
  '  "confidence": "high|medium|low",',
  '  "confidence_reason": "one sentence explaining what drives confidence"',
  "}",
].join("\n");

export const MODERATOR_SYSTEM_PROMPT = MODERATOR_SYSTEM_PROMPT_BASE;

const ADVERSARIAL_MODERATOR_SYSTEM_PROMPT_BASE = [
  "You are the debate moderator for an adversarial debate. Your job is to evaluate which team made stronger arguments, synthesize the key points of disagreement, and produce a structured verdict.",
  "",
  "## Evaluation criteria (in order of weight)",
  "  1. Empirical evidence quality — cited URLs, specific data, reproducible benchmarks beat opinion.",
  "  2. Rebuttal depth — did a team directly address their opponent's strongest evidence?",
  "  3. Internal consistency — did a team's positions hold up across rounds without contradiction?",
  "  4. Scope of coverage — did a team address all major sub-questions?",
  "",
  "## Verdict rules",
  '  - "winning_team" must be the exact team name that appears in the debate (e.g. "pro", "con", "option_a") or "draw".',
  "  - Use \"draw\" only when evidence strength is genuinely equal.",
  "  - A team that consistently cites URLs beats a team with better prose but no citations.",
  "",
  "## Output format",
  "Return ONLY valid JSON — no prose, no markdown fences.",
  "",
  "{",
  '  "summary": "2-4 sentences covering what each team argued and why one won",',
  '  "winning_team": "team_name or draw",',
  '  "consensus": "any points both teams agreed on, or null",',
  '  "dissent": [{"question": "...", "seats": {"RoleName": "one-sentence position"}}] or null,',
  '  "action_items": [{"action": "Verb + specific follow-up.", "priority": "blocking|recommended|optional"}],',
  '  "veto": null,',
  '  "confidence": "high|medium|low",',
  '  "confidence_reason": "one sentence: what evidence gap or tie drives uncertainty"',
  "}",
].join("\n");

export function buildAdversarialModeratorSystemPrompt(preferredLanguage?: string): string {
  const langLabel = preferredLanguage ? LANGUAGE_LABELS[preferredLanguage] : undefined;
  if (!langLabel) return ADVERSARIAL_MODERATOR_SYSTEM_PROMPT_BASE;
  return ADVERSARIAL_MODERATOR_SYSTEM_PROMPT_BASE + `\n\nIMPORTANT: All string values in the JSON output must be written in ${langLabel}. JSON keys remain in English.`;
}

export function buildModeratorSystemPrompt(preferredLanguage?: string): string {
  const langLabel = preferredLanguage ? LANGUAGE_LABELS[preferredLanguage] : undefined
  if (!langLabel) return MODERATOR_SYSTEM_PROMPT_BASE
  return MODERATOR_SYSTEM_PROMPT_BASE + `\n\nIMPORTANT: All string values in the JSON output must be written in ${langLabel}. JSON keys remain in English.`
}

export function buildModeratorPrompt(
  session: Pick<CouncilSession, "topic" | "context" | "goal">,
  allTurns: CouncilTurn[],
  evidenceCounts: Record<string, number> = {}
): string {
  const formatted = allTurns
    .map((turn) => {
      const count = evidenceCounts[turn.role] ?? 0;
      const evidenceTag = `[cited URLs: ${count}]`;
      return `### [Round ${turn.round}] ${turn.role} ${evidenceTag}\n${turn.content}`;
    })
    .join("\n\n");

  return [
    buildDebateBrief(session),
    "",
    "Debate transcript:",
    formatted,
    "",
    "Return the final JSON conclusion.",
  ].join("\n");
}

// ─── JSON extraction + conclusion normalizer ───────────────────────────────────

export function extractFirstJsonObject(raw: string): string | null {
  const text = raw
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

export function normalizeConclusion(raw: string): Omit<CouncilConclusion, "id" | "session_id" | "created_at"> {
  const fallback = {
    summary: raw.trim(),
    consensus: null,
    dissent: null,
    action_items: [] as ActionItem[],
    veto: null,
    confidence: null as CouncilConclusion["confidence"],
    confidence_reason: null,
    editorial_decision: null as CouncilConclusion["editorial_decision"],
    editorial_rationale: null,
    questions: null as QuestionItem[] | null,
  };

  try {
    const jsonText = extractFirstJsonObject(raw);
    if (!jsonText) return fallback;
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    const rawConfidence = sanitizeText(parsed.confidence).toLowerCase();
    const confidence: CouncilConclusion["confidence"] =
      rawConfidence === "high" || rawConfidence === "medium" || rawConfidence === "low"
        ? rawConfidence
        : null;

    const dissent = parseDissentField(parsed.dissent);
    const action_items = parseActionItemsField(parsed.action_items);
    const questions = parseQuestionsField(parsed.questions);

    const rawDecision = sanitizeText(parsed.editorial_decision);
    const editorial_decision: CouncilConclusion["editorial_decision"] =
      rawDecision === "Accept" || rawDecision === "Minor Revision" ||
      rawDecision === "Major Revision" || rawDecision === "Reject"
        ? rawDecision : null;

    return {
      summary: sanitizeText(parsed.summary) || fallback.summary,
      editorial_decision,
      editorial_rationale: sanitizeText(parsed.editorial_rationale) || null,
      consensus: sanitizeText(parsed.consensus) || null,
      dissent,
      questions,
      action_items,
      veto: sanitizeText(parsed.veto) || null,
      confidence,
      confidence_reason: sanitizeText(parsed.confidence_reason) || null,
      winning_team: sanitizeText(parsed.winning_team) || null,
    };
  } catch {
    return fallback;
  }
}

function parseDissentField(raw: unknown): DissentItem[] | null {
  if (!raw) return null;
  // New format: array of {question, seats}
  if (Array.isArray(raw)) {
    const items = raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;
        const question = sanitizeText(obj.question);
        if (!question) return null;
        const seats: Record<string, string> = {};
        if (obj.seats && typeof obj.seats === "object" && !Array.isArray(obj.seats)) {
          for (const [k, v] of Object.entries(obj.seats as Record<string, unknown>)) {
            const val = sanitizeText(v);
            if (k && val) seats[k] = val;
          }
        }
        const resolution_path = sanitizeText(obj.resolution_path) || null;
        return { question, seats, resolution_path } as DissentItem;
      })
      .filter((item): item is DissentItem => item !== null);
    return items.length ? items : null;
  }
  // Legacy string format: wrap into a single item with no seats breakdown
  const text = sanitizeText(raw);
  if (!text) return null;
  return [{ question: text, seats: {} }];
}

function parseQuestionsField(raw: unknown): QuestionItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const question = sanitizeText(obj.question);
      const raised_by = sanitizeText(obj.raised_by);
      if (!question || !raised_by) return null;
      return {
        question,
        raised_by,
        literature: sanitizeText(obj.literature) || null,
        suggestion: sanitizeText(obj.suggestion) || "",
      };
    })
    .filter((item): item is QuestionItem => item !== null);
  return items.length ? items : null;
}

function parseActionItemsField(raw: unknown): ActionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item) return null;
      // New format: {action, priority}
      if (typeof item === "object" && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        const action = sanitizeText(obj.action);
        if (!action) return null;
        const p = sanitizeText(obj.priority).toLowerCase();
        const priority: ActionItem["priority"] =
          p === "blocking" || p === "recommended" || p === "optional" ? p : "recommended";
        return { action, priority };
      }
      // Legacy string format
      const action = sanitizeText(item);
      if (!action) return null;
      return { action, priority: "recommended" as const };
    })
    .filter((item): item is ActionItem => item !== null);
}

// ─── Evidence source extractor ─────────────────────────────────────────────────

export function cleanSnippet(text: string, max = 220): string | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max - 3)}...` : cleaned;
}

export function extractLineSnippet(result: string, token: string): string | null {
  const line = result
    .split(/\r?\n/)
    .find((candidate) => candidate.includes(token));
  return line ? cleanSnippet(line) : cleanSnippet(result);
}

export function extractEvidenceSources(
  tool: string,
  args: Record<string, unknown>,
  result: string,
): CouncilEvidenceSource[] {
  const refs: CouncilEvidenceSource[] = [];
  const seen = new Set<string>();

  const addRef = (label: string, uri?: string | null, snippet?: string | null, marker?: string | null) => {
    const cleanLabel = sanitizeText(label);
    const cleanUri = sanitizeText(uri) || null;
    const cleanSnippetValue = cleanSnippet(snippet ?? "");
    const cleanMarker = sanitizeText(marker) || null;
    if (!cleanLabel) return;
    const dedupeKey = `${cleanLabel}|${cleanUri ?? ""}`;
    if (seen.has(dedupeKey)) return;
    if (cleanUri && seen.has(`uri|${cleanUri}`)) return;
    seen.add(dedupeKey);
    if (cleanUri) seen.add(`uri|${cleanUri}`);
    refs.push({ label: cleanLabel, uri: cleanUri, snippet: cleanSnippetValue, marker: cleanMarker });
  };

  const parseNumberedSourceBlock = (block: string) => {
    let current: { marker: string; label: string; uri: string | null; snippet: string[] } | null = null;

    const flush = () => {
      if (!current) return;
      addRef(current.label, current.uri, current.snippet.join(" "), current.marker);
      current = null;
    };

    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const match = line.match(/^(?:[-*]\s*)?\[(\d+)\]\s+(.+?)(?:\s+\|\s+(https?:\/\/\S+))?$/);
      if (match) {
        flush();
        current = {
          marker: `[${match[1]}]`,
          label: match[2].trim(),
          uri: match[3] ?? null,
          snippet: [],
        };
        continue;
      }
      if (current) current.snippet.push(line);
    }

    flush();
  };

  const parseSection = (heading: "Sources" | "Evidence") => {
    const lines = result.split(/\r?\n/);
    const start = lines.findIndex((line) => line.trim().toLowerCase() === `${heading.toLowerCase()}:`);
    if (start === -1) return false;

    const blockLines: string[] = [];
    for (let index = start + 1; index < lines.length; index += 1) {
      const trimmed = lines[index].trim();
      if (
        blockLines.length > 0 &&
        (/^##\s+/.test(trimmed) || /^[A-Z][A-Za-z ]+:\s*$/.test(trimmed))
      ) {
        break;
      }
      blockLines.push(lines[index]);
    }

    const before = refs.length;
    parseNumberedSourceBlock(blockLines.join("\n"));
    return refs.length > before;
  };

  if (tool === "fetch_url" && typeof args.url === "string") {
    addRef(args.url, args.url, result);
  }
  if (tool === "read_file" && typeof args.path === "string") {
    addRef(args.path, args.path, result);
  }
  if (tool === "read_document" && typeof args.documentId === "string") {
    addRef(`document:${args.documentId}`, String(args.documentId), result);
  }
  if (tool === "list_documents" && typeof args.tag === "string") {
    addRef(`documents tag:${args.tag}`, null, result);
  }

  // Parse individual papers from the "Sources:" section in RAG output
  let ragSourcesParsed = false;
  if (tool === "rag_query" && typeof args.question === "string") {
    ragSourcesParsed = parseSection("Sources") || parseSection("Evidence");
    if (!ragSourcesParsed) addRef(`rag:${args.question}`, null, result);
  }

  if (tool === "semantic_search" && typeof args.query === "string") {
    addRef(`semantic:${args.query}`, null, result);
  }

  if (!ragSourcesParsed) {
    for (const match of result.matchAll(/https?:\/\/[^\s)\]>"]+/g)) {
      const url = match[0];
      addRef(url, url, extractLineSnippet(result, url));
      if (refs.length >= 8) break;
    }

    for (const line of result.split(/\r?\n/)) {
      // Strip trailing "| https://..." so URL isn't included in the label
      const titleMatch = line.match(/^(?:##\s*\d+\.\s*|\[\d+\]\s*)(.+?)(?:\s+\|\s+https?:\/\/\S+)?$/);
      if (!titleMatch) continue;
      addRef(titleMatch[1].trim(), null, line);
      if (refs.length >= 8) break;
    }
  }

  if (!refs.length && result.trim()) {
    addRef(`${tool} result`, null, result);
  }

  // Enrich refs with chunk_index / doc_id / score / source_type from source_meta section
  const sourceMetaMatch = result.match(/^source_meta:\s*(\[[\s\S]*?\])\s*$/m);
  if (sourceMetaMatch) {
    try {
      const meta = JSON.parse(sourceMetaMatch[1]) as Array<{
        marker: string;
        chunk_index: number | null;
        doc_id: string | null;
        score: number;
        source_type: "local_doc" | "academic" | "web";
        authors: string[] | null;
        year: number | null;
      }>;
      for (const m of meta) {
        const ref = refs.find((r) => r.marker === m.marker);
        if (ref) {
          ref.chunk_index = m.chunk_index ?? null;
          ref.doc_id = m.doc_id ?? null;
          ref.source_type = m.source_type;
          ref.similarity_score = m.score;
          ref.authors = m.authors ?? null;
          ref.year = m.year ?? null;
        }
      }
    } catch {
      // malformed source_meta — ignore, refs remain without enrichment
    }
  }

  return refs.slice(0, 8);
}

// ─── Seat helpers ──────────────────────────────────────────────────────────────

export const LANGUAGE_LABELS: Record<string, string> = {
  'zh-TW': 'Traditional Chinese (繁體中文)',
  'zh-CN': 'Simplified Chinese (简体中文)',
  'ja': 'Japanese (日本語)',
  'ko': 'Korean (한국어)',
}

export function buildSeatRuntimePrompt(seat: CouncilSeat, allSeats?: CouncilSeat[], round?: number, preferredLanguage?: string): string {
  const otherRoles = allSeats
    ? allSeats.filter((s) => s.role !== seat.role).map((s) => s.role)
    : [];

  const councilContext = otherRoles.length > 0
    ? `You are one of ${otherRoles.length + 1} seats in this council. The other seats are: ${otherRoles.join(", ")}. Stake out a position that is distinct from theirs — do not repeat what they are likely to say. Your unique lens is your value.`
    : "";

  const langLabel = preferredLanguage ? LANGUAGE_LABELS[preferredLanguage] : undefined
  const langInstruction = langLabel
    ? `IMPORTANT: Write your entire response in ${langLabel}. All prose, headings, and analysis must be in ${langLabel}.`
    : ""

  return [
    seat.systemPrompt,
    seat.bias ? `Bias:\n${seat.bias}` : "",
    councilContext,
    "Maintain this point of view unless the evidence clearly disproves it.",
    "Do not act like a neutral moderator. Argue from your seat's perspective, then note where your own view is weak.",
    "When you receive tool results, you MUST cite at least one specific finding (paper title, URL, quoted data point) in your final response. Never silently ignore what you retrieved.",
    langInstruction,
  ].filter(Boolean).join("\n\n");
}

export function buildSeat(
  role: string,
  systemPrompt: string,
  model: string,
  options?: { bias?: string; tools?: string[] }
): CouncilSeat {
  const hasTools = Boolean(options?.tools?.length);
  return {
    role,
    model,
    systemPrompt,
    bias: options?.bias,
    tools: hasTools ? options!.tools : undefined,
  };
}

export function buildTemplateSeats(
  template: CouncilPlan["template"],
  model: string,
  seatCount: number
): CouncilSeat[] {
  const libraries: Record<CouncilPlan["template"], CouncilSeat[]> = {
    architecture: [
      buildSeat("Architect", "You are the principal architect. Focus on architecture quality, system boundaries, and implementation feasibility.", model, {
        bias: "Bias toward boring, maintainable designs with clear boundaries and low coupling.",
        tools: ["list_directory", "read_file", "list_documents", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("Skeptic Reviewer", "You are the skeptic reviewer. Attack weak assumptions, hidden coupling, and likely failure modes.", model, {
        bias: "Bias toward disproving optimistic claims and exposing hidden failure modes early.",
        tools: ["list_directory", "read_file", "rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("Security Engineer", "You are the security engineer. Focus on auth, data exposure, abuse paths, secrets, and operational blast radius.", model, {
        bias: "Bias toward least privilege, blast-radius reduction, and exploitability over convenience.",
        tools: ["read_file", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("SRE", "You are the SRE. Focus on reliability, observability, deployment safety, rollback, and incident response.", model, {
        bias: "Bias toward operability, safe rollback paths, and reducing pager load.",
        tools: ["read_file", "rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("Cost Engineer", "You are the cost engineer. Focus on runtime cost, model cost, infra efficiency, and maintenance overhead.", model, {
        bias: "Bias toward durable margin and lower long-term operating complexity.",
        tools: ["read_file", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
    ],
    growth: [
      buildSeat("Growth Strategist", "You are the growth strategist. Focus on distribution, offer clarity, and measurable acquisition channels.", model, {
        bias: "Bias toward channels that can compound and be systematized instead of one-off hacks.",
        tools: ["list_documents", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("Content Lead", "You are the content lead. Focus on messaging, hooks, content format, and conversion path.", model, {
        bias: "Bias toward clearer positioning, sharper hooks, and reusable content assets.",
        tools: ["list_documents", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("Performance Marketer", "You are the performance marketer. Focus on funnels, tests, CAC, CTR, and rapid iteration.", model, {
        bias: "Bias toward measurable experiments, short feedback loops, and hard unit economics.",
        tools: ["list_documents", "read_document", "web_search", "fetch_url"],
      }),
      buildSeat("Audience Researcher", "You are the audience researcher. Focus on demand signals, objections, and segment-specific language.", model, {
        bias: "Bias toward actual audience pain and language over internal assumptions.",
        tools: ["list_documents", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("Skeptic Operator", "You are the skeptic operator. Challenge plans that sound good but are hard to execute repeatedly.", model, {
        bias: "Bias toward repeatability and operational feasibility over polished strategy decks.",
        tools: ["list_documents", "read_document", "web_search", "fetch_url"],
      }),
    ],
    business: [
      buildSeat("Product Strategist", "You are the product strategist. Focus on product scope, wedge, differentiation, and sequencing.", model, {
        bias: "Bias toward a sharp wedge and a sequence that reaches revenue before complexity explodes.",
        tools: ["list_documents", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("Customer Voice", "You are the customer voice. Focus on jobs-to-be-done, objections, and decision friction.", model, {
        bias: "Bias toward customer pains, switching costs, and purchase friction.",
        tools: ["list_documents", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("GTM Lead", "You are the GTM lead. Focus on launch path, positioning, pricing surface, and sales motion.", model, {
        bias: "Bias toward fastest credible route to distribution and conversion.",
        tools: ["list_documents", "read_document", "web_search", "fetch_url"],
      }),
      buildSeat("Finance Lead", "You are the finance lead. Focus on margin, payback, cash risk, and pricing mechanics.", model, {
        bias: "Bias toward cash discipline, payback speed, and margin durability.",
        tools: ["list_documents", "read_document", "web_search", "fetch_url"],
      }),
      buildSeat("Risk Manager", "You are the risk manager. Focus on downside protection, compliance, dependency risk, and failure containment.", model, {
        bias: "Bias toward downside containment and reducing irreversible exposure.",
        tools: ["list_documents", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
    ],
    general: [
      buildSeat("Research Analyst", "You are the research analyst. Focus on clear facts, assumptions, and the minimum evidence needed to decide.", model, {
        bias: "Bias toward decision-grade evidence instead of hand-wavy opinions.",
        tools: ["list_documents", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("Operator", "You are the operator. Focus on implementation speed, bottlenecks, and execution sequence.", model, {
        bias: "Bias toward execution speed, sequencing, and reducing coordination drag.",
        tools: ["list_documents", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("Skeptic", "You are the skeptic. Challenge missing evidence, optimism bias, and weak logic.", model, {
        bias: "Bias toward attacking weak evidence and overconfident framing.",
        tools: ["rag_query", "web_search", "fetch_url"],
      }),
      buildSeat("Risk Manager", "You are the risk manager. Focus on downside, reversibility, and hidden dependencies.", model, {
        bias: "Bias toward reversible decisions and explicit downside control.",
        tools: ["list_documents", "read_document", "rag_query", "web_search", "fetch_url"],
      }),
    ],
    experimental: EXPERIMENTAL_SEAT_DEFINITIONS.map((def) => ({
      role: def.role,
      model,
      systemPrompt: def.systemPrompt,
      bias: def.bias,
      tools: def.tools,
    })),
    materials: EXPERIMENTAL_SEAT_DEFINITIONS.map((def) => ({
      role: def.role,
      model,
      systemPrompt: def.systemPrompt,
      bias: def.bias,
      tools: def.tools,
    })),
    biomedical: BIOMEDICAL_SEAT_DEFINITIONS.map((def) => ({
      role: def.role,
      model,
      systemPrompt: def.systemPrompt,
      bias: def.bias,
      tools: def.tools,
    })),
    physics: PHYSICS_SEAT_DEFINITIONS.map((def) => ({
      role: def.role,
      model,
      systemPrompt: def.systemPrompt,
      bias: def.bias,
      tools: def.tools,
    })),
  };

  return libraries[template].slice(0, clamp(seatCount, 2, libraries[template].length));
}

// ─── Planner ───────────────────────────────────────────────────────────────────

const HAS_CJK_RE = /[\u3400-\u9fff]/;

export function buildHeuristicPlan(input: CouncilPlanInput, defaultSeatModel: string, defaultModeratorModel: string): CouncilPlan {
  const topic = sanitizeText(input.topic);
  const context = sanitizeText(input.context);
  const goal = sanitizeText(input.goal);
  const text = [topic, context, goal].filter(Boolean).join(" ").toLowerCase();
  const hasCjk = HAS_CJK_RE.test([topic, context, goal].join(" "));

  const isArchitecture = /(repo|code|bug|api|database|postgres|schema|migration|deploy|infra|architecture|system design|typescript|next\.js|react|security|auth|latency|performance|sre|codebase|程式|程式碼|錯誤|除錯|架構|系統設計|資料庫|遷移|部署|基礎設施|權限|驗證|效能|延遲|監控|可觀測性|資安|維運|可靠性)/.test(text);
  const isGrowth = /(seo|content|traffic|ads|facebook|threads|pinterest|landing page|funnel|distribution|viral|lead|audience|social post|gumroad|growth|成長|增長|流量|廣告|社群|貼文|漏斗|轉換|受眾|導流|內容行銷|自然流量|擴散)/.test(text);
  const isBusiness = /(pricing|sales|offer|market|customer|product|roadmap|launch|subscription|revenue|margin|monetize|business model|定價|銷售|報價|市場|客戶|產品|路線圖|上線|訂閱|營收|毛利|獲利|商業模式|變現)/.test(text);
  const isMaterials = /(synthesis|synthesize|characterization|characterize|xrd|sem|tem|xps|bet|ftir|raman|electrochemical|electrochem|catalysis|catalyst|nanoparticle|nanomaterial|nanotube|graphene|mxene|electrode|electrolyte|capacitor|supercapacitor|battery|fuel cell|membrane|polymer|composite|coating|thin film|crystal|crystalline|morphology|yield|conversion rate|selectivity|reaction mechanism|activation energy|thermodynamic|kinetic|precursor|calcination|hydrothermal|solvothermal|chemical vapor|pvd|cvd|sol-gel|sintering|doping|defect|band gap|photocatalysis|electrocatalysis|oxygen reduction|hydrogen evolution|co2 reduction|materials science|energy storage|energy conversion|合成|表徵|表面積|奈米|電化學|催化|電極|電解質|電容|超級電容|電池|燃料電池|薄膜|高分子|複合材料|塗層|晶體|型態|產率|轉化率|選擇性|反應機制|活化能|前驅物|水熱|溶熱|化學氣相|摻雜|缺陷|能隙|光催化|電催化|材料)/.test(text);
  const isBiomedical = /(drug delivery|scaffold|in vitro|in vivo|cytotoxicity|ic50|biocompatibility|cell viability|hemolysis|apoptosis|tumor|cancer|oncology|therapeutic|nanocarrier|liposome|hydrogel|biosensor|diagnostic|clinical trial|patient|immunogenicity|pharmacokinetics|pharmacodynamics|toxicology|histology|organ|tissue engineering|wound healing|antibacterial|antimicrobial|infection|bacteria|virus|gene therapy|rna|dna|crispr|protein|receptor|antibody|immunotherapy|regenerative|stem cell|translational|生醫|藥物|支架|細胞|毒性|腫瘤|癌症|治療|診斷|生物感測|臨床|免疫|基因|蛋白質|再生醫學|幹細胞)/.test(text);
  const isPhysics = /(transistor|mosfet|semiconductor|photovoltaic|solar cell|perovskite|led|oled|laser|photodetector|sensor|mems|nems|quantum dot|quantum well|spintronics|magnetics|ferroelectric|piezoelectric|thermoelectric|rf|microwave|antenna|dielectric|capacitance|inductance|resonator|waveguide|optical fiber|photonic|plasmonic|metamaterial|2d material|graphene device|silicon|gaas|gan|power device|integrated circuit|pcb|pce|eqe|responsivity|detectivity|endurance|retention|fabrication|lithography|etching|deposition|sputtering|device integration|reliability|lifetime|degradation|光伏|太陽能|半導體|電晶體|光電|雷射|感測器|量子|磁性|壓電|熱電|微機電|奈米機電|積體電路|元件|物理)/.test(text);
  const isExperimental = isMaterials || isBiomedical || isPhysics || /(experimental science|experimental study|experimental paper|實驗|物理|化學|生物)/.test(text);
  const highStake = /(security|auth|incident|outage|migration|payment|pricing|legal|compliance|production|customer data|revenue|資安|安全|權限|事故|停機|遷移|付款|金流|法務|合規|正式環境|客戶資料|營收)/.test(text);
  const comparison = /(compare|choose|tradeoff|debate|versus|\bvs\b|option a|option b|review|strategy|比較|選擇|取捨|辯論|對比|方案a|方案b|評估|審查|策略|是否|該不該|值不值得|可不可行)/.test(text);

  let template: CouncilPlan["template"] = "general";
  if (isArchitecture) template = "architecture";
  else if (isPhysics) template = "physics";
  else if (isBiomedical) template = "biomedical";
  else if (isMaterials) template = "materials";
  else if (isExperimental) template = "experimental";
  else if (isGrowth) template = "growth";
  else if (isBusiness) template = "business";

  let score = 0;
  if (topic.length > 120 || text.length > 240) score += 1;
  if (highStake) score += 2;
  if (comparison) score += 1;
  if ((isArchitecture ? 1 : 0) + (isGrowth ? 1 : 0) + (isBusiness ? 1 : 0) > 1) score += 1;
  if (hasCjk && (context.length > 32 || goal.length > 16)) score += 1;
  if (/(enterprise|framework|pilot|organization|org|policy|workflow|企業|框架|導入|內推|治理|流程)/.test(text)) score += 1;

  const complexity: CouncilPlan["complexity"] = score >= 3 ? "high" : score >= 1 ? "medium" : "low";
  const shouldUseCouncil = complexity !== "low" || comparison;

  const preferredModel = sanitizeText(input.preferredModel) || defaultSeatModel;
  const seatCount = input.maxSeats
    ? clamp(input.maxSeats, 2, 5)
    : complexity === "high"
      ? 5
      : complexity === "medium"
        ? 4
        : 3;

  const reasoning = [
    hasCjk ? "language=cjk_or_mixed" : "language=latin",
    `template=${template}`,
    `complexity=${complexity}`,
    highStake ? "high_stakes=true" : "high_stakes=false",
    comparison ? "comparison=true" : "comparison=false",
    shouldUseCouncil ? "escalate=yes" : "escalate=no",
  ];

  return {
    shouldUseCouncil,
    template,
    complexity,
    title: topic.length > 72 ? `${topic.slice(0, 69)}...` : topic,
    rounds: complexity === "low" ? 1 : 2,
    moderator_model: defaultModeratorModel,
    seats: buildTemplateSeats(template, preferredModel, seatCount),
    reasoning,
  };
}

export function shouldUsePlannerClassifier(input: CouncilPlanInput, heuristic: CouncilPlan): boolean {
  const text = [input.topic, input.context, input.goal].filter(Boolean).join(" ");
  // Always use LLM when:
  // - Text contains CJK (regex patterns are weaker for Chinese)
  // - Topic is a comparison / decision (high ambiguity)
  // - Topic is high-stakes (wrong template = bad seat selection)
  // - Heuristic landed on general+low but text is substantial (likely mis-classified)
  const highStake = /(security|auth|incident|outage|migration|payment|pricing|legal|compliance|production|customer data|revenue|資安|安全|權限|事故|停機|遷移|付款|金流|法務|合規|正式環境|客戶資料|營收)/.test(text.toLowerCase());
  const comparison = /(compare|choose|tradeoff|debate|versus|\bvs\b|option a|option b|review|strategy|比較|選擇|取捨|辯論|對比|方案a|方案b|評估|審查|策略|是否|該不該|值不值得|可不可行)/.test(text.toLowerCase());
  return (
    HAS_CJK_RE.test(text) ||
    highStake ||
    comparison ||
    (heuristic.template === "general" && heuristic.complexity === "low" && text.length > 80)
  );
}

export async function classifyPlanWithLLM(
  input: CouncilPlanInput,
  defaultPlanClassifierModel: string
): Promise<Pick<CouncilPlan, "template" | "complexity" | "shouldUseCouncil" | "reasoning"> | null> {
  const topic = sanitizeText(input.topic);
  if (!topic) return null;

  const prompt = [
    "Classify whether this topic should escalate into a multi-agent council.",
    "Return JSON only with this exact shape:",
    '{ "template": "architecture|growth|business|general|experimental|materials|biomedical|physics", "complexity": "low|medium|high", "shouldUseCouncil": true, "reasoning": ["short signal"] }',
    'Use "materials" for materials science, chemistry, synthesis, characterization, electrochemistry, catalysis, or energy storage/conversion papers.',
    'Use "biomedical" for drug delivery, in vitro/in vivo studies, clinical research, diagnostics, therapeutic devices, or any life sciences paper with translational intent.',
    'Use "physics" for device physics, semiconductors, photovoltaics, optoelectronics, MEMS, quantum devices, or any paper reporting device efficiency or reliability.',
    'Use "experimental" only as a catch-all for experimental science papers that do not clearly fit materials, biomedical, or physics.',
    "",
    `Topic: ${topic}`,
    input.context ? `Context: ${sanitizeText(input.context)}` : "",
    input.goal ? `Goal: ${sanitizeText(input.goal)}` : "",
  ].filter(Boolean).join("\n");

  try {
    const raw = await runLLM(prompt, "You are a strict classifier. Output JSON only.", defaultPlanClassifierModel);
    const jsonText = extractFirstJsonObject(raw);
    if (!jsonText) return null;
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const template = ["architecture", "growth", "business", "general", "experimental", "materials", "biomedical", "physics"].includes(String(parsed.template))
      ? String(parsed.template) as CouncilPlan["template"]
      : null;
    const complexity = ["low", "medium", "high"].includes(String(parsed.complexity))
      ? String(parsed.complexity) as CouncilPlan["complexity"]
      : null;
    const reasoning = Array.isArray(parsed.reasoning)
      ? parsed.reasoning.map((item) => sanitizeText(item)).filter(Boolean).slice(0, 6)
      : [];

    if (!template || !complexity || typeof parsed.shouldUseCouncil !== "boolean") {
      return null;
    }

    return {
      template,
      complexity,
      shouldUseCouncil: parsed.shouldUseCouncil,
      reasoning: reasoning.length ? ["planner=llm", ...reasoning] : ["planner=llm"],
    };
  } catch {
    return null;
  }
}

// ─── Bounded prompt variants (merged from council-bounded-prompts.ts) ──────────

export function buildBoundedRound2Prompt(
  session: Pick<CouncilSession, "topic" | "context" | "goal">,
  round1Turns: CouncilTurn[],
  round2TurnsSoFar: CouncilTurn[] = [],
  preferredLanguage?: string,
): string {
  const langLabel = preferredLanguage ? LANGUAGE_LABELS[preferredLanguage] : undefined
  return [
    buildDebateBrief(session),
    "",
    ...buildBoundedRound2Context(round1Turns, round2TurnsSoFar),
    "",
    "Now make your Round 2 argument as an academic rebuttal note. You may use tools to verify disputed claims. Keep your final written response under 300 words.",
    "Write in concise Markdown with exactly these sections:",
    "**Challenge** - Name the seat(s) and the specific claim you are contesting. State concisely why their evidence or logic is insufficient (2-3 sentences max).",
    "**Stance** - One sentence: state whether your Round 1 position has changed. If yes, cite the specific evidence that moved you. If no, state what it would take to move you.",
    "Update your position only if the evidence requires it. Do not capitulate to social pressure.",
    "When claims conflict, use tools to verify the disputed points.",
    "If you used tools, end with an **Evidence** section (title + URL only, no raw output).",
    "Do not use tables or conversational filler.",
    "NEVER reproduce raw tool output, JSON, or paper lists verbatim.",
    langLabel ? `\nIMPORTANT: Write your entire response in ${langLabel}.` : "",
  ].filter(s => s !== "").join("\n");
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
