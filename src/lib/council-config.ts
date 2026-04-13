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
    group: "Claude",
    options: [
      { value: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "Anthropic", toolMode: "native" },
      { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "Anthropic", toolMode: "native" },
      { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "Anthropic", toolMode: "native" },
      { value: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet", provider: "Anthropic", toolMode: "native" },
    ],
  },
  {
    group: "OpenAI / Codex",
    options: [
      { value: "codex/codex", label: "Codex", provider: "OpenAI", toolMode: "text-loop" },
      { value: "codex/o3", label: "Codex o3", provider: "OpenAI", toolMode: "text-loop" },
      { value: "gpt-4o", label: "GPT-4o", provider: "OpenAI", toolMode: "text-loop" },
      { value: "o3", label: "o3", provider: "OpenAI", toolMode: "text-loop" },
      { value: "o4-mini", label: "o4-mini", provider: "OpenAI", toolMode: "text-loop" },
    ],
  },
  {
    group: "Gemini",
    options: [
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google", toolMode: "text-loop" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google", toolMode: "text-loop" },
      { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "Google", toolMode: "text-loop" },
      { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite Preview", provider: "Google", toolMode: "text-loop" },
    ],
  },
  {
    group: "Ollama",
    options: [
      { value: "ollama/gemma4:e4b", label: "Ollama Gemma 4 E4B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/gemma4:26b", label: "Ollama Gemma 4 26B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/gemma4:31b", label: "Ollama Gemma 4 31B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/gemma3:12b", label: "Ollama Gemma 3 12B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/gemma3:27b", label: "Ollama Gemma 3 27B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/qwen2.5:14b", label: "Ollama Qwen 2.5 14B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/qwen2.5:32b", label: "Ollama Qwen 2.5 32B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/qwen2.5-coder:7b", label: "Ollama Qwen 2.5 Coder 7B", provider: "Ollama", toolMode: "text-loop" },
      { value: "ollama/llama3.1:8b", label: "Ollama Llama 3.1 8B", provider: "Ollama", toolMode: "text-loop" },
    ],
  },
];

export const COUNCIL_MODEL_OPTIONS = COUNCIL_MODEL_GROUPS.flatMap((group) => group.options);

export const COUNCIL_MODEL_STRATEGIES: CouncilModelStrategyTemplate[] = [
  {
    id: "fast_poc",
    label: "Fast POC",
    description: "Keep every seat on Codex and use Claude Opus only as moderator.",
    note: "Fastest way to pressure-test debate flow. Seat tools still use text-loop mode.",
    moderatorModel: "claude-opus-4-6",
    defaultSeatModel: "codex/codex",
  },
  {
    id: "reliable_research",
    label: "Reliable Research",
    description: "Put every seat on Claude Sonnet and reserve Claude Opus for final synthesis.",
    note: "Best option when you want higher trust in tool use and citations. Claude seats can use native tools when ANTHROPIC_API_KEY is available.",
    moderatorModel: "claude-opus-4-6",
    defaultSeatModel: "claude-sonnet-4-6",
  },
  {
    id: "hybrid_builder",
    label: "Hybrid Builder",
    description: "Use Codex for build-oriented roles and Claude Sonnet for review, risk, and market seats.",
    note: "Good default for repo-heavy debates where engineering seats need speed but reviewer seats need more reliable evidence gathering.",
    moderatorModel: "claude-opus-4-6",
    defaultSeatModel: "claude-sonnet-4-6",
    preferredRoles: {
      "Architect": "codex/codex",
      "Model Engineer": "codex/codex",
      "Product Strategist": "claude-sonnet-4-6",
      "Growth Strategist": "claude-sonnet-4-6",
      "Content Lead": "claude-sonnet-4-6",
      "Performance Marketer": "claude-sonnet-4-6",
      "Audience Researcher": "claude-sonnet-4-6",
      "Skeptic": "claude-sonnet-4-6",
      "Skeptic Reviewer": "claude-sonnet-4-6",
      "Skeptic Operator": "claude-sonnet-4-6",
      "Market Analyst": "claude-sonnet-4-6",
      "Customer Voice": "claude-sonnet-4-6",
      "Security Engineer": "claude-sonnet-4-6",
      "Risk Manager": "claude-sonnet-4-6",
      "Finance Lead": "claude-sonnet-4-6",
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
      ? "codex/codex"
      : undefined;
    const model = directMatch ?? inferredMatch ?? strategy.defaultSeatModel;
    return { ...seat, model };
  });
}
