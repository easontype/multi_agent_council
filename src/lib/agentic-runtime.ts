import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@/types";
import { db } from "./db";
import { streamLLM, streamClaudeWithNativeTools, isOllamaModel, isOpenAIModel, isCodexModel } from "./claude";
import { isGeminiModel } from "./gemini";
import type { OllamaMessage } from "./ollama";
import { ANTHROPIC_PLATFORM_TOOL_SCHEMAS } from "./tools/schema";
import { handlers as webHandlers } from "./tools/handlers/web";
import { handlers as ragHandlers } from "./tools/handlers/rag";
import { parseToolCalls } from "./tools/parser";

// Stubs for removed platform dependencies
async function listMCPTools(_serverId: string, _tool: Tool): Promise<Array<{ name: string; description?: string; inputSchema?: unknown }>> { return []; }
async function executeHttpTool(_name: string, _args: Record<string, unknown>, _agentId: string): Promise<string> { return "http tools not available"; }
async function executeMCPTool(_ref: string, _args: Record<string, unknown>, _agentId: string): Promise<string> { return "mcp not available"; }
async function applyAgentRateLimit(_runtimeId: string, _role: string): Promise<void> { return; }

// files handlers stub (not needed for council-only deployment)
const filesHandlers = {
  list_directory: async (_agentId: string, _args: Record<string, unknown>, _depth: number) => "file access not available in this deployment",
  read_file: async (_agentId: string, _args: Record<string, unknown>, _depth: number) => "file access not available in this deployment",
  list_documents: async (_agentId: string, args: Record<string, unknown>, _depth: number) => {
    // Delegate to ragHandlers for document listing
    const tag = typeof args.tag === "string" ? args.tag : undefined;
    try {
      const { rows } = await db.query(
        `SELECT id, title, source_url, created_at FROM documents ${tag ? "WHERE tags ? $1" : ""} ORDER BY created_at DESC LIMIT 20`,
        tag ? [tag] : []
      );
      if (!rows.length) return "No documents found.";
      return (rows as Array<{ id: string; title: string; source_url: string | null }>)
        .map((r, i) => `${i + 1}. [${r.id}] ${r.title}${r.source_url ? ` — ${r.source_url}` : ""}`)
        .join("\n");
    } catch {
      return "Could not list documents.";
    }
  },
  read_document: async (_agentId: string, args: Record<string, unknown>, _depth: number) => {
    const docId = typeof args.documentId === "string" ? args.documentId : "";
    if (!docId) return "documentId required";
    try {
      const { rows } = await db.query(`SELECT title, content FROM documents WHERE id = $1`, [docId]);
      if (!rows.length) return `Document ${docId} not found`;
      const row = rows[0] as { title: string; content: string };
      return `# ${row.title}\n\n${row.content.slice(0, 8000)}`;
    } catch {
      return "Could not read document.";
    }
  },
};

const DEFAULT_SAFE_TOOLSET = ["web_search", "fetch_url", "rag_query"];
const DEFAULT_MAX_ROUNDS = 6;
const DEFAULT_MAX_TOOL_CALLS = 12;
const SAFE_PLATFORM_TOOL_HANDLERS = {
  list_directory: filesHandlers.list_directory,
  read_file: filesHandlers.read_file,
  list_documents: filesHandlers.list_documents,
  read_document: filesHandlers.read_document,
  web_search: webHandlers.web_search,
  fetch_url: webHandlers.fetch_url,
  search_papers: webHandlers.search_papers,
  fetch_paper: webHandlers.fetch_paper,
  rag_query: ragHandlers.rag_query,
  semantic_search: ragHandlers.semantic_search,
} as const;
const SAFE_PLATFORM_TOOL_DOCS: Record<string, string> = {
  list_directory: "args: { path? } - List files under the project root.",
  read_file: "args: { path } - Read a file under src/ or workspace/.",
  list_documents: "args: { tag?, keyword?, limit? } - List saved platform documents.",
  read_document: "args: { documentId } - Read a saved platform document.",
  web_search: "args: { query, count? } - Search the web for current information.",
  fetch_url: "args: { url, selector? } - Fetch a URL and extract readable text.",
  search_papers: "args: { query, source?, limit? } - Search academic databases. source: 'openalex'|'arxiv'|'semantic_scholar'|'both' (default both = OpenAlex + arXiv).",
  fetch_paper: "args: { identifier } - Fetch a paper by arXiv ID (e.g. '2301.07041'), DOI, or arXiv URL and ingest it into the session library for rag_query.",
  rag_query: "args: { question, limit?, tag? } - Query the internal RAG knowledge base.",
  semantic_search: "args: { query, limit?, tag? } - Search similar internal knowledge chunks.",
};

