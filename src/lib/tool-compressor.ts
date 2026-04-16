/**
 * tool-compressor.ts — Local Ollama pre-processing for long tool results.
 *
 * Compresses fetch_paper / fetch_url results before they reach the main LLM seat,
 * replacing the dumb hard-truncate with a structured summary so seats see the
 * paper's conclusions rather than just its introduction.
 *
 * Falls back to hard-truncate on any failure — never blocks the seat turn.
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const COMPRESSOR_MODEL = process.env.TOOL_COMPRESSOR_MODEL || "gemma4:2b";
const COMPRESS_THRESHOLD = 4000;   // chars
const COMPRESS_TIMEOUT_MS = 30_000;
const FALLBACK_LIMIT = 10_000;     // chars — matches existing hard-truncate

/** Tools that benefit from semantic compression vs. those already compact */
const COMPRESSIBLE_TOOLS = new Set(["fetch_paper", "fetch_url"]);

export function shouldCompress(tool: string, result: string): boolean {
  return COMPRESSIBLE_TOOLS.has(tool) && result.length > COMPRESS_THRESHOLD;
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
      raw.slice(0, 60_000),
    ].join("\n");
  }

  // fetch_url — plain summarize
  return [
    "Summarize the following web page content in 3-5 sentences.",
    "Focus on the main claim, key data points, and conclusion.",
    "Return only the summary text, no preamble.",
    "",
    raw.slice(0, 60_000),
  ].join("\n");
}

function formatResult(tool: string, raw: string, compressed: string): string {
  const prefix = tool === "fetch_paper"
    ? "# Paper Summary (compressed by local model)\n\n"
    : "# Page Summary (compressed by local model)\n\n";
  return prefix + compressed.trim();
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
        options: { temperature: 0, num_predict: 800 },
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Ollama ${res.status}`);

    const data = await res.json() as { message?: { content?: string } };
    const compressed = data.message?.content?.trim() ?? "";

    if (!compressed || compressed.length < 50) throw new Error("Empty response");

    return formatResult(tool, result, compressed);
  } catch {
    // Silent fallback — never break a seat turn
    return result.slice(0, FALLBACK_LIMIT);
  }
}
