/**
 * Tests for council-prompts.ts — pure functions only (no LLM/DB/network)
 */

import {
  buildDebateBrief,
  buildRound1Prompt,
  buildRound2Prompt,
  buildModeratorPrompt,
  extractFirstJsonObject,
  normalizeConclusion,
  cleanSnippet,
  extractLineSnippet,
  buildSeat,
  buildSeatRuntimePrompt,
} from "../lib/prompts/council-prompts";

// ─── buildDebateBrief ──────────────────────────────────────────────────────────

describe("buildDebateBrief", () => {
  it("includes the topic", () => {
    const brief = buildDebateBrief({ topic: "Should we migrate to PostgreSQL?", context: "", goal: "" });
    expect(brief).toContain("Should we migrate to PostgreSQL?");
  });

  it("includes context when provided", () => {
    const brief = buildDebateBrief({ topic: "Pricing", context: "We charge $10/mo", goal: "" });
    expect(brief).toContain("We charge $10/mo");
  });

  it("includes goal when provided", () => {
    const brief = buildDebateBrief({ topic: "Pricing", context: "", goal: "Hit $1M ARR" });
    expect(brief).toContain("Hit $1M ARR");
  });

  it("omits context section when context is empty", () => {
    const brief = buildDebateBrief({ topic: "Topic", context: "", goal: "" });
    expect(brief).not.toContain("Context:");
  });

  it("omits goal section when goal is empty", () => {
    const brief = buildDebateBrief({ topic: "Topic", context: "", goal: "" });
    expect(brief).not.toContain("Decision goal:");
  });
});

// ─── buildRound1Prompt ─────────────────────────────────────────────────────────

describe("buildRound1Prompt", () => {
  it("mentions round 1", () => {
    const prompt = buildRound1Prompt({ topic: "Test", context: "", goal: "" });
    expect(prompt).toContain("round 1");
  });

  it("includes Position section instruction", () => {
    const prompt = buildRound1Prompt({ topic: "Test", context: "", goal: "" });
    expect(prompt).toContain("Position");
  });

  it("includes word limit guidance", () => {
    const prompt = buildRound1Prompt({ topic: "Test", context: "", goal: "" });
    expect(prompt).toContain("400 words");
  });

  it("includes the topic in the output", () => {
    const prompt = buildRound1Prompt({ topic: "Migration risk", context: "", goal: "" });
    expect(prompt).toContain("Migration risk");
  });
});

// ─── buildRound2Prompt ─────────────────────────────────────────────────────────

describe("buildRound2Prompt", () => {
  const session = { topic: "AI adoption", context: "", goal: "" };
  const round1Turns = [
    { role: "Architect", content: "We should adopt AI", round: 1, id: "1", session_id: "s1", created_at: "" },
    { role: "Skeptic", content: "Risk is too high", round: 1, id: "2", session_id: "s1", created_at: "" },
  ];

  it("includes round 1 positions", () => {
    const prompt = buildRound2Prompt(session, round1Turns);
    expect(prompt).toContain("Round 1 positions");
  });

  it("includes each seat's round 1 content", () => {
    const prompt = buildRound2Prompt(session, round1Turns);
    expect(prompt).toContain("Architect");
    expect(prompt).toContain("Skeptic");
  });

  it("includes 220-word limit", () => {
    const prompt = buildRound2Prompt(session, round1Turns);
    expect(prompt).toContain("220 words");
  });

  it("includes round 2 turns already made when provided", () => {
    const round2TurnsSoFar = [
      { role: "Architect", content: "I still stand by my view", round: 2, id: "3", session_id: "s1", created_at: "" },
    ];
    const prompt = buildRound2Prompt(session, round1Turns, round2TurnsSoFar);
    expect(prompt).toContain("already argued");
    expect(prompt).toContain("I still stand by my view");
  });

  it("omits round 2 section when no turns provided", () => {
    const prompt = buildRound2Prompt(session, round1Turns, []);
    expect(prompt).not.toContain("already argued");
  });
});

// ─── extractFirstJsonObject ────────────────────────────────────────────────────

describe("extractFirstJsonObject", () => {
  it("extracts a simple JSON object", () => {
    const result = extractFirstJsonObject('{"key": "value"}');
    expect(result).toBe('{"key": "value"}');
  });

  it("extracts JSON embedded in prose", () => {
    const result = extractFirstJsonObject('Here is the result: {"confidence":"high"} done');
    expect(JSON.parse(result!)).toEqual({ confidence: "high" });
  });

  it("strips markdown code fences", () => {
    const result = extractFirstJsonObject('```json\n{"a":1}\n```');
    expect(JSON.parse(result!)).toEqual({ a: 1 });
  });

  it("returns null when no JSON object found", () => {
    expect(extractFirstJsonObject("no json here")).toBeNull();
  });

  it("handles nested objects", () => {
    const input = '{"outer": {"inner": 42}}';
    const result = extractFirstJsonObject(input);
    expect(JSON.parse(result!)).toEqual({ outer: { inner: 42 } });
  });

  it("handles escaped quotes inside strings", () => {
    const input = '{"msg": "say \\"hello\\""}';
    const result = extractFirstJsonObject(input);
    expect(JSON.parse(result!)).toEqual({ msg: 'say "hello"' });
  });
});

// ─── normalizeConclusion ───────────────────────────────────────────────────────

