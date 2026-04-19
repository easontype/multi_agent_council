export type ToolCallParseStatus = "none" | "complete" | "malformed" | "truncated";

export interface ParsedToolCalls {
  status: ToolCallParseStatus;
  calls: Array<{ tool: string; args: Record<string, unknown> }>;
}

const OPEN_TAG = "[TOOL_CALL]";
const CLOSE_TAG = "[/TOOL_CALL]";

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
    try {
      const parsed = JSON.parse(rawBlock);
      if (typeof parsed?.tool === "string" && parsed.tool.trim()) {
        calls.push({
          tool: parsed.tool.trim(),
          args: parsed.args && typeof parsed.args === "object" && !Array.isArray(parsed.args)
            ? parsed.args as Record<string, unknown>
            : {},
        });
      } else {
        sawMalformedBlock = true;
      }
    } catch {
      sawMalformedBlock = true;
    }

    cursor = closeIndex + CLOSE_TAG.length;
  }

  if (!sawToolBlock) return { status: "none", calls: [] };
  if (sawMalformedBlock) return { status: "malformed", calls };
  return { status: "complete", calls };
}
