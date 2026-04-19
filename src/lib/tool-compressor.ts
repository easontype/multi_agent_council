const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const COMPRESSOR_MODEL = process.env.TOOL_COMPRESSOR_MODEL || "gemma4:2b";
const COMPRESS_THRESHOLD = 2500;
const COMPRESS_TIMEOUT_MS = 30_000;
const FALLBACK_LIMIT = 3500;
const MAX_PROMPT_CHARS = 40_000;

export function shouldCompress(tool: string, result: string): boolean {
  void tool;
  return result.length > COMPRESS_THRESHOLD;
}

function buildPrompt(tool: string, raw: string): string {
  if (tool === "fetch_paper") {
    return [
      "Extract the key information from this academic paper text into structured JSON.",
      "Return ONLY valid JSON, no prose, no markdown fences.",
      "",
      "Required shape:",
      '{ "title": "...", "hypothesis": "...", "methodology": "1-2 sentences", "key_results": ["result 1", "result 2"], "limitations": ["limit 1"], "conclusion": "1-2 sentences" }',
      "",
      "Paper text (may be truncated):",
      raw.slice(0, MAX_PROMPT_CHARS),
    ].join("\n");
  }

  if (tool === "rag_query") {
    return [
      "Condense this RAG tool result for another model.",
      "Keep only the direct answer, retrieval metadata, warnings if present, and up to 4 sources with one short evidence note each.",
      "Return compact markdown only.",
      "",
      raw.slice(0, MAX_PROMPT_CHARS),
    ].join("\n");
  }

  if (tool === "semantic_search") {
    return [
      "Condense these search results for another model.",
      "Keep up to 5 results with title, source if present, and one short snippet each.",
      "Return compact markdown only.",
      "",
      raw.slice(0, MAX_PROMPT_CHARS),
    ].join("\n");
  }

  return [
    "Summarize this tool result for another model in compact markdown.",
    "Focus on the main claim, key data points, and conclusion.",
    "Keep the output under 12 short lines.",
    "",
    raw.slice(0, MAX_PROMPT_CHARS),
  ].join("\n");
}

function formatResult(tool: string, compressed: string): string {
  if (tool === "fetch_paper") {
    return `# Paper Summary (compressed by local model)\n\n${compressed.trim()}`;
  }
  return `# ${tool} Summary (compressed by local model)\n\n${compressed.trim()}`;
}

export async function compressToolResult(tool: string, result: string): Promise<string> {
  if (!shouldCompress(tool, result)) {
    return result.slice(0, FALLBACK_LIMIT);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COMPRESS_TIMEOUT_MS);

    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: COMPRESSOR_MODEL,
        messages: [{ role: "user", content: buildPrompt(tool, result) }],
        stream: false,
        options: { temperature: 0, num_predict: 700 },
      }),
    });

    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Ollama ${res.status}`);

    const data = await res.json() as { message?: { content?: string } };
    const compressed = data.message?.content?.trim() ?? "";
    if (!compressed || compressed.length < 40) throw new Error("Empty response");

    return formatResult(tool, compressed).slice(0, FALLBACK_LIMIT);
  } catch {
    return result.slice(0, FALLBACK_LIMIT);
  }
}
