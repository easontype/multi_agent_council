import { expect, test } from "@playwright/test";

const sessionId = "session-ui-test";

const seats = [
  { role: "Methods Critic", model: "gemma-4-31b-it" },
  { role: "Literature Auditor", model: "gemma-4-31b-it" },
  { role: "Replication Skeptic", model: "gemma-4-31b-it" },
  { role: "Contribution Evaluator", model: "gemma-4-31b-it" },
  { role: "Constructive Advocate", model: "gemma-4-31b-it" },
];

function buildSession(status: "pending" | "concluded") {
  return {
    session: {
      id: sessionId,
      title: "Review: Attention Is All You Need",
      topic: "Academic paper review: Attention Is All You Need",
      context: "Library ID: paper:test-lib",
      goal: "Provide a comprehensive peer review verdict.",
      status,
      rounds: 2,
      moderator_model: "gemma-4-31b-it",
      seats: seats.map((seat) => ({
        ...seat,
        prompt: `Review from the perspective of ${seat.role}.`,
        tools: ["rag_query"],
        allowElevatedTools: false,
        library_id: "paper:test-lib",
      })),
      owner_agent_id: null,
      created_at: "2026-04-14T10:00:00.000Z",
      started_at: "2026-04-14T10:00:10.000Z",
      heartbeat_at: "2026-04-14T10:00:20.000Z",
      concluded_at: status === "concluded" ? "2026-04-14T10:02:00.000Z" : null,
      last_error: null,
      run_attempts: 1,
      updated_at: "2026-04-14T10:02:00.000Z",
      divergence_level: "moderate",
    },
    turns: [],
    conclusion: null,
    evidence: [],
  };
}

function createTurn(round: number, role: string, content: string, createdAt: string) {
  return {
    id: `${round}-${role.toLowerCase().replace(/\s+/g, "-")}`,
    session_id: sessionId,
    round,
    role,
    model: "gemma-4-31b-it",
    content,
    input_tokens: 120,
    output_tokens: 80,
    created_at: createdAt,
  };
}

function createRunStream() {
  const round1 = [
    {
      role: "Methods Critic",
      content: "The experimental framing is clear, but ablations around attention head utility are thin.",
    },
    {
      role: "Literature Auditor",
      content: "The related work section is strong for its era, though later scaling work would need comparison.",
    },
    {
      role: "Replication Skeptic",
      content: "Training details are mostly present, but some optimization choices still need tighter disclosure.",
    },
    {
      role: "Contribution Evaluator",
      content: "The paper makes a genuinely important architectural contribution with broad downstream impact.",
    },
    {
      role: "Constructive Advocate",
      content: "The narrative is persuasive and the central mechanism is easy to reason about and extend.",
    },
  ];

  const round2 = [
    {
      role: "Methods Critic",
      content: "After cross-examination, I still want stronger ablations, but the core causal claim is credible.",
    },
    {
      role: "Literature Auditor",
      content: "I agree the novelty holds, and the paper positions itself well against recurrent baselines.",
    },
    {
      role: "Replication Skeptic",
      content: "I remain cautious on reproducibility, though the implementation path is much clearer than average.",
    },
    {
      role: "Contribution Evaluator",
      content: "The committee disagreement is mostly about execution detail rather than the significance of the idea.",
    },
    {
      role: "Constructive Advocate",
      content: "The work is accept-worthy with revision requests focused on empirical support and release details.",
    },
  ];

  const events: Array<Record<string, unknown>> = [
    { type: "session_start", sessionId },
    { type: "round_start", round: 1 },
  ];

  round1.forEach((turn, index) => {
    events.push(
      { type: "turn_start", round: 1, role: turn.role, model: "gemma-4-31b-it" },
      { type: "turn_delta", round: 1, role: turn.role, delta: turn.content },
      { type: "turn_done", turn: createTurn(1, turn.role, turn.content, `2026-04-14T10:00:${10 + index}.000Z`) },
    );
  });

  events.push(
    {
      type: "divergence_check",
      level: "moderate",
      summary: "Reviewers agree on significance but differ on the strength of empirical support.",
      proceed_to_round2: true,
    },
    { type: "round_start", round: 2 },
  );

  round2.forEach((turn, index) => {
    events.push(
      { type: "turn_start", round: 2, role: turn.role, model: "gemma-4-31b-it" },
      { type: "turn_delta", round: 2, role: turn.role, delta: turn.content },
      { type: "turn_done", turn: createTurn(2, turn.role, turn.content, `2026-04-14T10:01:${10 + index}.000Z`) },
    );
  });

  events.push(
    { type: "moderator_start" },
    {
      type: "moderator_delta",
      delta:
        "The committee supports acceptance with revisions focused on reproducibility and ablation coverage.",
    },
    {
      type: "conclusion",
      conclusion: {
        id: "conclusion-ui-test",
        session_id: sessionId,
        summary:
          "The paper is novel and influential, but reviewers want clearer empirical support and reproducibility detail.",
        consensus:
          "The transformer contribution is substantial and the paper is suitable for acceptance after revision.",
        dissent:
          "The strongest concern is that several implementation and ablation details are still under-specified.",
        action_items: [
          "Add stronger ablations around attention components.",
          "Clarify optimization and training details needed for replication.",
        ],
        veto: null,
        confidence: "medium",
        confidence_reason: "The idea is strong, but empirical rigor questions remain.",
        created_at: "2026-04-14T10:02:00.000Z",
      },
    },
    { type: "session_done", sessionId },
  );

  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}

test("completes the primary paper review flow from landing page to verdict", async ({ page }) => {
  let sessionFetchCount = 0;

  await page.route("**/api/papers/ingest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        documentId: "doc-test",
        libraryId: "paper:test-lib",
        title: "Attention Is All You Need",
        wordCount: 4200,
        source: "https://arxiv.org/pdf/1706.03762",
      }),
    });
  });

  await page.route("**/api/council", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: sessionId }),
    });
  });

  await page.route(`**/api/council/${sessionId}`, async (route) => {
    sessionFetchCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildSession(sessionFetchCount === 1 ? "pending" : "concluded")),
    });
  });

  await page.route(`**/api/council/${sessionId}/run`, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
      body: createRunStream(),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /honest feedback|peer review|council/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Critique" })).toBeDisabled();

  await page.getByPlaceholder("arXiv ID e.g. 2301.07041").fill("1706.03762");
  await expect(page.getByRole("button", { name: "Critique" })).toBeEnabled();
  await page.getByRole("button", { name: "Critique" }).click();

  await expect(page).toHaveURL(/\/analyze\?arxiv=1706\.03762$/);
  await expect(page.getByRole("heading", { name: "New Peer Review" })).toBeVisible();
  await expect(page.getByPlaceholder("e.g. 2301.07041 or arxiv:2301.07041")).toHaveValue("1706.03762");

  await page.getByRole("button", { name: "Start Review Committee" }).click();

  await expect(page).toHaveURL(new RegExp(`/results/${sessionId}$`));
  await expect(page.getByText("Methods Critic")).toBeVisible();
  await expect(page.getByText("Literature Auditor")).toBeVisible();
  await expect(page.getByText("Moderator Verdict")).toBeVisible();
  await expect(page.getByText("MEDIUM CONFIDENCE")).toBeVisible();
  await expect(page.getByText("ROUND 2")).toBeVisible();
  await expect(
    page.getByText(
      "The paper is novel and influential, but reviewers want clearer empirical support and reproducibility detail.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Add stronger ablations around attention components.")).toBeVisible();
  await expect(page.getByText("CONCLUDED")).toBeVisible();
});
