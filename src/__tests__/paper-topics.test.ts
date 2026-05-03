import {
  DEFAULT_CUSTOM_TOPIC_GOAL,
  resolvePaperTopicSelection,
} from "@/lib/paper-topics";

describe("resolvePaperTopicSelection", () => {
  it("returns the fixed topic and goal for a preset", () => {
    const result = resolvePaperTopicSelection({ topicPresetId: "methodology" });

    expect(result.topicPresetId).toBe("methodology");
    expect(result.topic).toBe("Methodological soundness of the research design");
    expect(result.goal).toBe("Identify design flaws, confounds, or gaps in the methodology.");
  });

  it("uses a custom topic and fallback goal for custom mode", () => {
    const result = resolvePaperTopicSelection({
      topicPresetId: "custom",
      topic: "Whether the benchmark setup is fair",
      goal: "",
    });

    expect(result.topicPresetId).toBe("custom");
    expect(result.topic).toBe("Whether the benchmark setup is fair");
    expect(result.goal).toBe(DEFAULT_CUSTOM_TOPIC_GOAL);
  });
});
