import type { CouncilSession } from "@/lib/core/council-types";
import { buildDraftPrefillFromSession } from "@/lib/review-draft-prefill";

describe("buildDraftPrefillFromSession", () => {
  it("preserves the session topic and goal for duplicate-as-new", () => {
    const session: CouncilSession = {
      id: "sess-1",
      title: "Attention Is All You Need",
      topic: "Novelty and contribution relative to prior art",
      context: "Source: https://arxiv.org/pdf/1706.03762.pdf. Library: paper:abc",
      goal: "Assess whether the claims genuinely exceed the state of the art.",
      paper_asset_id: "asset-1",
      status: "concluded",
      rounds: 2,
      moderator_model: "gemma-4-31b-it",
      seats: [
        { role: "Methods Critic", model: "gemma-4-31b-it", systemPrompt: "Test prompt" },
      ],
      workspace_id: null,
      created_by_user_id: null,
      owner_agent_id: null,
      owner_api_key_id: null,
      created_at: new Date().toISOString(),
      started_at: null,
      heartbeat_at: null,
      concluded_at: null,
      last_error: null,
      run_attempts: 0,
      updated_at: null,
      divergence_level: null,
      is_public: false,
    };

    const prefill = buildDraftPrefillFromSession(session);

    expect(prefill.topicPresetId).toBe("custom");
    expect(prefill.topic).toBe(session.topic);
    expect(prefill.goal).toBe(session.goal);
    expect(prefill.arxivId).toBe("1706.03762");
  });
});
