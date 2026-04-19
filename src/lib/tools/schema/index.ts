// ── Schema barrel — assembles all tool schemas and re-exports ─────────────────

export type { AnthropicTool } from "./shared";
export { ORCHESTRATE_MAX_TURNS, ACP_PROTOCOL } from "./shared";

export { WEB_TOOL_SCHEMAS } from "./web";
export { PAPER_TOOL_SCHEMAS } from "./paper";
export { RAG_TOOL_SCHEMAS } from "./rag";
export { PLATFORM_TOOL_SCHEMAS } from "./platform";
export { PLATFORM_TOOL_SCHEMA, CTO_ORCHESTRATOR_SCHEMA } from "./prompts";

import { PLATFORM_TOOL_SCHEMAS } from "./platform";
import { WEB_TOOL_SCHEMAS } from "./web";
import { PAPER_TOOL_SCHEMAS } from "./paper";
import { RAG_TOOL_SCHEMAS } from "./rag";

// Assembled array used by the SDK-based tool calling path (agentic-runtime etc.)
export const ANTHROPIC_PLATFORM_TOOL_SCHEMAS = [
  ...PLATFORM_TOOL_SCHEMAS,
  ...WEB_TOOL_SCHEMAS,
  ...PAPER_TOOL_SCHEMAS,
  ...RAG_TOOL_SCHEMAS,
];