type SafePlatformToolName = keyof typeof SAFE_PLATFORM_TOOL_HANDLERS;
export type AgenticRuntimeClass = "strict_runtime" | "elevated_runtime";

export interface AgenticRuntimeInput {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  toolAgentId?: string | null;
  role?: string;
  runtimeId?: string;
  allowedTools?: string[];
  allowElevatedTools?: boolean;
  maxRounds?: number;
  maxToolCalls?: number;
  onTextDelta?: (delta: string) => void | Promise<void>;
  onToolCall?: (tool: string, args: Record<string, unknown>) => void | Promise<void>;
  onToolResult?: (tool: string, result: string) => void | Promise<void>;
  // Per-tool arg overrides applied at execution time — seat never sees these, they are injected silently.
  // e.g. { rag_query: { tag: "council:lib:abc123" } } forces every rag_query to that library.
  toolArgOverrides?: Record<string, Record<string, unknown>>;
}

export interface AgenticRuntimeResult {
  text: string;
  toolCalls: number;
  toolsUsed: string[];
  runtimeClass: AgenticRuntimeClass;
  allowedTools: string[];
  toolsRestricted: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface RuntimeToolSpec {
  allowed: string[];
  textToolGuide: string | null;
  nativeToolGuide: string | null;
  nativeTools: Anthropic.Tool[];
  httpToolNameMap: Map<string, string>;
  mcpToolNameMap: Map<string, string>;
}

function normalizeToolRefs(tools?: string[]): string[] {
  const normalized = (tools?.length ? tools : DEFAULT_SAFE_TOOLSET)
    .map((tool) => (typeof tool === "string" ? tool.trim() : ""))
    .filter(Boolean);
  return [...new Set(normalized)];
}

export function getAgenticRuntimeClass(model?: string): AgenticRuntimeClass {
  return isCodexModel(model) ? "elevated_runtime" : "strict_runtime";
}

function stripToolCallsForDisplay(text: string): string {
  let cleaned = text
    .replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, "")
    .replace(/<invoke\s+name="[^"]+">[\s\S]*?<\/invoke>/g, "");

  const danglingToolCall = cleaned.lastIndexOf("[TOOL_CALL]");
  if (danglingToolCall !== -1) {
    cleaned = cleaned.slice(0, danglingToolCall);
  }

  const danglingInvoke = cleaned.lastIndexOf("<invoke");
  if (danglingInvoke !== -1) {
    cleaned = cleaned.slice(0, danglingInvoke);
  }

  return cleaned;
}

function formatToolGuideLine(tool: string): string {
  if (SAFE_PLATFORM_TOOL_DOCS[tool]) {
    return `- ${tool} ${SAFE_PLATFORM_TOOL_DOCS[tool]}`;
  }
  if (tool.startsWith("http:")) {
    return `- ${tool} args: { path?, method?, body?, headers?, queryParams? } - Call an assigned HTTP integration.`;
  }
  if (tool.startsWith("mcp:")) {
    return `- ${tool} args: { ... } - Call an assigned MCP tool with its native schema.`;
  }
  return `- ${tool} args: { ... }`;
}

function buildTextToolGuide(allowedTools: string[]): string | null {
  if (!allowedTools.length) return null;
  return [
    "When you need a tool, emit exactly one JSON block in this format:",
    "[TOOL_CALL]",
    '{"tool":"tool_name","args":{"key":"value"}}',
    "[/TOOL_CALL]",
    "",
    "Only use tools from this allowlist:",
    ...allowedTools.map(formatToolGuideLine),
  ].join("\n");
}

