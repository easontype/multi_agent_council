// ─── Unified Agent Types ──────────────────────────────────────────────────────
// Single source of truth for all Agent-related types.
// AgentDB  = full database model (from index.ts)
// AgentUI  = lightweight view model for Council UI (from council.ts)
// Agent    = alias for AgentDB (backwards compatibility)

// ─── AgentDB (full DB model) ──────────────────────────────────────────────────

export type AgentRole = "orchestrator" | "worker" | "both";
export type AgentModel = "claude" | "gemini" | "minimax" | "qwen" | string;

export interface AgentDB {
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

/** Backwards-compatible alias — prefer AgentDB for new code */
export type Agent = AgentDB;

// ─── AgentUI (lightweight Council view model) ────────────────────────────────

export interface AgentUI {
  id: string;
  name: string;
  role: string;
  seatRole: string;
  color: string;
  avatar: string;
}

// ─── Conversion helper ────────────────────────────────────────────────────────

/**
 * Convert a full DB agent to the lightweight UI model used by Council
 * components. Falls back to sensible defaults for fields that exist only in
 * the UI model.
 */
export function agentToUI(agent: AgentDB): AgentUI {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    seatRole: agent.role,
    color: "#6b7280",
    avatar: agent.name?.[0]?.toUpperCase() ?? "A",
  };
}
