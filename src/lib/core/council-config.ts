import {
  DEFAULT_GEMMA_MODEL,
  DEFAULT_GEMMA_OLLAMA_MODEL,
} from "../llm/gemma-models";

export interface CouncilSeatLike {
  role: string;
  model: string;
}

export interface CouncilModelOption {
  value: string;
  label: string;
  provider: "Anthropic" | "OpenAI" | "Google" | "Ollama";
  toolMode: "native" | "text-loop";
}

export interface CouncilModelGroup {
  group: string;
  options: CouncilModelOption[];
}

export interface CouncilModelStrategyTemplate {
  id: string;
  label: string;
  description: string;
  note: string;
  moderatorModel: string;
  defaultSeatModel: string;
  preferredRoles?: Record<string, string>;
}

export const COUNCIL_MODEL_GROUPS: CouncilModelGroup[] = [
  {
    group: "Gemma",
    options: [
      { value: DEFAULT_GEMMA_MODEL, label: "Gemma 4 31B Instruct", provider: "Google", toolMode: "text-loop" },
    ],
  },
  {
    group: "Ollama",
    options: [
      { value: DEFAULT_GEMMA_OLLAMA_MODEL, label: "Ollama Gemma 4 31B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/gemma4:e4b", label: "Ollama Gemma 4 E4B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/gemma4:26b", label: "Ollama Gemma 4 26B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/gemma3:12b", label: "Ollama Gemma 3 12B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/gemma3:27b", label: "Ollama Gemma 3 27B", provider: "Ollama", toolMode: "text-loop" },
    ],
  },
];

export const COUNCIL_MODEL_OPTIONS = COUNCIL_MODEL_GROUPS.flatMap((group) => group.options);

export const COUNCIL_MODEL_STRATEGIES: CouncilModelStrategyTemplate[] = [
  {
    id: "fast_poc",
    label: "Fast POC",
    description: "Keep every seat and the moderator on hosted Gemma for a single-model baseline.",
    note: "Fastest way to pressure-test the debate flow without cross-provider variance.",
    moderatorModel: DEFAULT_GEMMA_MODEL,
    defaultSeatModel: DEFAULT_GEMMA_MODEL,
  },
  {
    id: "reliable_research",
    label: "Reliable Research",
    description: "Put every seat and the moderator on hosted Gemma for consistent review behavior.",
    note: "Best option when you want one stable hosted model across the full debate.",
    moderatorModel: DEFAULT_GEMMA_MODEL,
    defaultSeatModel: DEFAULT_GEMMA_MODEL,
  },
  {
    id: "hybrid_builder",
    label: "Hybrid Builder",
    description: "Use local Ollama Gemma for heavier seats and hosted Gemma for the rest.",
    note: "Good default when you want the entire panel to stay inside the Gemma family while still mixing hosted and local inference.",
    moderatorModel: DEFAULT_GEMMA_MODEL,
    defaultSeatModel: DEFAULT_GEMMA_MODEL,
    preferredRoles: {
      "Architect": DEFAULT_GEMMA_OLLAMA_MODEL,
      "Model Engineer": DEFAULT_GEMMA_OLLAMA_MODEL,
      "Product Strategist": DEFAULT_GEMMA_MODEL,
      "Growth Strategist": DEFAULT_GEMMA_MODEL,
      "Content Lead": DEFAULT_GEMMA_MODEL,
      "Performance Marketer": DEFAULT_GEMMA_MODEL,
      "Audience Researcher": DEFAULT_GEMMA_MODEL,
      "Skeptic": DEFAULT_GEMMA_MODEL,
      "Skeptic Reviewer": DEFAULT_GEMMA_MODEL,
      "Skeptic Operator": DEFAULT_GEMMA_MODEL,
      "Market Analyst": DEFAULT_GEMMA_MODEL,
      "Customer Voice": DEFAULT_GEMMA_MODEL,
      "Security Engineer": DEFAULT_GEMMA_MODEL,
      "Risk Manager": DEFAULT_GEMMA_MODEL,
      "Finance Lead": DEFAULT_GEMMA_MODEL,
    },
  },
];

export const DEFAULT_COUNCIL_MODEL_STRATEGY_ID = "reliable_research";

export function getCouncilModelOption(model: string): CouncilModelOption | undefined {
  return COUNCIL_MODEL_OPTIONS.find((option) => option.value === model);
}

export function getCouncilModelLabel(model: string): string {
  return getCouncilModelOption(model)?.label ?? model;
}

export function applyCouncilModelStrategy<T extends CouncilSeatLike>(
  seats: T[],
  strategyId: string,
): T[] {
  const strategy = COUNCIL_MODEL_STRATEGIES.find((item) => item.id === strategyId);
  if (!strategy) return seats;

  return seats.map((seat) => {
    const directMatch = strategy.preferredRoles?.[seat.role];
    const inferredMatch = !directMatch && /architect|engineer|developer|sre/i.test(seat.role)
      ? DEFAULT_GEMMA_OLLAMA_MODEL
      : undefined;
    const model = directMatch ?? inferredMatch ?? strategy.defaultSeatModel;
    return { ...seat, model };
  });
}
