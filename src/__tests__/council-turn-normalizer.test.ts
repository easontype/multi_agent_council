/**
 * Tests for council-turn-normalizer.ts — pure text transformation functions.
 * All exports are pure (no LLM/DB/network).
 */

import { normalizeSeatTurnContent } from "../lib/prompts/council-turn-normalizer";

// ─── Round 1 normalization ─────────────────────────────────────────────────────

describe("normalizeSeatTurnContent — round 1", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeSeatTurnContent("", 1)).toBe("");
  });

  it("includes all four headings in output", () => {
    const content = `
**Position**
We should adopt microservices.

**Key Assumptions**
- Teams are independent
- Services can be deployed separately

**Main Risks**
- Network latency
- Distributed transactions

**Strongest Counterargument**
Monoliths are simpler to reason about.

**Evidence**
- Paper A: https://example.com/a
`;
    const result = normalizeSeatTurnContent(content, 1);
    expect(result).toContain("**Position**");
    expect(result).toContain("**Key Assumptions**");
    expect(result).toContain("**Main Risks**");
    expect(result).toContain("**Strongest Counterargument**");
    expect(result).toContain("**Evidence**");
  });

  it("fills in fallback text when sections are missing", () => {
    const result = normalizeSeatTurnContent("Just a plain paragraph with no sections.", 1);
    expect(result).toContain("**Position**");
    expect(result).toContain("**Key Assumptions**");
  });

  it("preserves position content from structured input", () => {
    const content = `**Position**\nMicroservices scale better.\n\n**Key Assumptions**\n- Cloud native\n\n**Main Risks**\n- Cost\n\n**Strongest Counterargument**\nMonolith is simpler.\n`;
    const result = normalizeSeatTurnContent(content, 1);
    expect(result).toContain("Microservices scale better.");
  });

  it("respects word budget of 400 words", () => {
    const bigContent = `**Position**\n${"word ".repeat(500)}\n\n**Key Assumptions**\n- A\n\n**Main Risks**\n- B\n\n**Strongest Counterargument**\n${"x ".repeat(200)}`;
    const result = normalizeSeatTurnContent(bigContent, 1);
    const wordCount = result.trim().split(/\s+/).filter(Boolean).length;
    // Should be at or under 400 (accounting for heading words in the budget)
    expect(wordCount).toBeLessThanOrEqual(420);
  });

  it("formats assumptions as bullet list", () => {
    const content = `**Position**\nStay monolith.\n\n**Key Assumptions**\n- Assumption one\n- Assumption two\n\n**Main Risks**\n- Risk\n\n**Strongest Counterargument**\nCounter.`;
    const result = normalizeSeatTurnContent(content, 1);
    expect(result).toContain("- Assumption one");
  });

  it("caps assumptions at 3 items", () => {
    const content = `**Position**\nX.\n\n**Key Assumptions**\n- A1\n- A2\n- A3\n- A4\n- A5\n\n**Main Risks**\n- R\n\n**Strongest Counterargument**\nC.`;
    const result = normalizeSeatTurnContent(content, 1);
    const bulletLines = result.split("\n").filter((l) => l.startsWith("- "));
    // 3 assumptions + 1 risk + 1 evidence fallback = 5 max bullets visible after Position heading
    // Just verify A4/A5 are not present
    expect(result).not.toContain("A4");
    expect(result).not.toContain("A5");
  });
});

// ─── Round 2 normalization ─────────────────────────────────────────────────────

describe("normalizeSeatTurnContent — round 2", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeSeatTurnContent("", 2)).toBe("");
  });

  it("includes Challenge and Stance headings", () => {
    const content = `**Challenge**\nSeat X's claim is wrong.\n\n**Stance**\nI maintain my position.`;
    const result = normalizeSeatTurnContent(content, 2);
    expect(result).toContain("**Challenge**");
    expect(result).toContain("**Stance**");
  });

  it("respects 220-word budget", () => {
    const bigContent = `**Challenge**\n${"word ".repeat(300)}\n\n**Stance**\n${"word ".repeat(100)}`;
    const result = normalizeSeatTurnContent(bigContent, 2);
    const wordCount = result.trim().split(/\s+/).filter(Boolean).length;
    expect(wordCount).toBeLessThanOrEqual(240);
  });

  it("falls back gracefully when sections are missing", () => {
    const result = normalizeSeatTurnContent("No sections here, just plain text.", 2);
    expect(result).toContain("**Challenge**");
    expect(result).toContain("**Stance**");
  });

  it("captures challenge content from structured input", () => {
    const content = `**Challenge**\nArchitect ignored network cost.\n\n**Stance**\nI hold my position.`;
    const result = normalizeSeatTurnContent(content, 2);
    expect(result).toContain("Architect ignored network cost.");
  });

  it("includes Evidence heading", () => {
    const content = `**Challenge**\nX is wrong.\n\n**Stance**\nHold.\n\n**Evidence**\n- https://source.com`;
    const result = normalizeSeatTurnContent(content, 2);
    expect(result).toContain("**Evidence**");
  });
});

// ─── Other rounds passthrough ──────────────────────────────────────────────────

describe("normalizeSeatTurnContent — other rounds", () => {
  it("returns content as-is for rounds other than 1 or 2", () => {
    const input = "Some raw content for round 3.";
    expect(normalizeSeatTurnContent(input, 3)).toBe(input);
  });

  it("still trims whitespace for other rounds", () => {
    const result = normalizeSeatTurnContent("   trimmed   ", 3);
    expect(result).toBe("trimmed");
  });
});
