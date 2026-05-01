import { getAgenticRuntimeClass, runAgenticRuntime } from "../agents/agentic-runtime";
import { handlers as ragHandlers } from "../tools/handlers/rag";
import { compressToolResult } from "../tool-compressor";
import { createEvidenceEntry, finalizeEvidenceEntry, saveTurn } from "../db/council-db";
import { sanitizeText } from "../utils/text";
import { buildSeatRuntimePrompt, extractEvidenceSources } from "../prompts/council-prompts";
import { normalizeSeatTurnContent } from "../prompts/council-turn-normalizer";
import type {
  CouncilSeat,
  CouncilSession,
  CouncilTurn,
  CouncilEvidenceSource,
  CouncilEventHandler,
} from "./council-types";

export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  }

  const workerCount = Math.min(limit, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function seatCanUseTool(seat: CouncilSeat, tool: string): boolean {
  return !seat.tools?.length || seat.tools.includes(tool);
}

function buildPreloadedRagQuestion(session: CouncilSession, seat: CouncilSeat, round: number): string {
  const goal = sanitizeText(session.goal);
  const title = sanitizeText(session.title);
  return [
    `For the ${seat.role} reviewer in round ${round}, retrieve concrete evidence from the paper under review.`,
    title ? `Paper: ${title}.` : null,
    `Topic: ${session.topic}.`,
    goal ? `Decision goal: ${goal}.` : null,
    "Prioritize passages that support or weaken this reviewer's critique, including methods, experiments, claims, limitations, and related-work framing.",
  ].filter(Boolean).join(" ");
}

function turnAlreadyCitesEvidence(content: string, sourceRefs: CouncilEvidenceSource[]): boolean {
  const lower = content.toLowerCase();
  return sourceRefs.some((ref) => {
    const marker = sanitizeText(ref.marker);
    const label = sanitizeText(ref.label);
    const uri = sanitizeText(ref.uri);
    return (
      (marker && content.includes(marker)) ||
      (uri && content.includes(uri)) ||
      (label.length >= 8 && lower.includes(label.toLowerCase()))
    );
  });
}

function formatEvidenceCitation(ref: CouncilEvidenceSource): string {
  const marker = sanitizeText(ref.marker);
  const label = sanitizeText(ref.label) || "Retrieved evidence";
  const uri = sanitizeText(ref.uri);
  const snippet = sanitizeText(ref.snippet);
  return ["-", marker, label, uri ? `| ${uri}` : "", snippet ? `- ${snippet}` : ""]
    .filter(Boolean)
    .join(" ");
}

function ensureTurnCitesEvidence(content: string, sourceRefs: CouncilEvidenceSource[]): string {
  const usableRefs = sourceRefs.filter((ref) => sanitizeText(ref.label) || sanitizeText(ref.uri));
  if (!usableRefs.length || turnAlreadyCitesEvidence(content, usableRefs)) return content;

  const citations = usableRefs.slice(0, 3).map(formatEvidenceCitation).join("\n");
  if (/\*\*Evidence\*\*/i.test(content)) {
    return `${content.trim()}\n${citations}`;
  }
  return `${content.trim()}\n\n**Evidence**\n${citations}`;
}

interface PreloadedEvidence {
  prompt: string;
  sourceRefs: CouncilEvidenceSource[];
}

async function preloadPaperEvidenceForSeat(
  session: CouncilSession,
  seat: CouncilSeat,
  round: number,
  runtimeClass: ReturnType<typeof getAgenticRuntimeClass>,
  onEvent: CouncilEventHandler,
  touchHeartbeat: () => Promise<void>,
): Promise<PreloadedEvidence | null> {
  if (!seat.library_id || !seatCanUseTool(seat, "rag_query")) return null;

  const args = {
    question: buildPreloadedRagQuestion(session, seat, round),
    limit: 5,
    tag: `council:lib:${seat.library_id}`,
    answer_mode: "extractive",
  };

  onEvent({ type: "tool_call", round, role: seat.role, tool: "rag_query", args });
  const evidence = await createEvidenceEntry({
    session_id: session.id,
    round,
    role: seat.role,
    model: seat.model,
    tool: "rag_query",
    runtime_class: runtimeClass,
    args,
  });
  await touchHeartbeat();

  try {
    const rawResult = await ragHandlers.rag_query("council", args, 0);
    const result = await compressToolResult("rag_query", rawResult);
    const sourceRefs = extractEvidenceSources("rag_query", args, result);

    await finalizeEvidenceEntry(evidence.id, { status: "completed", result, sourceRefs });
    onEvent({
      type: "tool_result",
      round,
      role: seat.role,
      tool: "rag_query",
      result: result.slice(0, 800),
      sourceRefs,
      runtimeClass,
    });
    await touchHeartbeat();

    return {
      prompt: [
        "Paper evidence has already been retrieved for this reviewer. Use it before making claims.",
        '[TOOL_RESULT tool="rag_query"]',
        result,
        "[/TOOL_RESULT]",
        "Your final response must cite at least one marker, paper title, or quoted finding from this tool result when it is relevant.",
      ].join("\n"),
      sourceRefs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finalizeEvidenceEntry(evidence.id, { status: "failed", result: message, sourceRefs: [] });
    await touchHeartbeat();
    return null;
  }
}

export async function runSeatTurn(
  session: CouncilSession,
  seat: CouncilSeat,
  round: number,
  prompt: string,
  onEvent: CouncilEventHandler,
  touchHeartbeat: () => Promise<void>,
  preferredLanguage?: string,
): Promise<CouncilTurn> {
  onEvent({ type: "turn_start", round, role: seat.role, model: seat.model });
  const runtimeClass = getAgenticRuntimeClass(seat.model);
  const pendingEvidence: Array<{ id: string; tool: string; args: Record<string, unknown> }> = [];
  const turnSourceRefs: CouncilEvidenceSource[] = [];
  let runtimeResult: Awaited<ReturnType<typeof runAgenticRuntime>>;

  try {
    const preloadedEvidencePrompt = await preloadPaperEvidenceForSeat(
      session, seat, round, runtimeClass, onEvent, touchHeartbeat,
    );
    if (preloadedEvidencePrompt?.sourceRefs.length) {
      turnSourceRefs.push(...preloadedEvidencePrompt.sourceRefs);
    }

    const libraryTag = seat.library_id ? `council:lib:${seat.library_id}` : undefined;
    const toolArgOverrides: Record<string, Record<string, unknown>> = {
      rag_query: { answer_mode: "extractive", ...(libraryTag ? { tag: libraryTag } : {}) },
    };
    if (libraryTag) {
      toolArgOverrides.semantic_search = { tag: libraryTag };
      toolArgOverrides.fetch_paper = { library_id: seat.library_id };
    }

    runtimeResult = await runAgenticRuntime({
      prompt: preloadedEvidencePrompt
        ? `${prompt}\n\n${preloadedEvidencePrompt.prompt}`
        : prompt,
      systemPrompt: buildSeatRuntimePrompt(seat, session.seats, round, preferredLanguage),
      model: seat.model,
      toolAgentId: session.owner_agent_id,
      runtimeId: `council:${session.id}:${seat.role}`,
      role: "worker",
      allowedTools: seat.tools,
      maxTokens: round === 1 ? 800 : 500,
      toolArgOverrides,
      onTextDelta: async (delta) => {
        onEvent({ type: "turn_delta", round, role: seat.role, delta });
        await touchHeartbeat();
      },
      onToolCall: async (tool, args) => {
        onEvent({ type: "tool_call", round, role: seat.role, tool, args });
        const ev = await createEvidenceEntry({
          session_id: session.id,
          round,
          role: seat.role,
          model: seat.model,
          tool,
          runtime_class: runtimeClass,
          args,
        });
        pendingEvidence.push({ id: ev.id, tool, args });
        await touchHeartbeat();
      },
      onToolResult: async (tool, result) => {
        const ev = pendingEvidence.shift();
        const sourceRefs = ev ? extractEvidenceSources(ev.tool, ev.args, result) : [];
        if (ev) {
          await finalizeEvidenceEntry(ev.id, { status: "completed", result, sourceRefs });
        }
        if (sourceRefs.length) turnSourceRefs.push(...sourceRefs);
        onEvent({
          type: "tool_result",
          round,
          role: seat.role,
          tool,
          result: result.slice(0, 800),
          sourceRefs,
          runtimeClass,
        });
        await touchHeartbeat();
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Promise.all(
      pendingEvidence.map((ev) =>
        finalizeEvidenceEntry(ev.id, { status: "failed", result: message, sourceRefs: [] }),
      ),
    );
    throw error;
  }

  const turn = await saveTurn({
    session_id: session.id,
    round,
    role: seat.role,
    model: seat.model,
    content: runtimeResult.text.trim()
      ? ensureTurnCitesEvidence(normalizeSeatTurnContent(runtimeResult.text, round), turnSourceRefs)
      : ensureTurnCitesEvidence("[No final response]", turnSourceRefs),
    input_tokens: runtimeResult.inputTokens,
    output_tokens: runtimeResult.outputTokens,
  });

  await touchHeartbeat();
  onEvent({ type: "turn_done", turn });
  return turn;
}
