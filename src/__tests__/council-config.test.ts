/**
 * Tests for council-config.ts — pure config helpers and model strategy logic.
 */

import {
  COUNCIL_MODEL_OPTIONS,
  COUNCIL_MODEL_GROUPS,
  COUNCIL_MODEL_STRATEGIES,
  DEFAULT_COUNCIL_MODEL_STRATEGY_ID,
  getCouncilModelOption,
  getCouncilModelLabel,
  applyCouncilModelStrategy,
} from "../lib/core/council-config";

// ─── COUNCIL_MODEL_OPTIONS ─────────────────────────────────────────────────────

describe("COUNCIL_MODEL_OPTIONS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(COUNCIL_MODEL_OPTIONS)).toBe(true);
    expect(COUNCIL_MODEL_OPTIONS.length).toBeGreaterThan(0);
  });

  it("every option has value, label, provider, and toolMode", () => {
    for (const option of COUNCIL_MODEL_OPTIONS) {
      expect(typeof option.value).toBe("string");
      expect(typeof option.label).toBe("string");
      expect(typeof option.provider).toBe("string");
      expect(["native", "text-loop"]).toContain(option.toolMode);
    }
  });

  it("contains at least one Ollama option", () => {
    expect(COUNCIL_MODEL_OPTIONS.some((o) => o.provider === "Ollama")).toBe(true);
  });

  it("contains at least one Google option", () => {
    expect(COUNCIL_MODEL_OPTIONS.some((o) => o.provider === "Google")).toBe(true);
  });

  it("is the flattened form of COUNCIL_MODEL_GROUPS", () => {
    const expected = COUNCIL_MODEL_GROUPS.flatMap((g) => g.options);
    expect(COUNCIL_MODEL_OPTIONS).toEqual(expected);
  });
});

// ─── getCouncilModelOption ─────────────────────────────────────────────────────

describe("getCouncilModelOption", () => {
  it("returns the matching option for a known model value", () => {
    const first = COUNCIL_MODEL_OPTIONS[0];
    const result = getCouncilModelOption(first.value);
    expect(result).toBeDefined();
    expect(result!.value).toBe(first.value);
  });

  it("returns undefined for an unknown model value", () => {
    expect(getCouncilModelOption("unknown-model-xyz")).toBeUndefined();
  });
});

// ─── getCouncilModelLabel ──────────────────────────────────────────────────────

describe("getCouncilModelLabel", () => {
  it("returns the label for a known model", () => {
    const first = COUNCIL_MODEL_OPTIONS[0];
    expect(getCouncilModelLabel(first.value)).toBe(first.label);
  });

  it("returns the raw model string for an unknown model", () => {
    expect(getCouncilModelLabel("my-custom-model")).toBe("my-custom-model");
  });

  it("returns empty string for empty input", () => {
    expect(getCouncilModelLabel("")).toBe("");
  });
});

// ─── COUNCIL_MODEL_STRATEGIES ──────────────────────────────────────────────────

describe("COUNCIL_MODEL_STRATEGIES", () => {
  it("contains at least 2 strategies", () => {
    expect(COUNCIL_MODEL_STRATEGIES.length).toBeGreaterThanOrEqual(2);
  });

  it("each strategy has required fields", () => {
    for (const strategy of COUNCIL_MODEL_STRATEGIES) {
      expect(typeof strategy.id).toBe("string");
      expect(typeof strategy.label).toBe("string");
      expect(typeof strategy.description).toBe("string");
      expect(typeof strategy.moderatorModel).toBe("string");
      expect(typeof strategy.defaultSeatModel).toBe("string");
    }
  });

  it("contains the default strategy ID", () => {
    const ids = COUNCIL_MODEL_STRATEGIES.map((s) => s.id);
    expect(ids).toContain(DEFAULT_COUNCIL_MODEL_STRATEGY_ID);
  });
});

// ─── applyCouncilModelStrategy ─────────────────────────────────────────────────

describe("applyCouncilModelStrategy", () => {
  const seats = [
    { role: "Architect", model: "old-model" },
    { role: "Skeptic", model: "old-model" },
  ];

  it("returns seats unchanged when strategy ID is unknown", () => {
    const result = applyCouncilModelStrategy(seats, "nonexistent-strategy");
    expect(result).toEqual(seats);
  });

  it("applies defaultSeatModel from the strategy when no preferredRoles match", () => {
    // "fast_poc" has no preferredRoles; use roles that don't trigger the inferred-match regex
    const plainSeats = [
      { role: "Skeptic", model: "old-model" },
      { role: "Finance Lead", model: "old-model" },
    ];
    const result = applyCouncilModelStrategy(plainSeats, "fast_poc");
    const strategy = COUNCIL_MODEL_STRATEGIES.find((s) => s.id === "fast_poc")!;
    for (const seat of result) {
      expect(seat.model).toBe(strategy.defaultSeatModel);
    }
  });

  it("preserves all other seat fields when applying strategy", () => {
    const result = applyCouncilModelStrategy(seats, "fast_poc");
    expect(result[0].role).toBe("Architect");
    expect(result[1].role).toBe("Skeptic");
  });

  it("applies preferredRoles override for hybrid_builder strategy", () => {
    const result = applyCouncilModelStrategy(seats, "hybrid_builder");
    const hybridStrategy = COUNCIL_MODEL_STRATEGIES.find((s) => s.id === "hybrid_builder")!;
    const architectResult = result.find((s) => s.role === "Architect");
    expect(architectResult!.model).toBe(hybridStrategy.preferredRoles!["Architect"]);
  });

  it("applies inferred Ollama model for SRE-like role names in hybrid_builder", () => {
    const seatWithSre = [{ role: "Senior SRE", model: "old-model" }];
    const result = applyCouncilModelStrategy(seatWithSre, "hybrid_builder");
    // /architect|engineer|developer|sre/i should match "SRE"
    expect(result[0].model).not.toBe("old-model");
  });

  it("does not mutate the original seats array", () => {
    const original = seats.map((s) => ({ ...s }));
    applyCouncilModelStrategy(seats, "fast_poc");
    expect(seats).toEqual(original);
  });

  it("handles empty seats array", () => {
    const result = applyCouncilModelStrategy([], "fast_poc");
    expect(result).toEqual([]);
  });
});
