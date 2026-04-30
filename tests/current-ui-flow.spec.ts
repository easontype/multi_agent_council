import { expect, Page, test } from "@playwright/test";

const reviewSessionId = "session-ui-1";
const runningSessionId = "session-ui-2";

const sessionList = [
  {
    id: reviewSessionId,
    title: "Review: Attention Is All You Need",
    status: "concluded",
    created_at: "2026-04-17T10:00:00.000Z",
  },
  {
    id: runningSessionId,
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
    if (/Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/i.test(text)) {
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
  await page.route("**/api/sessions", async (route) => {
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
  await page.route("**/api/papers/upload", async (route) => {
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

  await page.route(`**/api/sessions/${reviewSessionId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: reviewSessionId,
          is_public: false,
        },
      }),
    });
  });

  await page.route(`**/api/sessions/${reviewSessionId}/run`, async (route) => {
    const sse = [
      'data: {"type":"session_start"}',
      'data: {"type":"turn_start","role":"Methods Critic","round":1}',
      'data: {"type":"turn_delta","role":"Methods Critic","delta":"The empirical case is strong, but ablation coverage is too thin."}',
      'data: {"type":"tool_call","role":"Methods Critic","tool":"fetch_paper","args":{"id":"1706.03762"}}',
      'data: {"type":"tool_result","role":"Methods Critic","tool":"fetch_paper","result":"Retrieved paper metadata and abstract.","sourceRefs":[{"label":"Attention Is All You Need","uri":"https://arxiv.org/abs/1706.03762","snippet":"Sequence transduction with pure attention."}]}',
      'data: {"type":"turn_done","turn":{"role":"Methods Critic","content":"**Position**\\nThe empirical case is strong, but ablation coverage is too thin."}}',
      'data: {"type":"turn_start","role":"Moderator","round":99}',
      'data: {"type":"turn_delta","role":"Moderator","delta":"Verdict: promising paper, but reviewers want stronger ablations before acceptance."}',
      'data: {"type":"turn_done","turn":{"role":"Moderator","content":"Verdict: promising paper, but reviewers want stronger ablations before acceptance."}}',
      'data: {"type":"conclusion","conclusion":{"summary":"Verdict: promising paper, but reviewers want stronger ablations before acceptance."}}',
      'data: {"type":"session_done"}',
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

async function mockRound2CitationApis(page: Page) {
  await page.route("**/api/papers/upload", async (route) => {
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

  await page.route(`**/api/sessions/${reviewSessionId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: reviewSessionId,
          is_public: false,
        },
      }),
    });
  });

  await page.route(`**/api/sessions/${reviewSessionId}/run`, async (route) => {
    const sse = [
      'data: {"type":"session_start"}',
      'data: {"type":"round_start","round":1}',
      'data: {"type":"turn_start","role":"Methods Critic","round":1}',
      'data: {"type":"turn_delta","role":"Methods Critic","delta":"Initial critique."}',
      'data: {"type":"turn_done","turn":{"role":"Methods Critic","content":"**Position**\\nInitial critique.\\n\\n**Key Assumptions**\\n- The reported gains are stable.\\n\\n**Main Risks**\\n- Ablations remain thin.\\n\\n**Strongest Counterargument**\\nThe architecture is still materially novel."}}',
      'data: {"type":"round_start","round":2}',
      'data: {"type":"turn_start","role":"Methods Critic","round":2}',
      'data: {"type":"tool_call","role":"Methods Critic","tool":"rag_query","args":{"question":"Which paper is being discussed?"}}',
      'data: {"type":"tool_result","role":"Methods Critic","tool":"rag_query","result":"Evidence:\\n[1] Attention Is All You Need | https://arxiv.org/abs/1706.03762","sourceRefs":[{"marker":"[1]","label":"Attention Is All You Need","uri":"https://arxiv.org/abs/1706.03762","snippet":null}]}',
      'data: {"type":"turn_delta","role":"Methods Critic","delta":"Round 2 critique."}',
      'data: {"type":"turn_done","turn":{"role":"Methods Critic","content":"**Challenge**\\nThe paper still lacks convincing ablation depth.\\n\\n**Stance**\\nMy Round 1 position is unchanged pending stronger controlled comparisons.\\n\\n**Evidence**\\n[1] Attention Is All You Need"}}',
      'data: {"type":"turn_start","role":"Moderator","round":99}',
      'data: {"type":"turn_done","turn":{"role":"Moderator","content":"Synthesis complete."}}',
      'data: {"type":"conclusion","conclusion":{"summary":"Synthesis complete."}}',
      'data: {"type":"session_done"}',
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

async function mockSavedSessionApis(page: Page) {
  await page.route(`**/api/sessions/${reviewSessionId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: reviewSessionId,
          title: "Review: Attention Is All You Need",
          topic: "Attention Is All You Need",
          context: "A canonical Transformer paper.",
          goal: null,
          status: "concluded",
          rounds: 1,
          moderator_model: "gemini-3.1-flash-lite-preview",
          seats: [
            { role: "Methods Critic", model: "gemini-3.1-flash-lite-preview", systemPrompt: "Critique methods." },
            { role: "Literature Auditor", model: "gemini-3.1-flash-lite-preview", systemPrompt: "Check related work." },
          ],
          workspace_id: "ws-1",
          created_by_user_id: "user-1",
          owner_agent_id: null,
          owner_api_key_id: null,
          created_at: "2026-04-17T10:00:00.000Z",
          started_at: "2026-04-17T10:01:00.000Z",
          heartbeat_at: "2026-04-17T10:03:00.000Z",
          concluded_at: "2026-04-17T10:05:00.000Z",
          last_error: null,
          run_attempts: 1,
          updated_at: "2026-04-17T10:05:00.000Z",
          divergence_level: "moderate",
          is_public: false,
        },
        turns: [
          {
            id: "turn-c-1",
            session_id: reviewSessionId,
            round: 1,
            role: "Methods Critic",
            model: "gemini-3.1-flash-lite-preview",
            content: "**Position**\nThe ablation coverage is too thin for a top-tier methods claim.",
            input_tokens: 120,
            output_tokens: 88,
            created_at: "2026-04-17T10:02:00.000Z",
          },
          {
            id: "turn-c-2",
            session_id: reviewSessionId,
            round: 99,
            role: "Moderator",
            model: "gemini-3.1-flash-lite-preview",
            content: "{\"summary\":\"Strong core idea, but the review panel wants clearer ablation support.\"}",
            input_tokens: 100,
            output_tokens: 60,
            created_at: "2026-04-17T10:04:00.000Z",
          },
        ],
        conclusion: {
          id: "conclusion-c-1",
          session_id: reviewSessionId,
          summary: "Strong core idea, but the review panel wants clearer ablation support.",
          consensus: null,
          dissent: null,
          action_items: [],
          veto: null,
          confidence: "medium",
          confidence_reason: null,
          created_at: "2026-04-17T10:05:00.000Z",
        },
        evidence: [
          {
            id: "evidence-c-1",
            session_id: reviewSessionId,
            round: 1,
            role: "Methods Critic",
            model: "gemini-3.1-flash-lite-preview",
            tool: "rag_query",
            runtime_class: "strict_runtime",
            status: "completed",
            args: { query: "ablation coverage" },
            result: "Retrieved relevant sections from the paper.",
            source_refs: [
              {
                label: "Attention Is All You Need",
                uri: "https://arxiv.org/abs/1706.03762",
                snippet: "Transformer ablations cover major architectural choices.",
              },
            ],
            created_at: "2026-04-17T10:01:20.000Z",
            updated_at: "2026-04-17T10:01:40.000Z",
          },
        ],
      }),
    });
  });

  await page.route(`**/api/sessions/${runningSessionId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: runningSessionId,
          title: "Review: Improving Language Understanding by Generative Pre-Training",
          topic: "Improving Language Understanding by Generative Pre-Training",
          context: "GPT-style pretraining paper.",
          goal: null,
          status: "running",
          rounds: 1,
          moderator_model: "gemini-3.1-flash-lite-preview",
          seats: [
            { role: "Methods Critic", model: "gemini-3.1-flash-lite-preview", systemPrompt: "Critique methods." },
          ],
          workspace_id: "ws-1",
          created_by_user_id: "user-1",
          owner_agent_id: null,
          owner_api_key_id: null,
          created_at: "2026-04-18T00:15:00.000Z",
          started_at: "2026-04-18T00:16:00.000Z",
          heartbeat_at: "2026-04-18T00:17:00.000Z",
          concluded_at: null,
          last_error: null,
          run_attempts: 1,
          updated_at: "2026-04-18T00:17:00.000Z",
          divergence_level: null,
          is_public: false,
        },
        turns: [
          {
            id: "turn-r-1",
            session_id: runningSessionId,
            round: 1,
            role: "Methods Critic",
            model: "gemini-3.1-flash-lite-preview",
            content: "**Position**\nThe framing is strong, but the replication details are still incomplete.",
            input_tokens: 90,
            output_tokens: 70,
            created_at: "2026-04-18T00:16:30.000Z",
          },
        ],
        conclusion: null,
        evidence: [],
      }),
    });
  });

  await page.route(`**/api/sessions/${runningSessionId}/run`, async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ resume: true });

    const sse = [
      'data: {"type":"turn_start","role":"Moderator","round":99}',
      'data: {"type":"moderator_delta","delta":"Saved run resumed and reached a final synthesis."}',
      'data: {"type":"conclusion","conclusion":{"summary":"Saved run resumed and reached a final synthesis."}}',
      'data: {"type":"session_done"}',
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

test("landing page can hand off a PDF upload to analyze setup", async ({
  page,
}) => {
  const errors = installErrorCollector(page);
  await mockAnalyzeApis(page);

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "draft-paper.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%EOF"),
  });

  await expect(page).toHaveURL(/\/analyze$/);
  await expect(page.getByText("draft-paper").first()).toBeVisible();
  await expect(page.getByText("Uploaded PDF - draft-paper.pdf").first()).toBeVisible();

  await page.getByRole("button", { name: /^Start Review$/i }).click();
  await expect(page.getByText("The empirical case is strong, but ablation coverage is too thin.")).toBeVisible();
  await expect(page.getByText("Review concluded")).toBeVisible();

  await expectNoClientErrors(errors);
});

