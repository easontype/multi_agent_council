export type ToolCallParseStatus = "none" | "complete" | "malformed" | "truncated";

export interface ParsedToolCalls {
  status: ToolCallParseStatus;
  calls: Array<{ tool: string; args: Record<string, unknown> }>;
}

const OPEN_TAG = "[TOOL_CALL]";
const CLOSE_TAG = "[/TOOL_CALL]";

function normalizeToolCallJsonCandidate(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function extractJsonCandidate(rawBlock: string): string[] {
  const normalized = normalizeToolCallJsonCandidate(rawBlock);
  const candidates = new Set<string>();
  if (normalized) candidates.add(normalized);

  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.add(normalized.slice(firstBrace, lastBrace + 1).trim());
  }

  return [...candidates];
}

function parseToolCallBlock(rawBlock: string): { tool: string; args: Record<string, unknown> } | null {
  for (const candidate of extractJsonCandidate(rawBlock)) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed?.tool !== "string" || !parsed.tool.trim()) {
        continue;
      }
      return {
        tool: parsed.tool.trim(),
        args: parsed.args && typeof parsed.args === "object" && !Array.isArray(parsed.args)
          ? parsed.args as Record<string, unknown>
          : {},
      };
    } catch {
      continue;
    }
  }

  return null;
}

export function parseToolCalls(text: string): ParsedToolCalls {
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  let cursor = 0;
  let sawToolBlock = false;
  let sawMalformedBlock = false;

  while (cursor < text.length) {
    const openIndex = text.indexOf(OPEN_TAG, cursor);
    if (openIndex === -1) break;
    sawToolBlock = true;

    const contentStart = openIndex + OPEN_TAG.length;
    const closeIndex = text.indexOf(CLOSE_TAG, contentStart);
    if (closeIndex === -1) {
      return { status: "truncated", calls };
    }

    const rawBlock = text.slice(contentStart, closeIndex).trim();
    const parsed = parseToolCallBlock(rawBlock);
    if (parsed) {
      calls.push(parsed);
    } else {
      sawMalformedBlock = true;
    }

    cursor = closeIndex + CLOSE_TAG.length;
  }

  if (!sawToolBlock) return { status: "none", calls: [] };
  if (sawMalformedBlock) return { status: "malformed", calls };
  return { status: "complete", calls };
}
