import { expect, test, type Page } from "@playwright/test";

const sessionId = "session-visual-regression";

const seats = [
  "Methods Critic",
  "Literature Auditor",
  "Replication Skeptic",
  "Contribution Evaluator",
  "Constructive Advocate",
].map((role) => ({
  role,
  model: "gemma-4-31b-it",
  prompt: `Review from the perspective of ${role}.`,
  tools: ["rag_query"],
  allowElevatedTools: false,
  library_id: "paper:test-lib",
}));

const concludedBundle = {
  session: {
    id: sessionId,
    title: "Review: Attention Is All You Need",
    topic: "Academic paper review: Attention Is All You Need",
    context: "Library ID: paper:test-lib",
    goal: "Provide a comprehensive peer review verdict.",
    status: "concluded",
    rounds: 1,
    moderator_model: "gemma-4-31b-it",
    seats,
    owner_agent_id: null,
    owner_api_key_id: null,
    created_at: "2026-04-14T10:00:00.000Z",
    started_at: "2026-04-14T10:00:10.000Z",
    heartbeat_at: "2026-04-14T10:00:20.000Z",
    concluded_at: "2026-04-14T10:02:00.000Z",
    last_error: null,
    run_attempts: 1,
    updated_at: "2026-04-14T10:02:00.000Z",
    divergence_level: "moderate",
  },
  turns: [
    {
      id: "turn-methods",
      session_id: sessionId,
      round: 1,
      role: "Methods Critic",
      model: "gemma-4-31b-it",
      content:
        "The paper makes a strong architectural claim, but the ablation story still needs sharper isolation of which components drive the gains.",
      input_tokens: 412,
      output_tokens: 188,
      created_at: "2026-04-14T10:00:11.000Z",
    },
    {
      id: "turn-literature",
      session_id: sessionId,
      round: 1,
      role: "Literature Auditor",
      model: "gemma-4-31b-it",
      content:
        "The positioning against recurrent and convolutional baselines is compelling, and the contribution clearly stands out relative to prior sequence modeling work.",
      input_tokens: 398,
      output_tokens: 164,
      created_at: "2026-04-14T10:00:16.000Z",
    },
    {
      id: "turn-replication",
      session_id: sessionId,
      round: 1,
      role: "Replication Skeptic",
      model: "gemma-4-31b-it",
      content:
        "Reproducibility remains the main concern because optimization details, training schedules, and a few implementation choices are under-specified.",
      input_tokens: 421,
      output_tokens: 176,
      created_at: "2026-04-14T10:00:22.000Z",
    },
  ],
  conclusion: {
    id: "conclusion-visual",
    session_id: sessionId,
    summary:
      "The committee sees a substantial and field-shaping contribution, but wants clearer empirical support and replication detail before treating the paper as fully airtight.",
    consensus:
      "The transformer architecture is novel, important, and likely publication-worthy given its broad impact and conceptual clarity.",
    dissent:
      "The main disagreement is whether the experimental evidence is already sufficient without stronger ablations and fuller training disclosure.",
    action_items: [
      "Add tighter ablations for the core attention design choices.",
      "Document optimization and training settings needed for replication.",
      "Clarify which empirical gains come from architecture versus scale.",
    ],
    veto: null,
    confidence: "medium",
    confidence_reason: "The idea is strong, but empirical rigor concerns remain open.",
    created_at: "2026-04-14T10:02:00.000Z",
  },
  evidence: [],
};

const screenshotOptions = {
  animations: "disabled",
  caret: "hide",
  scale: "css",
} as const;

async function stubCouncilFlow(page: Page) {
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

  await page.route("**/api/sessions", async (route) => {
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

  await page.route(`**/api/sessions/${sessionId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(concludedBundle),
    });
  });
}

test.describe("Council visual regression", () => {
  test.use({
    viewport: { width: 1440, height: 1200 },
    colorScheme: "light",
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
  });

  test.beforeEach(async ({ page }) => {
    await stubCouncilFlow(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("captures landing, analyze, and results screens", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.mouse.move(1, 1);

    await expect(page.getByRole("heading", { name: /Get honest feedback on/i })).toBeVisible();
    await expect(page).toHaveScreenshot("council-landing.png", screenshotOptions);

    await page.getByPlaceholder("arXiv ID e.g. 2301.07041").fill("1706.03762");
    await page.getByRole("button", { name: /critique/i }).click();

    await expect(page).toHaveURL(/\/analyze\?arxiv=1706\.03762$/);
    await expect(page.getByRole("heading", { name: "New Peer Review" })).toBeVisible();
    await expect(page).toHaveScreenshot("council-analyze.png", screenshotOptions);

    await page.getByRole("button", { name: "Start Review Committee" }).click();

    await expect(page).toHaveURL(new RegExp(`/results/${sessionId}$`));
    await expect(page.getByText("Moderator Verdict")).toBeVisible();
    await expect(page.getByText("CONCLUDED")).toBeVisible();
    await expect(page).toHaveScreenshot("council-results.png", screenshotOptions);
  });
});
