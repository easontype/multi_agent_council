import { expect, Page, test } from "@playwright/test";

const reviewSessionId = "session-ui-1";

const sessionList = [
  {
    id: reviewSessionId,
    title: "Review: Attention Is All You Need",
    status: "concluded",
    created_at: "2026-04-17T10:00:00.000Z",
  },
  {
    id: "session-ui-2",
    title: "Review: Improving Language Understanding by Generative Pre-Training",
    status: "running",
    created_at: "2026-04-18T00:15:00.000Z",
  },
];

const paperResults = [
  {
    title: "Attention Is All You Need",
    abstract:
      "We propose the Transformer, a sequence transduction model based entirely on attention.",
    year: 2017,
    authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
    arxivId: "1706.03762",
    doi: null,
    pdfUrl: "https://arxiv.org/pdf/1706.03762.pdf",
    citationCount: 123456,
    source: "arxiv",
  },
];

function installErrorCollector(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/favicon|Failed to load resource: the server responded with a status of 404/i.test(text)) {
      return;
    }
    consoleErrors.push(text);
  });

  return { pageErrors, consoleErrors };
}

async function expectNoClientErrors(collected: ReturnType<typeof installErrorCollector>) {
  expect(collected.pageErrors, "Unexpected browser page errors").toEqual([]);
  expect(collected.consoleErrors, "Unexpected browser console errors").toEqual([]);
}

async function mockDashboardApis(page: Page) {
  await page.route("**/api/council", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sessionList),
    });
  });

  await page.route("**/api/search/papers**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(paperResults),
    });
  });
}

async function mockAnalyzeApis(page: Page) {
  await page.route("**/api/analyze/web", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: reviewSessionId,
        paperTitle: "Attention Is All You Need",
        paperAbstract:
          "The Transformer replaces recurrence with attention and enables efficient sequence modeling.",
      }),
    });
  });

  await page.route(`**/api/council/${reviewSessionId}/run`, async (route) => {
    const sse = [
      'data: {"type":"session_start"}',
      'data: {"type":"turn_start","role":"Methods Critic","round":1}',
      'data: {"type":"turn_delta","role":"Methods Critic","delta":"The empirical case is strong, but ablation coverage is too thin."}',
      'data: {"type":"tool_call","role":"Methods Critic","tool":"fetch_paper","args":{"id":"1706.03762"}}',
      'data: {"type":"tool_result","role":"Methods Critic","tool":"fetch_paper","result":"Retrieved paper metadata and abstract.","sourceRefs":[{"label":"Attention Is All You Need","uri":"https://arxiv.org/abs/1706.03762","snippet":"Sequence transduction with pure attention."}]}',
      'data: {"type":"turn_done","turn":{"role":"Methods Critic"}}',
      'data: {"type":"turn_start","role":"Moderator","round":99}',
      'data: {"type":"turn_delta","role":"Moderator","delta":"Verdict: promising paper, but reviewers want stronger ablations before acceptance."}',
      'data: {"type":"turn_done","turn":{"role":"Moderator"}}',
      "",
    ].join("\n");

    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: sse,
    });
  });
}

async function loginAsDevAdmin(page: Page) {
  await page.getByPlaceholder("admin@council.local").fill("admin@council.local");

  for (const password of ["dev-password", "admin123"]) {
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: /sign in with credentials/i }).click();
    try {
      await expect(page).toHaveURL(/\/home$/, { timeout: 5000 });
      return;
    } catch {
      // Try the next local credential candidate.
    }
  }

  throw new Error("Unable to sign in with known local credential candidates.");
}

test("protected home redirects to login, and authenticated dashboard search reaches analyze", async ({
  page,
}) => {
  const errors = installErrorCollector(page);
  await mockDashboardApis(page);

  await page.goto("/home");
  await expect(page).toHaveURL(/\/login\?redirectTo=/);
  await expect(page.getByRole("button", { name: /sign in with credentials/i })).toBeVisible();

  await loginAsDevAdmin(page);
  await expect(page.getByText("Recent Reviews")).toBeVisible();
  await expect(page.getByText("Attention Is All You Need")).toBeVisible();

  const searchInput = page.getByPlaceholder(/Search papers/i);
  await searchInput.fill("1706.03762");
  await searchInput.press("Enter");

  await expect(page.getByText("Attention Is All You Need").first()).toBeVisible();
  await page.getByRole("button", { name: /start review/i }).click();
  await expect(page).toHaveURL(/\/analyze\?arxiv=1706\.03762$/);
  await expect(page.getByRole("button", { name: /start review/i })).toBeVisible();

  await expectNoClientErrors(errors);
});

test("landing page can start a mocked review run and render streamed debate output", async ({
  page,
}) => {
  const errors = installErrorCollector(page);
  await mockAnalyzeApis(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Get honest feedback on/i })).toBeVisible();

  const landingInput = page.getByPlaceholder(/arXiv ID e\.g\./i);
  await landingInput.fill("1706.03762");
  await page.getByRole("button", { name: /critique/i }).click();

  await expect(page).toHaveURL(/\/analyze\?arxiv=1706\.03762$/);
  await page.getByRole("button", { name: /^Start Review$/i }).click();

  await expect(page.getByText("The empirical case is strong, but ablation coverage is too thin.")).toBeVisible();
  await expect(page.getByText(/Verdict: promising paper/i)).toBeVisible();
  await expect(page.getByText("Attention Is All You Need").first()).toBeVisible();
  await expect(page.getByText("Panel discussion concluded")).toBeVisible();
  await expect(page.getByText("Review concluded")).toBeVisible();
  await expect(page.getByText("cited by Methods Critic")).toBeVisible();

  await expectNoClientErrors(errors);
});

test("saved review navigation currently drops session context instead of reopening the selected review", async ({
  page,
}) => {
  const errors = installErrorCollector(page);
  await mockDashboardApis(page);

  await page.goto("/login");
  await loginAsDevAdmin(page);

  await page.getByRole("link", { name: /reviews/i }).click();
  await expect(page).toHaveURL(/\/home\/reviews$/);
  await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();
  await expect(page.getByText("Attention Is All You Need")).toBeVisible();

  await page.getByText("Attention Is All You Need").click();
  await expect(page).toHaveURL(/\/analyze$/);
  await expect(page.getByText("Ready to begin")).toBeVisible();
  await expect(page.getByText("Attention Is All You Need")).not.toBeVisible();

  await expectNoClientErrors(errors);
});
