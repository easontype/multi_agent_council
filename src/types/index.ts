// ─── Agent (re-exported from unified agent.ts) ────────────────────────────────
// AgentDB / AgentUI / Agent / AgentRole / AgentModel / agentToUI all live in
// agent.ts. This file re-exports them so existing `@/types` imports keep working.

export type { AgentRole, AgentModel, AgentDB, AgentUI, Agent } from "./agent";
export { agentToUI } from "./agent";

// ─── Tool (technical capability) ─────────────────────────────────────────────

export type ToolType =
  | "mcp"
  | "browser"
  | "code"
  | "scheduler"
  | "storage"
  | "http"
  | "database"
  | "memory"
  | "comfyui"
  | "n8n"
  | "image"
  | "video"
  | "other";

export type ToolStatus = "enabled" | "disabled";

export interface Tool {
  id: string;
  name: string;
  type: ToolType;
  description: string | null;
  config: Record<string, unknown>;
  status: ToolStatus;
  createdAt: string;
  updatedAt: string;
}