function buildNativeToolGuide(allowedTools: string[]): string | null {
  if (!allowedTools.length) return null;
  return [
    "Available tools:",
    ...allowedTools.map(formatToolGuideLine),
  ].join("\n");
}

async function resolveHttpTools(toolAgentId: string, allowedTools: string[]) {
  const requestedNames = allowedTools
    .filter((tool) => tool.startsWith("http:"))
    .map((tool) => tool.slice(5));
  if (!requestedNames.length) {
    return { docs: [] as string[], nativeTools: [] as Anthropic.Tool[], nameMap: new Map<string, string>() };
  }

  const { rows } = await db.query(
    `SELECT t.name, t.description
     FROM tools t
     WHERE t.id::text IN (
       SELECT jsonb_array_elements_text(a.tool_ids) FROM agents a WHERE a.id = $1
     ) AND t.type = 'http' AND t.status = 'enabled' AND t.name = ANY($2::text[])
     ORDER BY t.name ASC`,
    [toolAgentId, requestedNames]
  );

  const docs: string[] = [];
  const nativeTools: Anthropic.Tool[] = [];
  const nameMap = new Map<string, string>();

  for (const row of rows as Array<{ name: string; description: string | null }>) {
    const safeName = `http_${row.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`.slice(0, 64);
    nameMap.set(safeName, row.name);
    docs.push(`- http:${row.name} args: { path?, method?, body?, headers?, queryParams? }${row.description ? ` - ${row.description}` : ""}`);
    nativeTools.push({
      name: safeName,
      description: `HTTP tool: ${row.name}${row.description ? ` - ${row.description}` : ""}`,
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Optional path appended to the base URL" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
          body: { type: "object", description: "Optional JSON body" },
          headers: { type: "object", description: "Optional request headers" },
          queryParams: { type: "object", description: "Optional query string parameters" },
        },
        required: [],
      },
    });
  }

  return { docs, nativeTools, nameMap };
}

async function resolveMcpTools(toolAgentId: string, allowedTools: string[]) {
  const requestedRefs = allowedTools.filter((tool) => tool.startsWith("mcp:"));
  if (!requestedRefs.length) {
    return { docs: [] as string[], nativeTools: [] as Anthropic.Tool[], nameMap: new Map<string, string>() };
  }

  const grouped = new Map<string, Set<string>>();
  for (const ref of requestedRefs) {
    const match = ref.match(/^mcp:([^:]+):(.+)$/);
    if (!match) continue;
    const [, serverId, toolName] = match;
    if (!grouped.has(serverId)) grouped.set(serverId, new Set());
    grouped.get(serverId)!.add(toolName);
  }

  if (!grouped.size) {
    return { docs: [] as string[], nativeTools: [] as Anthropic.Tool[], nameMap: new Map<string, string>() };
  }

  const serverIds = [...grouped.keys()];
  const { rows } = await db.query(
    `SELECT t.id, t.name, t.description, t.config
     FROM tools t
     WHERE t.id = ANY($1::uuid[])
       AND t.type = 'mcp'
       AND t.status = 'enabled'
       AND t.id::text IN (
         SELECT jsonb_array_elements_text(a.tool_ids) FROM agents a WHERE a.id = $2
       )`,
    [serverIds, toolAgentId]
  );

  const docs: string[] = [];
  const nativeTools: Anthropic.Tool[] = [];
  const nameMap = new Map<string, string>();

  for (const row of rows as Array<{ id: string; name: string; description: string | null; config: Record<string, unknown> }>) {
    const toolRecord: Tool = {
      id: row.id,
      name: row.name,
      type: "mcp",
      description: row.description ?? null,
      config: row.config,
      status: "enabled",
      createdAt: "",
      updatedAt: "",
    };
    const discovered = await listMCPTools(row.id, toolRecord).catch(() => []);
    const wanted = grouped.get(row.id) ?? new Set<string>();

    for (const subTool of discovered.filter((item) => wanted.has(item.name))) {
      const shortId = row.id.replace(/-/g, "").slice(0, 8);
      const safeName = `mcp_${shortId}_${subTool.name}`.slice(0, 64);
      const fullRef = `mcp:${row.id}:${subTool.name}`;
      nameMap.set(safeName, fullRef);
      docs.push(`- ${fullRef} args: { ... }${subTool.description ? ` - ${subTool.description}` : ""}`);
      nativeTools.push({
        name: safeName,
        description: `[MCP:${row.name}] ${subTool.description ?? subTool.name}`,
        input_schema: (subTool.inputSchema as Anthropic.Tool["input_schema"]) ?? {
          type: "object",
          properties: {},
          required: [],
        },
      });
    }
  }

  return { docs, nativeTools, nameMap };
}

