// ─── Agent ───────────────────────────────────────────────────────────────────

export type AgentRole = "orchestrator" | "worker" | "both";
export type AgentModel = "claude" | "gemini" | "minimax" | "qwen" | string;

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  systemPrompt: string | null;
  primaryModel: AgentModel;
  fallbackModels: string[];
  toolIds: string[];
  skillIds: string[];
  role: AgentRole;
  contextWindow: number;
  config: Record<string, unknown>;
  enabled: boolean;
  parentId: string | null;
  parentName?: string | null;
  parentConfig?: Record<string, unknown> | null;
  heartbeatEnabled?: boolean;
  heartbeatIntervalMin?: number;
  heartbeatModel?: string;
  lastHeartbeatAt?: string | null;
  canvasX?: number | null;
  canvasY?: number | null;
  createdAt: string;
  updatedAt: string;
}

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
