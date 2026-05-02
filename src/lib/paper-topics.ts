export interface PaperTopicPreset {
  id: "methodology" | "novelty" | "reproducibility" | "statistics" | "impact" | "custom";
  label: string;
  topic: string;
  goal: string;
}

export const PAPER_TOPIC_PRESETS: PaperTopicPreset[] = [
  {
    id: "methodology",
    label: "Methodology",
    topic: "Methodological soundness of the research design",
    goal: "Identify design flaws, confounds, or gaps in the methodology.",
  },
  {
    id: "novelty",
    label: "Novelty",
    topic: "Novelty and contribution relative to prior art",
    goal: "Assess whether the claims genuinely exceed the state of the art.",
  },
  {
    id: "reproducibility",
    label: "Reproducibility",
    topic: "Reproducibility and experimental rigor",
    goal: "Evaluate whether results can be independently replicated.",
  },
  {
    id: "statistics",
    label: "Statistics",
    topic: "Statistical validity and analytical soundness",
    goal: "Check for p-hacking, underpowered samples, or misused tests.",
  },
  {
    id: "impact",
    label: "Impact",
    topic: "Practical impact and real-world deployment readiness",
    goal: "Determine whether the approach is ready for production use.",
  },
  {
    id: "custom",
    label: "Custom",
    topic: "",
    goal: "",
  },
];

export const DEFAULT_CUSTOM_TOPIC_GOAL =
  "Provide rigorous multi-perspective academic critique of the selected topic.";

export function resolvePaperTopicSelection(input: {
  topicPresetId?: string | null;
  topic?: string | null;
  goal?: string | null;
}) {
  const preset = PAPER_TOPIC_PRESETS.find((item) => item.id === input.topicPresetId) ?? null;
  const rawTopic = (input.topic ?? "").trim();
  const rawGoal = (input.goal ?? "").trim();

  if (preset && preset.id !== "custom") {
    return {
      topicPresetId: preset.id,
      topic: preset.topic,
      goal: preset.goal,
    };
  }

  return {
    topicPresetId: "custom" as const,
    topic: rawTopic,
    goal: rawGoal || DEFAULT_CUSTOM_TOPIC_GOAL,
  };
}