async function resolveRuntimeTools(toolAgentId: string | null | undefined, allowedTools: string[]): Promise<RuntimeToolSpec> {
  const platformTools = allowedTools.filter((tool): tool is SafePlatformToolName => tool in SAFE_PLATFORM_TOOL_HANDLERS);
  const textGuideSections = [buildTextToolGuide(allowedTools)];
  const nativeGuideSections = [buildNativeToolGuide(allowedTools)];

  const nativeTools = ANTHROPIC_PLATFORM_TOOL_SCHEMAS
    .filter((tool) => platformTools.includes(tool.name as SafePlatformToolName))
    .map((tool) => tool as Anthropic.Tool);

  const httpToolNameMap = new Map<string, string>();
  const mcpToolNameMap = new Map<string, string>();

  if (toolAgentId) {
    const httpTools = await resolveHttpTools(toolAgentId, allowedTools);
    const mcpTools = await resolveMcpTools(toolAgentId, allowedTools);
    textGuideSections.push(
      httpTools.docs.length ? httpTools.docs.join("\n") : null,
      mcpTools.docs.length ? mcpTools.docs.join("\n") : null,
    );
    nativeGuideSections.push(
      httpTools.docs.length ? httpTools.docs.join("\n") : null,
      mcpTools.docs.length ? mcpTools.docs.join("\n") : null,
    );
    for (const [safeName, originalName] of httpTools.nameMap.entries()) {
      httpToolNameMap.set(safeName, originalName);
    }
    for (const [safeName, originalName] of mcpTools.nameMap.entries()) {
      mcpToolNameMap.set(safeName, originalName);
    }
    nativeTools.push(...httpTools.nativeTools, ...mcpTools.nativeTools);
  }

  return {
    allowed: allowedTools,
    textToolGuide: textGuideSections.filter(Boolean).join("\n\n") || null,
    nativeToolGuide: nativeGuideSections.filter(Boolean).join("\n\n") || null,
    nativeTools,
    httpToolNameMap,
    mcpToolNameMap,
  };
}

async function executeSafePlatformTool(tool: SafePlatformToolName, args: Record<string, unknown>) {
  return SAFE_PLATFORM_TOOL_HANDLERS[tool]("council", args, 0);
}

async function executeRuntimeTool(
  tool: string,
  args: Record<string, unknown>,
  toolAgentId: string | null | undefined,
  spec: RuntimeToolSpec,
) {
  if (tool in SAFE_PLATFORM_TOOL_HANDLERS) {
    return executeSafePlatformTool(tool as SafePlatformToolName, args);
  }
  if (tool.startsWith("http:")) {
    if (!toolAgentId) return "HTTP tools are unavailable because this council session has no owner agent.";
    return executeHttpTool(tool.slice(5), args, toolAgentId);
  }
  if (tool.startsWith("mcp:")) {
    if (!toolAgentId) return "MCP tools are unavailable because this council session has no owner agent.";
    return executeMCPTool(tool, args, toolAgentId);
  }
  if (spec.httpToolNameMap.has(tool)) {
    if (!toolAgentId) return "HTTP tools are unavailable because this council session has no owner agent.";
    return executeHttpTool(spec.httpToolNameMap.get(tool)!, args, toolAgentId);
  }
  if (spec.mcpToolNameMap.has(tool)) {
    if (!toolAgentId) return "MCP tools are unavailable because this council session has no owner agent.";
    return executeMCPTool(spec.mcpToolNameMap.get(tool)!, args, toolAgentId);
  }
  return `Tool "${tool}" is not supported inside council seats.`;
}