test("round 2 compare view and source panel render citations without snippets", async ({
  page,
}) => {
  const errors = installErrorCollector(page);
  await mockRound2CitationApis(page);

  await page.goto("/");
  const landingInput = page.getByPlaceholder(/arXiv ID e\.g\./i);
  await landingInput.fill("1706.03762");
  await page.getByRole("button", { name: /critique/i }).click();

  await expect(page).toHaveURL(/\/analyze\?arxiv=1706\.03762$/);
  await page.getByRole("button", { name: /^Start Review$/i }).click();

  await expect(page.getByText("The paper still lacks convincing ablation depth.")).toBeVisible();
  await expect(page.getByRole("button", { name: /\[1\] Attention Is All You Need/i })).toBeVisible();
  await expect(page.locator("span").filter({ hasText: "[1] Attention Is All You Need" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Compare" }).click();
  await page.getByRole("button", { name: "Round 2" }).click();
  await expect(page.getByText("The paper still lacks convincing ablation depth.")).toBeVisible();
  await page.getByRole("button", { name: "Stance" }).click();
  await expect(page.getByText("My Round 1 position is unchanged pending stronger controlled comparisons.")).toBeVisible();
  await page.getByRole("button", { name: "Evidence" }).click();
  await expect(page.getByRole("button", { name: /\[1\] Attention Is All You Need/i })).toBeVisible();

  await expectNoClientErrors(errors);
});

test("saved review navigation restores the selected review session", async ({
  page,
}) => {
  const errors = installErrorCollector(page);
  await mockDashboardApis(page);
  await mockSavedSessionApis(page);

  await page.goto("/login");
  await loginAsDevAdmin(page);

  await page.getByRole("link", { name: "Reviews", exact: true }).click();
  await expect(page).toHaveURL(/\/home\/reviews$/);
  await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();
  await expect(page.getByText("Attention Is All You Need")).toBeVisible();

  await page.getByText("Attention Is All You Need").click();
  await expect(page).toHaveURL(new RegExp(`/analyze\\?session=${reviewSessionId}$`));
  await expect(page.getByText("Restored from the saved review link.")).toBeVisible();
  await expect(page.getByText("The ablation coverage is too thin for a top-tier methods claim.")).toBeVisible();
  await expect(page.getByText("Strong core idea, but the review panel wants clearer ablation support.")).toBeVisible();
  await expect(page.getByText("Divergence level recorded as moderate.")).toBeVisible();

  await expectNoClientErrors(errors);
});

test("running saved review offers resume and reconnects the live stream", async ({
  page,
}) => {
  const errors = installErrorCollector(page);
  await mockDashboardApis(page);
  await mockSavedSessionApis(page);

  await page.goto("/login");
  await loginAsDevAdmin(page);

  await page.goto(`/analyze?session=${runningSessionId}`);
  await expect(page.getByText("Restored from the saved review link.")).toBeVisible();
  await expect(page.getByRole("button", { name: /resume live stream/i })).toBeVisible();
  await expect(page.getByText("The framing is strong, but the replication details are still incomplete.")).toBeVisible();

  await page.getByRole("button", { name: /resume live stream/i }).click();
  await expect(page.getByText("Saved run resumed and reached a final synthesis.")).toBeVisible();
  await expect(page.getByText("Review concluded")).toBeVisible();

  await expectNoClientErrors(errors);
});
