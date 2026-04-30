import { sanitizeToolTextForDisplay } from "../lib/tools/display";

describe("sanitizeToolTextForDisplay", () => {
  it("removes complete tool-call blocks", () => {
    expect(
      sanitizeToolTextForDisplay('Before[TOOL_CALL]{"tool":"rag_query","args":{"question":"x"}}[/TOOL_CALL]After'),
    ).toBe("BeforeAfter");
  });

  it("hides dangling tool-call blocks", () => {
    expect(
      sanitizeToolTextForDisplay('Before[TOOL_CALL]{"tool":"rag_query"'),
    ).toBe("Before");
  });

  it("hides partial tool prefixes during streaming", () => {
    expect(sanitizeToolTextForDisplay("Answer starts [TOOL")).toBe("Answer starts ");
  });

  it("hides a single dangling bracket that starts a tool tag", () => {
    expect(sanitizeToolTextForDisplay("Answer starts [")).toBe("Answer starts ");
  });

  it("removes complete tool-result blocks", () => {
    expect(
      sanitizeToolTextForDisplay('Alpha[TOOL_RESULT tool="rag_query"]payload[/TOOL_RESULT]Omega'),
    ).toBe("AlphaOmega");
  });
});