export async function runAgenticRuntime(input: AgenticRuntimeInput): Promise<AgenticRuntimeResult> {
  const model = input.model ?? "claude-sonnet-4-6";
  const role = input.role ?? "worker";
  const runtimeId = input.runtimeId ?? input.toolAgentId ?? `council:${role}`;
  const requestedTools = normalizeToolRefs(input.allowedTools);
  const runtimeClass = getAgenticRuntimeClass(model);
  const toolsRestricted = runtimeClass === "elevated_runtime" && requestedTools.length > 0 && input.allowElevatedTools !== true;
  const allowedTools = toolsRestricted ? [] : requestedTools;
  const toolSpec = await resolveRuntimeTools(input.toolAgentId, allowedTools);
  const maxRounds = input.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const maxToolCalls = input.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS;

  let assistantSegments: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  let totalToolCalls = 0;
  const toolsUsed = new Set<string>();
  let pendingSeparator = false;

  // Merge per-tool arg overrides (e.g. library tag injection) — overrides win over seat-supplied args.
  const withOverrides = (tool: string, args: Record<string, unknown>): Record<string, unknown> => {
    const overrides = input.toolArgOverrides?.[tool];
    return overrides ? { ...args, ...overrides } : args;
  };

  const emitTextDelta = async (delta: string) => {
    if (!delta) return;
    if (pendingSeparator) {
      pendingSeparator = false;
      await input.onTextDelta?.("\n\n");
    }
    await input.onTextDelta?.(delta);
  };

  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  const useNativeTools =
    toolSpec.nativeTools.length > 0 &&
    apiKey.length > 40 &&
    !isOllamaModel(model) &&
    !isGeminiModel(model) &&
    !isOpenAIModel(model) &&
    !isCodexModel(model);
  const toolGuide = useNativeTools ? toolSpec.nativeToolGuide : toolSpec.textToolGuide;
  const systemPrompt = [
    input.systemPrompt?.trim(),
    "You are an active council seat inside a multi-agent debate. Keep a distinct viewpoint and do not collapse into a generic neutral answer.",
    allowedTools.length > 0
      ? "If evidence is missing or disputed, use tools before concluding."
      : "No platform tools are available in this seat. Do not claim to have used tools unless tool results were actually returned in-chat.",
    "Prefer repo files, saved documents, and RAG knowledge before web search when the answer is likely internal.",
    toolsRestricted
      ? "This model runs in elevated_runtime mode. Per-seat tool allowlists are not treated as a hard safety boundary here, so external tools are disabled unless the seat is explicitly trusted."
      : null,
    allowedTools.length > 0
      ? "After receiving a tool result, your next response MUST explicitly reference at least one specific finding from that result (e.g. a paper title, a URL, a quoted passage, or a concrete data point). If the result was not useful, say so explicitly and explain what you concluded instead. Never silently ignore a tool result."
      : null,
    "If you used tools, cite the concrete URLs, files, or document titles you relied on under an 'Evidence' section.",
    toolGuide,
  ].filter(Boolean).join("\n\n");

  if (useNativeTools) {
    const sdkMessages: Anthropic.MessageParam[] = [
      { role: "user", content: input.prompt },
    ];

    for (let round = 0; round < maxRounds; round += 1) {
      await applyAgentRateLimit(runtimeId, role);

      const roundTextParts: string[] = [];
      const roundToolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
      let stopReason = "end_turn";

      for await (const event of streamClaudeWithNativeTools(sdkMessages, systemPrompt, model, toolSpec.nativeTools)) {
        if (event.type === "text") {
          roundTextParts.push(event.text);
          await emitTextDelta(event.text);
        } else if (event.type === "tool_use") {
          roundToolUses.push(event);
        } else if (event.type === "done") {
          stopReason = event.stopReason;
          totalInputTokens += event.usage.inputTokens;
          totalOutputTokens += event.usage.outputTokens;
          totalCostUsd += event.usage.costUsd;
        }
      }

      const roundText = roundTextParts.join("").trim();
      if (roundText) {
        assistantSegments.push(roundText);
      }

      if (stopReason !== "tool_use" || roundToolUses.length === 0 || totalToolCalls >= maxToolCalls) {
        break;
      }

      const assistantContent: Anthropic.ContentBlockParam[] = [];
      if (roundText) {
        assistantContent.push({ type: "text", text: roundText });
      }
      for (const toolUse of roundToolUses) {
        assistantContent.push({
          type: "tool_use",
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input,
        });
      }
      sdkMessages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of roundToolUses) {
        if (totalToolCalls >= maxToolCalls) break;
        totalToolCalls += 1;
        toolsUsed.add(toolUse.name);
        const effectiveInput = withOverrides(toolUse.name, toolUse.input);
        await input.onToolCall?.(toolUse.name, effectiveInput);
        const result = await executeRuntimeTool(toolUse.name, effectiveInput, input.toolAgentId, toolSpec);
        await input.onToolResult?.(toolUse.name, result);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.slice(0, 10000),
        });
      }

      if (!toolResults.length) break;
      sdkMessages.push({ role: "user", content: toolResults });
      pendingSeparator = roundText.length > 0;
    }
  } else {
    let loopPrompt = input.prompt;
    let loopMessages: OllamaMessage[] | undefined;

    if (isOllamaModel(model) || isGeminiModel(model) || isOpenAIModel(model) || isCodexModel(model)) {
      loopMessages = [];
      if (systemPrompt) loopMessages.push({ role: "system", content: systemPrompt });
      loopMessages.push({ role: "user", content: input.prompt });
    }

    for (let round = 0; round < maxRounds; round += 1) {
      await applyAgentRateLimit(runtimeId, role);

      let rawRoundText = "";
      let emittedVisibleText = "";
      const generator = streamLLM(loopPrompt, systemPrompt, model, loopMessages, (usage) => {
        totalInputTokens += usage.inputTokens;
        totalOutputTokens += usage.outputTokens;
        totalCostUsd += usage.costUsd;
      });

      for await (const delta of generator) {
        rawRoundText += delta;
        const visible = stripToolCallsForDisplay(rawRoundText);
        const deltaVisible = visible.slice(emittedVisibleText.length);
        if (deltaVisible) {
          emittedVisibleText = visible;
          await emitTextDelta(deltaVisible);
        }
      }

      const roundText = stripToolCallsForDisplay(rawRoundText).trim();
      if (roundText) {
        assistantSegments.push(roundText);
      }

      const toolCalls = parseToolCalls(rawRoundText);
      if (!toolCalls.length || totalToolCalls >= maxToolCalls) {
        break;
      }

      let toolResultsBlock = "";
      for (const toolCall of toolCalls) {
        if (totalToolCalls >= maxToolCalls) break;
        totalToolCalls += 1;
        toolsUsed.add(toolCall.tool);
        const effectiveArgs = withOverrides(toolCall.tool, toolCall.args);
        await input.onToolCall?.(toolCall.tool, effectiveArgs);
        const result = await executeRuntimeTool(toolCall.tool, effectiveArgs, input.toolAgentId, toolSpec);
        await input.onToolResult?.(toolCall.tool, result);
        toolResultsBlock += `\n[TOOL_RESULT tool="${toolCall.tool}"]\n${result}\n[/TOOL_RESULT]`;
      }

      if (!toolResultsBlock) break;

      if (isOllamaModel(model) || isGeminiModel(model) || isOpenAIModel(model) || isCodexModel(model)) {
        loopMessages = [
          ...(loopMessages ?? []),
          { role: "assistant", content: rawRoundText },
          { role: "user", content: `Tool execution results:${toolResultsBlock}\nContinue the analysis and cite concrete evidence.` },
        ];
      } else {
        loopPrompt += `\n\nAssistant:\n${rawRoundText}\n\nTool results:\n${toolResultsBlock}\nContinue the analysis and cite concrete evidence.`;
      }

      pendingSeparator = roundText.length > 0;
    }
  }

  return {
    text: assistantSegments.join("\n\n").trim(),
    toolCalls: totalToolCalls,
    toolsUsed: [...toolsUsed],
    runtimeClass,
    allowedTools,
    toolsRestricted,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    costUsd: totalCostUsd,
  };
}
