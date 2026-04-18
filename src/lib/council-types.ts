/**
 * council-types.ts — Shared interfaces, types, and constants for the Council debate engine.
 */

import type { AgenticRuntimeClass } from "./agentic-runtime";

// Reserved round number for the moderator synthesis turn.
// Must be higher than any realistic debate round count.
export const MODERATOR_ROUND = 99;

export interface CouncilSeat {
  role: string;
  model: string;
  systemPrompt: string;
  bias?: string;
  tools?: string[];
  allowElevatedTools?: boolean;
  library_id?: string;
}

export interface DivergenceReport {
  level: "none" | "low" | "moderate" | "high";
  summary: string;
  proceed_to_round2: boolean;
}

export type CouncilSessionStatus = "pending" | "running" | "concluded" | "failed";

export interface CouncilSession {
  id: string;
  title: string;
  topic: string;
  context: string | null;
  goal: string | null;
  status: CouncilSessionStatus;
  rounds: number;
  moderator_model: string;
  seats: CouncilSeat[];
  owner_agent_id: string | null;
  created_at: string;
  started_at: string | null;
  heartbeat_at: string | null;
  concluded_at: string | null;
  last_error: string | null;
  run_attempts: number;
  updated_at: string | null;
  divergence_level?: string | null;
  is_public: boolean;
}

export interface CouncilTurn {
  id: string;
  session_id: string;
  round: number;
  role: string;
  model: string;
  content: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

export interface CouncilConclusion {
  id: string;
  session_id: string;
  summary: string;
  consensus: string | null;
  dissent: string | null;
  action_items: string[];
  veto: string | null;
  confidence: "high" | "medium" | "low" | null;
  confidence_reason: string | null;
  created_at: string;
}

export interface CouncilEvidenceSource {
  label: string;
  uri: string | null;
  snippet: string | null;
}

export interface CouncilEvidence {
  id: string;
  session_id: string;
  round: number;
  role: string;
  model: string;
  tool: string;
  runtime_class: AgenticRuntimeClass;
  status: "requested" | "completed" | "failed";
  args: Record<string, unknown>;
  result: string;
  source_refs: CouncilEvidenceSource[];
  created_at: string;
  updated_at: string | null;
}

export interface CouncilPlanInput {
  topic: string;
  context?: string;
  goal?: string;
  preferredModel?: string;
  maxSeats?: number;
}

export interface CouncilPlan {
  shouldUseCouncil: boolean;
  template: "architecture" | "growth" | "business" | "general";
  complexity: "low" | "medium" | "high";
  title: string;
  rounds: number;
  moderator_model: string;
  seats: CouncilSeat[];
  reasoning: string[];
}

export interface CouncilCreateInput {
  title?: string;
  topic: string;
  context?: string;
  goal?: string;
  rounds?: number;
  moderator_model?: string;
  seats?: CouncilSeat[];
  preferredModel?: string;
  maxSeats?: number;
  autoPlan?: boolean;
  ownerAgentId?: string;
  ownerUserEmail?: string;
  accessTokenHash?: string;
}

export interface CouncilRunOptions {
  resume?: boolean;
  forceRestart?: boolean;
  staleAfterMs?: number;
}

export type CouncilEvent =
  | { type: "session_start"; sessionId: string }
  | { type: "round_start"; round: number }
  | { type: "turn_start"; round: number; role: string; model: string }
  | { type: "turn_delta"; round: number; role: string; delta: string }
  | { type: "tool_call"; round: number; role: string; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; round: number; role: string; tool: string; result: string; sourceRefs?: CouncilEvidenceSource[]; runtimeClass?: AgenticRuntimeClass }
  | { type: "turn_done"; turn: CouncilTurn }
  | { type: "moderator_start" }
  | { type: "moderator_delta"; delta: string }
  | { type: "conclusion"; conclusion: CouncilConclusion }
  | { type: "session_done"; sessionId: string }
  | { type: "divergence_check"; level: DivergenceReport["level"]; summary: string; proceed_to_round2: boolean }
  | { type: "round2_skipped"; reason: string }
  | { type: "high_divergence_warning"; message: string }
  | { type: "error"; message: string };

export type CouncilEventHandler = (event: CouncilEvent) => void;
