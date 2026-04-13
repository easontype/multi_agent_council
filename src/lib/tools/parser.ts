// ── Parse [TOOL_CALL] blocks from LLM text ────────────────────────────────

export function parseToolCalls(
  text: string
): Array<{ tool: string; args: Record<string, unknown> }> {
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];

  // Format 1: [TOOL_CALL]{...}[/TOOL_CALL]  (Gemini / instructed format)
  const jsonRegex = /\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/g;
  let m: RegExpExecArray | null;
  while ((m = jsonRegex.exec(text)) !== null) {
    try {
      const p = JSON.parse(m[1].trim());
      if (p.tool) calls.push({ tool: p.tool, args: p.args ?? {} });
    } catch { /* skip malformed */ }
  }

  // Format 2: Claude CLI XML/MCP format
  // <invoke name="mcp__xxx__toolname"> or <invoke name="toolname">
  // <parameter name="key">value</parameter>
  const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
  while ((m = invokeRegex.exec(text)) !== null) {
    // Strip MCP prefix: mcp__<server>__<tool> → <tool>
    const rawName = m[1];
    const toolName = rawName.replace(/^mcp__[^_]+__/, "");
    // Skip Claude built-in tools (Write, Read, Bash, etc.) — not our platform tools
    if (/^(Write|Read|Bash|Glob|Grep|Edit|NotebookEdit|WebFetch|WebSearch|TodoWrite)$/.test(toolName)) continue;

    const paramsStr = m[2];
    const args: Record<string, unknown> = {};
    const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
    let pm: RegExpExecArray | null;
    while ((pm = paramRegex.exec(paramsStr)) !== null) {
      const key = pm[1];
      const raw = pm[2].trim();
      // Try JSON parse, fallback to string
      try { args[key] = JSON.parse(raw); } catch { args[key] = raw; }
    }
    calls.push({ tool: toolName, args });
  }

  return calls;
}