describe("normalizeConclusion", () => {
  it("parses a valid JSON conclusion", () => {
    const raw = JSON.stringify({
      summary: "All agree.",
      consensus: "Use the new approach.",
      dissent: null,
      action_items: [{ action: "Deploy to staging", priority: "blocking" }],
      veto: null,
      confidence: "high",
      confidence_reason: "All seats had evidence.",
    });
    const result = normalizeConclusion(raw);
    expect(result.summary).toBe("All agree.");
    expect(result.confidence).toBe("high");
    expect(result.action_items[0].action).toBe("Deploy to staging");
    expect(result.action_items[0].priority).toBe("blocking");
  });

  it("falls back gracefully on invalid JSON", () => {
    const result = normalizeConclusion("not json at all");
    expect(result.summary).toBe("not json at all");
    expect(result.confidence).toBeNull();
  });

  it("sets confidence to null for unknown value", () => {
    const raw = JSON.stringify({ summary: "x", confidence: "extreme" });
    expect(normalizeConclusion(raw).confidence).toBeNull();
  });

  it("parses dissent array correctly", () => {
    const raw = JSON.stringify({
      summary: "Mixed.",
      dissent: [{ question: "Is it safe?", seats: { Skeptic: "No", Architect: "Yes" } }],
      action_items: [],
      confidence: "medium",
    });
    const result = normalizeConclusion(raw);
    expect(result.dissent).toHaveLength(1);
    expect(result.dissent![0].question).toBe("Is it safe?");
    expect(result.dissent![0].seats["Skeptic"]).toBe("No");
  });

  it("converts legacy string dissent to wrapped array", () => {
    const raw = JSON.stringify({ summary: "x", dissent: "Unresolved tension.", action_items: [] });
    const result = normalizeConclusion(raw);
    expect(result.dissent).toHaveLength(1);
    expect(result.dissent![0].question).toBe("Unresolved tension.");
  });

  it("returns empty action_items when field is missing", () => {
    const raw = JSON.stringify({ summary: "x", confidence: "low" });
    expect(normalizeConclusion(raw).action_items).toEqual([]);
  });
});

// ─── cleanSnippet ──────────────────────────────────────────────────────────────

describe("cleanSnippet", () => {
  it("returns null for empty string", () => {
    expect(cleanSnippet("")).toBeNull();
  });

  it("collapses multiple spaces", () => {
    const result = cleanSnippet("hello   world");
    expect(result).toBe("hello world");
  });

  it("truncates long text to default 220 chars", () => {
    const long = "a".repeat(300);
    const result = cleanSnippet(long)!;
    expect(result.length).toBe(220);
    expect(result.endsWith("...")).toBe(true);
  });

  it("respects custom max length", () => {
    const result = cleanSnippet("hello world this is a test", 10)!;
    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBe(10);
  });

  it("returns full text when under max", () => {
    expect(cleanSnippet("short text")).toBe("short text");
  });
});

// ─── buildSeat ────────────────────────────────────────────────────────────────

describe("buildSeat", () => {
  it("creates a seat with the given role and model", () => {
    const seat = buildSeat("Architect", "You are an architect.", "gemma");
    expect(seat.role).toBe("Architect");
    expect(seat.model).toBe("gemma");
    expect(seat.systemPrompt).toBe("You are an architect.");
  });

  it("includes bias when provided", () => {
    const seat = buildSeat("Skeptic", "You are skeptical.", "gemma", { bias: "Always doubt." });
    expect(seat.bias).toBe("Always doubt.");
  });

  it("includes tools when provided", () => {
    const seat = buildSeat("Analyst", "Analyse data.", "gemma", { tools: ["web_search"] });
    expect(seat.tools).toContain("web_search");
  });

  it("does not include tools when tools array is empty", () => {
    const seat = buildSeat("Analyst", "Analyse data.", "gemma", { tools: [] });
    expect(seat.tools).toBeUndefined();
  });

  it("does not include tools when options are not provided", () => {
    const seat = buildSeat("Analyst", "Analyse data.", "gemma");
    expect(seat.tools).toBeUndefined();
  });
});

// ─── buildSeatRuntimePrompt ───────────────────────────────────────────────────

describe("buildSeatRuntimePrompt", () => {
  const seat = {
    role: "Architect",
    model: "gemma",
    systemPrompt: "You are an architect.",
    bias: "Bias toward boring designs.",
  };

  it("includes the seat's system prompt", () => {
    const prompt = buildSeatRuntimePrompt(seat);
    expect(prompt).toContain("You are an architect.");
  });

  it("includes the seat's bias", () => {
    const prompt = buildSeatRuntimePrompt(seat);
    expect(prompt).toContain("Bias toward boring designs.");
  });

  it("mentions other seats when allSeats is provided", () => {
    const allSeats = [
      seat,
      { role: "Skeptic", model: "gemma", systemPrompt: "You are skeptical." },
    ];
    const prompt = buildSeatRuntimePrompt(seat, allSeats);
    expect(prompt).toContain("Skeptic");
  });

  it("does not mention other seats when allSeats is not provided", () => {
    const prompt = buildSeatRuntimePrompt(seat);
    expect(prompt).not.toContain("other seats");
  });

  it("instructs not to capitulate to social pressure indirectly via maintain", () => {
    const prompt = buildSeatRuntimePrompt(seat);
    expect(prompt).toContain("Maintain this point of view");
  });
});
