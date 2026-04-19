import { expect, test } from "@playwright/test";
import { runAgenticRuntime } from "../src/lib/agentic-runtime";
import { runLLM, streamLLM } from "../src/lib/claude";
import { runCouncilSession, runModeratorTurn } from "../src/lib/council";
import { db } from "../src/lib/db";
import { parseToolCalls } from "../src/lib/tools/parser";
import { normalizeSeatTurnContent } from "../src/lib/council-turn-normalizer";
import { buildBoundedModeratorPrompt, buildBoundedRound2Prompt } from "../src/lib/council-bounded-prompts";
import type { CouncilConclusion, CouncilEvent, CouncilSession, CouncilTurn } from "../src/lib/council-types";

type MockFetchCall = {
  url: string;
  body: Record<string, unknown> | null;
};

function streamFromString(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function openAiStreamResponse(chunks: string[]): Response {
  const body = [
    ...chunks.map((chunk) => `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}`),
    "data: [DONE]",
    "",
  ].join("\n\n");

  return new Response(streamFromString(body), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function geminiStreamResponse(chunks: string[]): Response {
  const body = [
    ...chunks.map((chunk) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: chunk }] } }] })}`),
    "data: [DONE]",
    "",
  ].join("\n\n");

  return new Response(streamFromString(body), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function ollamaStreamResponse(chunks: string[]): Response {
  const body = [
    ...chunks.map((chunk) => JSON.stringify({ message: { content: chunk }, done: false })),
    JSON.stringify({ done: true }),
    "",
  ].join("\n");

  return new Response(streamFromString(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetchSequence(responses: Array<Response | (() => Response)>) {
  const originalFetch = globalThis.fetch;
  const calls: MockFetchCall[] = [];
  let index = 0;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const rawBody = typeof init?.body === "string" ? init.body : null;
    calls.push({
      url: typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
      body: rawBody ? JSON.parse(rawBody) as Record<string, unknown> : null,
    });

    const next = responses[index];
    index += 1;
    if (!next) {
      throw new Error(`Unexpected fetch call ${index}`);
    }
    return typeof next === "function" ? next() : next;
  }) as typeof fetch;

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function withEnv(key: string, value: string) {
  const previous = process.env[key];
  process.env[key] = value;
  return () => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  };
}

function makeSeat(role: string) {
  return {
    role,
    model: "gemma-4-31b-it",
    systemPrompt: `Review from the perspective of ${role}.`,
  };
}

function makeSessionRow(overrides?: Partial<CouncilSession> & { seats?: ReturnType<typeof makeSeat>[] }) {
  return {
    id: overrides?.id ?? "session-db-1",
    title: overrides?.title ?? "Test session",
    topic: overrides?.topic ?? "Should this paper be accepted?",
    context: overrides?.context ?? "Context",
    goal: overrides?.goal ?? "Reach a decision",
    status: overrides?.status ?? "pending",
    rounds: overrides?.rounds ?? 2,
    moderator_model: overrides?.moderator_model ?? "gemma-4-31b-it",
    seats: overrides?.seats ?? [makeSeat("Methods Critic"), makeSeat("Literature Auditor"), makeSeat("Replication Skeptic")],
    owner_agent_id: overrides?.owner_agent_id ?? null,
    owner_api_key_id: overrides?.owner_api_key_id ?? null,
    created_at: overrides?.created_at ?? "2026-04-19T00:00:00.000Z",
    started_at: overrides?.started_at ?? null,
    heartbeat_at: overrides?.heartbeat_at ?? null,
    concluded_at: overrides?.concluded_at ?? null,
    last_error: overrides?.last_error ?? null,
    run_attempts: overrides?.run_attempts ?? 0,
    updated_at: overrides?.updated_at ?? "2026-04-19T00:00:00.000Z",
    divergence_level: overrides?.divergence_level ?? null,
    is_public: overrides?.is_public ?? false,
  };
}

function installCouncilDbMock(initial: {
  session: ReturnType<typeof makeSessionRow>;
  turns?: CouncilTurn[];
  conclusion?: CouncilConclusion | null;
}) {
  const originalQuery = db.query;
  const session = { ...initial.session };
  const turns = [...(initial.turns ?? [])];
  let conclusion = initial.conclusion ?? null;
  let turnInsertCount = 0;
  const queries: Array<{ text: string; params?: unknown[] }> = [];

  db.query = async (text: string, params?: unknown[]) => {
    queries.push({ text, params });

    if (text.includes("CREATE TABLE IF NOT EXISTS council_sessions")) {
      return { rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] };
    }

    if (text.startsWith("SELECT * FROM council_sessions WHERE id = $1")) {
      return { rows: [session], command: 'SELECT', rowCount: 1, oid: 0, fields: [] };
    }

    if (text.startsWith("SELECT * FROM council_turns WHERE session_id = $1")) {
      const sorted = [...turns].sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      return { rows: sorted, command: 'SELECT', rowCount: sorted.length, oid: 0, fields: [] };
    }

    if (text.startsWith("SELECT * FROM council_conclusions WHERE session_id = $1")) {
      const conclusionRows = conclusion ? [conclusion] : [];
      return { rows: conclusionRows, command: 'SELECT', rowCount: conclusionRows.length, oid: 0, fields: [] };
    }

    if (text.includes("SELECT ce.role, COUNT(DISTINCT sr->>'uri')")) {
      return { rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] };
    }

    if (text.startsWith("UPDATE council_sessions\n     SET status = 'running'")) {
      session.status = "running";
      session.started_at = "2026-04-19T00:00:01.000Z";
      session.heartbeat_at = "2026-04-19T00:00:01.000Z";
      session.concluded_at = null;
      session.last_error = null;
      session.run_attempts += 1;
      session.updated_at = "2026-04-19T00:00:01.000Z";
      return { rows: [], command: 'UPDATE', rowCount: 1, oid: 0, fields: [] };
    }

    if (text.startsWith("UPDATE council_sessions SET heartbeat_at = NOW()")) {
      session.heartbeat_at = "2026-04-19T00:00:02.000Z";
      session.updated_at = "2026-04-19T00:00:02.000Z";
      return { rows: [], command: 'UPDATE', rowCount: 1, oid: 0, fields: [] };
    }

    if (text.startsWith("UPDATE council_sessions SET divergence_level = $1")) {
      session.divergence_level = String(params?.[0] ?? "");
      session.updated_at = "2026-04-19T00:00:03.000Z";
      return { rows: [], command: 'UPDATE', rowCount: 1, oid: 0, fields: [] };
    }

    if (text.startsWith("INSERT INTO council_turns")) {
      turnInsertCount += 1;
      const row: CouncilTurn = {
        id: String(params?.[0]),
        session_id: String(params?.[1]),
        round: Number(params?.[2]),
        role: String(params?.[3]),
        model: String(params?.[4]),
        content: String(params?.[5]),
        input_tokens: Number(params?.[6] ?? 0),
        output_tokens: Number(params?.[7] ?? 0),
        created_at: `2026-04-19T00:00:${10 + turnInsertCount}.000Z`,
      };
      turns.push(row);
      return { rows: [row], command: 'INSERT', rowCount: 1, oid: 0, fields: [] };
    }

    if (text.startsWith("INSERT INTO council_conclusions")) {
      conclusion = {
        id: String(params?.[0]),
        session_id: String(params?.[1]),
        summary: String(params?.[2] ?? ""),
        consensus: params?.[3] ? String(params[3]) : null,
        dissent: params?.[4]
          ? (typeof params[4] === "string"
            ? JSON.parse(String(params[4])) as CouncilConclusion["dissent"]
            : params[4] as CouncilConclusion["dissent"])
          : null,
        action_items: JSON.parse(String(params?.[5] ?? "[]")) as CouncilConclusion["action_items"],
        veto: params?.[6] ? String(params[6]) : null,
        confidence: (params?.[7] ?? null) as CouncilConclusion["confidence"],
        confidence_reason: params?.[8] ? String(params[8]) : null,
        created_at: "2026-04-19T00:00:59.000Z",
      };
      return { rows: [conclusion], command: 'INSERT', rowCount: 1, oid: 0, fields: [] };
    }

    if (text.startsWith("UPDATE council_sessions\n     SET status = $1")) {
      session.status = String(params?.[0]) as CouncilSession["status"];
      session.last_error = params?.[1] ? String(params[1]) : null;
      session.concluded_at = "2026-04-19T00:01:00.000Z";
      session.heartbeat_at = "2026-04-19T00:01:00.000Z";
      session.updated_at = "2026-04-19T00:01:00.000Z";
      return { rows: [], command: 'UPDATE', rowCount: 1, oid: 0, fields: [] };
    }

    throw new Error(`Unexpected query: ${text}`);
  };

  return {
    session,
    turns,
    getConclusion: () => conclusion,
    queries,
    restore() {
      db.query = originalQuery;
    },
  };
}

test("parseToolCalls distinguishes complete malformed and truncated blocks", async () => {
  expect(parseToolCalls('[TOOL_CALL]{"tool":"rag_query","args":{"question":"x"}}[/TOOL_CALL]')).toEqual({
    status: "complete",
    calls: [{ tool: "rag_query", args: { question: "x" } }],
  });

  expect(parseToolCalls('[TOOL_CALL]{"tool":"rag_query"[/TOOL_CALL]')).toEqual({
    status: "malformed",
    calls: [],
  });

  expect(parseToolCalls('[TOOL_CALL]{"tool":"rag_query","args":{"question":"x"}}')).toEqual({
    status: "truncated",
    calls: [],
  });
});

test("normalizeSeatTurnContent enforces canonical round structure", async () => {
  const raw = [
    "Position",
    "This paper is promising but the claims outrun the evidence.",
    "",
    "Risks",
    "- Missing ablations on data quality.",
    "- Evaluation coverage is too thin.",
    "",
    "Evidence",
    "- Transformer Paper | https://arxiv.org/abs/1706.03762",
  ].join("\n");

  const normalized = normalizeSeatTurnContent(raw, 1);
  expect(normalized).toContain("**Position**");
  expect(normalized).toContain("**Key Assumptions**");
  expect(normalized).toContain("**Main Risks**");
  expect(normalized).toContain("**Strongest Counterargument**");
  expect(normalized).toContain("**Evidence**");
  expect(normalized.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(400);
});

function makeTurn(role: string, round: number, content: string): CouncilTurn {
  return {
    id: `${role}-${round}`,
    session_id: "session-1",
    round,
    role,
    model: "gemma-4-31b-it",
    content,
    input_tokens: 0,
    output_tokens: 0,
    created_at: new Date().toISOString(),
  };
}

function makeRound1Content(position: string): string {
  return normalizeSeatTurnContent([
    "**Position**",
    position,
    "",
    "**Key Assumptions**",
    "- The reported result is representative.",
    "",
    "**Main Risks**",
    "- One key experimental gap remains.",
    "",
    "**Strongest Counterargument**",
    "The missing evidence may not change the overall conclusion.",
    "",
    "**Evidence**",
    "- Example Source | https://example.com/source",
  ].join("\n"), 1);
}

function makeRound2Content(challenge: string, stance: string): string {
  return normalizeSeatTurnContent([
    "**Challenge**",
    challenge,
    "",
    "**Stance**",
    stance,
    "",
    "**Evidence**",
    "- Example Source | https://example.com/source",
  ].join("\n"), 2);
}

test("bounded prompts stay compact even with oversized stored turns", async () => {
  const hugeEvidence = Array.from({ length: 40 }, (_, index) => `- Source ${index + 1} | https://example.com/${index + 1} | repeated context repeated context repeated context repeated context`).join("\n");
  const round1Content = normalizeSeatTurnContent([
    "**Position**",
    "The paper is directionally useful but underspecified in critical places.",
    "",
    "**Key Assumptions**",
    "- The benchmark is representative.",
    "- The reported gain survives different seeds.",
    "",
    "**Main Risks**",
    "- Missing ablations.",
    "- Weak error analysis.",
    "",
    "**Strongest Counterargument**",
    "The claimed gain could still be meaningful if the missing checks are small.",
    "",
    "**Evidence**",
    hugeEvidence,
  ].join("\n"), 1);

  const round2Content = normalizeSeatTurnContent([
    "**Challenge**",
    "Methods Critic overstates how much the benchmark gap changes the overall conclusion.",
    "",
    "**Stance**",
    "My Round 1 position is unchanged until a cross-dataset check appears.",
    "",
    "**Evidence**",
    hugeEvidence,
  ].join("\n"), 2);

  const round1Turns = [
    makeTurn("Methods Critic", 1, round1Content),
    makeTurn("Literature Auditor", 1, round1Content),
    makeTurn("Replication Skeptic", 1, round1Content),
  ];
  const round2Turns = [
    makeTurn("Methods Critic", 2, round2Content),
    makeTurn("Literature Auditor", 2, round2Content),
  ];

  const round2Prompt = buildBoundedRound2Prompt(
    { topic: "Test topic", context: "Test context", goal: "Reach a decision" },
    round1Turns,
    round2Turns,
  );
  const moderatorPrompt = buildBoundedModeratorPrompt(
    { topic: "Test topic", context: "Test context", goal: "Reach a decision" },
    [...round1Turns, ...round2Turns],
    { "Methods Critic": 3, "Literature Auditor": 2, "Replication Skeptic": 1 },
  );

  expect(round2Prompt.length).toBeLessThan(9_500);
  expect(moderatorPrompt.length).toBeLessThan(10_500);
  expect(round2Prompt).not.toContain("repeated context repeated context repeated context repeated context repeated context repeated context");
  expect(moderatorPrompt).toContain("[cited URLs: 3]");
});

test("runAgenticRuntime keeps only the finalized answer after tool usage", async () => {
  const restoreEnv = withEnv("OPENAI_API_KEY", "test-openai-key");
  const fetchMock = installFetchSequence([
    openAiStreamResponse([
      'I will verify this before concluding.\n[TOOL_CALL]{"tool":"unsupported_tool","args":{"claim":"x"}}[/TOOL_CALL]',
    ]),
    openAiStreamResponse([
      "Final answer after tool usage.",
    ]),
  ]);

  const deltas: string[] = [];
  const toolCalls: Array<{ tool: string; args: Record<string, unknown> }> = [];

  try {
    const result = await runAgenticRuntime({
      prompt: "Test prompt",
      model: "gpt-4o",
      allowedTools: ["unsupported_tool"],
      maxTokens: 321,
      onTextDelta: async (delta) => {
        deltas.push(delta);
      },
      onToolCall: async (tool, args) => {
        toolCalls.push({ tool, args });
      },
    });

    expect(result.text).toBe("Final answer after tool usage.");
    expect(result.toolCalls).toBe(1);
    expect(result.toolsUsed).toEqual(["unsupported_tool"]);
    expect(deltas.join("")).toContain("I will verify this before concluding.");
    expect(deltas.join("")).toContain("Final answer after tool usage.");
    expect(toolCalls).toEqual([{ tool: "unsupported_tool", args: { claim: "x" } }]);
    expect(fetchMock.calls).toHaveLength(2);
    expect(fetchMock.calls[0].body?.max_tokens).toBe(321);
    expect(fetchMock.calls[1].body?.max_tokens).toBe(321);
  } finally {
    fetchMock.restore();
    restoreEnv();
  }
});

test("runAgenticRuntime fails loudly when tool usage is not followed by a final answer", async () => {
  const restoreEnv = withEnv("OPENAI_API_KEY", "test-openai-key");
  const fetchMock = installFetchSequence([
    openAiStreamResponse([
      '[TOOL_CALL]{"tool":"unsupported_tool","args":{"claim":"x"}}[/TOOL_CALL]',
    ]),
    openAiStreamResponse([]),
  ]);

  try {
    await expect(runAgenticRuntime({
      prompt: "Test prompt",
      model: "gpt-4o",
      allowedTools: ["unsupported_tool"],
    })).rejects.toThrow("Runtime ended after tool usage without a finalized answer.");
  } finally {
    fetchMock.restore();
    restoreEnv();
  }
});

test("runAgenticRuntime repairs one truncated tool call before continuing", async () => {
  const restoreEnv = withEnv("OPENAI_API_KEY", "test-openai-key");
  const fetchMock = installFetchSequence([
    openAiStreamResponse([
      'Checking evidence...\n[TOOL_CALL]{"tool":"unsupported_tool","args":{"claim":"x"}}',
    ]),
    openAiStreamResponse([
      '[TOOL_CALL]{"tool":"unsupported_tool","args":{"claim":"x"}}[/TOOL_CALL]',
    ]),
    openAiStreamResponse([
      "Recovered final answer.",
    ]),
  ]);

  try {
    const result = await runAgenticRuntime({
      prompt: "Test prompt",
      model: "gpt-4o",
      allowedTools: ["unsupported_tool"],
    });

    expect(result.text).toBe("Recovered final answer.");
    expect(result.toolCalls).toBe(1);
    expect(fetchMock.calls).toHaveLength(3);
    expect((fetchMock.calls[1].body?.messages as Array<{ content: string }>).at(-1)?.content).toContain("ended mid-[TOOL_CALL]");
  } finally {
    fetchMock.restore();
    restoreEnv();
  }
});

test("runAgenticRuntime throws when malformed tool repair also fails", async () => {
  const restoreEnv = withEnv("OPENAI_API_KEY", "test-openai-key");
  const fetchMock = installFetchSequence([
    openAiStreamResponse([
      '[TOOL_CALL]{"tool":"unsupported_tool"[/TOOL_CALL]',
    ]),
    openAiStreamResponse([
      '[TOOL_CALL]{"tool":"unsupported_tool"[/TOOL_CALL]',
    ]),
  ]);

  try {
    await expect(runAgenticRuntime({
      prompt: "Test prompt",
      model: "gpt-4o",
      allowedTools: ["unsupported_tool"],
    })).rejects.toThrow("Runtime returned a malformed [TOOL_CALL] block and failed to repair the tool request.");
  } finally {
    fetchMock.restore();
    restoreEnv();
  }
});

test("runModeratorTurn persists the formatter-retried moderator payload consistently", async () => {
  const restoreEnv = withEnv("OPENAI_API_KEY", "test-openai-key");
  const formatterRetryPayload = {
    summary: "Accept with revisions focused on reproducibility.",
    consensus: "The idea is strong but the committee wants sharper empirical support.",
    dissent: [{ question: "Are the ablations sufficient?", seats: { "Methods Critic": "No", "Constructive Advocate": "Almost" } }],
    action_items: [{ action: "Add stronger ablations.", priority: "recommended" }],
    veto: null,
    confidence: "medium",
    confidence_reason: "The synthesis is evidence-backed but one core disagreement remains.",
  };
  const formatterRetryJson = JSON.stringify(formatterRetryPayload);
  const fetchMock = installFetchSequence([
    openAiStreamResponse([
      "Acceptance is likely, but this is not valid JSON.",
    ]),
    jsonResponse({
      choices: [{
        message: {
          content: formatterRetryJson,
        },
      }],
      usage: { prompt_tokens: 18, completion_tokens: 44 },
    }),
  ]);

  const originalQuery = db.query;
  const queries: Array<{ text: string; params?: unknown[] }> = [];
  db.query = async (text: string, params?: unknown[]) => {
    queries.push({ text, params });

    if (text.includes("SELECT ce.role, COUNT(DISTINCT sr->>'uri')")) {
      return { rows: [{ role: "Methods Critic", cited_uris: "2" }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] };
    }

    if (text.includes("INSERT INTO council_turns")) {
      return {
        rows: [{
          id: "turn-moderator-1",
          session_id: params?.[1],
          round: params?.[2],
          role: params?.[3],
          model: params?.[4],
          content: params?.[5],
          input_tokens: params?.[6],
          output_tokens: params?.[7],
          created_at: "2026-04-19T00:00:00.000Z",
        }],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      };
    }

    if (text.includes("INSERT INTO council_conclusions")) {
      return {
        rows: [{
          id: params?.[0],
          session_id: params?.[1],
          summary: params?.[2],
          consensus: params?.[3],
          dissent: params?.[4] ? JSON.stringify(params[4]) : null,
          action_items: JSON.parse(String(params?.[5] ?? "[]")),
          veto: params?.[6],
          confidence: params?.[7],
          confidence_reason: params?.[8],
          created_at: "2026-04-19T00:00:01.000Z",
        }],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      };
    }

    throw new Error(`Unexpected query: ${text}`);
  };

  const session: CouncilSession = {
    id: "session-1",
    title: "Test session",
    topic: "Should we accept this paper?",
    context: "Context",
    goal: "Reach a decision",
    status: "running",
    rounds: 2,
    moderator_model: "gpt-4o",
    seats: [],
    owner_agent_id: null,
    created_at: "2026-04-19T00:00:00.000Z",
    started_at: "2026-04-19T00:00:00.000Z",
    heartbeat_at: "2026-04-19T00:00:00.000Z",
    concluded_at: null,
    last_error: null,
    run_attempts: 1,
    updated_at: "2026-04-19T00:00:00.000Z",
    divergence_level: "moderate",
    is_public: false,
  };

  const turns: CouncilTurn[] = [
    makeTurn("Methods Critic", 1, normalizeSeatTurnContent([
      "**Position**",
      "The core idea is strong, but the empirical case needs more support.",
      "",
      "**Key Assumptions**",
      "- The reported benchmark gains are robust.",
      "",
      "**Main Risks**",
      "- Missing ablations on the critical mechanism.",
      "",
      "**Strongest Counterargument**",
      "The main idea is still valuable even if some empirical support is incomplete.",
      "",
      "**Evidence**",
      "- Example Paper | https://example.com/paper",
    ].join("\n"), 1)),
  ];

  const events: CouncilEvent[] = [];

  try {
    const conclusion = await runModeratorTurn(session, turns, (event) => {
      events.push(event);
    }, async () => {});

    expect(conclusion.summary).toBe("Accept with revisions focused on reproducibility.");
    expect(events.find((event) => event.type === "moderator_delta")).toEqual({
      type: "moderator_delta",
      delta: formatterRetryJson,
    });
    expect(fetchMock.calls[0].body?.max_tokens).toBe(1200);
    expect(fetchMock.calls[1].body?.max_tokens).toBe(900);
    expect(queries.find((query) => query.text.includes("INSERT INTO council_turns"))?.params?.[5]).toBe(formatterRetryJson);
  } finally {
    db.query = originalQuery;
    fetchMock.restore();
    restoreEnv();
  }
});

test("runLLM forwards maxTokens to Gemini generateContent", async () => {
  const restoreEnv = withEnv("GEMINI_API_KEY", "test-gemini-key");
  const fetchMock = installFetchSequence([
    jsonResponse({
      candidates: [{ content: { parts: [{ text: "Gemini response" }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 12 },
    }),
  ]);

  try {
    const text = await runLLM("Prompt", "System", "gemini-2.0-flash", 111);
    expect(text).toBe("Gemini response");
    expect(fetchMock.calls[0].body?.generationConfig).toEqual({ maxOutputTokens: 111 });
  } finally {
    fetchMock.restore();
    restoreEnv();
  }
});

test("streamLLM forwards maxTokens to Ollama num_predict", async () => {
  const fetchMock = installFetchSequence([
    ollamaStreamResponse(["Ollama response"]),
  ]);

  try {
    const chunks: string[] = [];
    for await (const delta of streamLLM("Prompt", "System", "ollama/llama3", undefined, undefined, 222)) {
      chunks.push(delta);
    }
    expect(chunks.join("")).toBe("Ollama response");
    expect(fetchMock.calls[0].body?.options).toEqual({ num_predict: 222 });
  } finally {
    fetchMock.restore();
  }
});

test("streamLLM forwards maxTokens to Gemini streaming requests", async () => {
  const restoreEnv = withEnv("GEMINI_API_KEY", "test-gemini-key");
  const fetchMock = installFetchSequence([
    geminiStreamResponse(["Gemini streamed response"]),
  ]);

  try {
    const chunks: string[] = [];
    for await (const delta of streamLLM("Prompt", "System", "gemini-2.0-flash", undefined, undefined, 333)) {
      chunks.push(delta);
    }
    expect(chunks.join("")).toBe("Gemini streamed response");
    expect(fetchMock.calls[0].body?.generationConfig).toEqual({ maxOutputTokens: 333 });
  } finally {
    fetchMock.restore();
    restoreEnv();
  }
});

test("runCouncilSession resumes a partial Round 2 run without re-classifying divergence", async () => {
  const restoreEnv = withEnv("GEMINI_API_KEY", "test-gemini-key");
  const seats = [makeSeat("Methods Critic"), makeSeat("Literature Auditor")];
  const dbMock = installCouncilDbMock({
    session: makeSessionRow({ id: "resume-session", seats }),
    turns: [
      makeTurn("Methods Critic", 1, makeRound1Content("Accept with stronger ablations.")),
      makeTurn("Literature Auditor", 1, makeRound1Content("Accept, but compare more clearly against prior work.")),
      makeTurn("Methods Critic", 2, makeRound2Content(
        "Literature Auditor understates the empirical gap.",
        "My stance is unchanged until stronger ablations arrive.",
      )),
    ],
  });
  const fetchMock = installFetchSequence([
    geminiStreamResponse([
      [
        "**Challenge**",
        "Methods Critic is right that the empirical case is still thin.",
        "",
        "**Stance**",
        "My stance is unchanged until the missing comparisons are added.",
        "",
        "**Evidence**",
        "- Example Source | https://example.com/source",
      ].join("\n"),
    ]),
    geminiStreamResponse([
      JSON.stringify({
        summary: "The paper is promising but still needs stronger empirical support.",
        consensus: "Both seats want revisions before a clean accept recommendation.",
        dissent: null,
        action_items: [{ action: "Add the missing empirical checks.", priority: "recommended" }],
        veto: null,
        confidence: "medium",
        confidence_reason: "The seats largely align after the resumed debate.",
      }),
    ]),
  ]);

  const events: CouncilEvent[] = [];

  try {
    await runCouncilSession("resume-session", (event) => {
      events.push(event);
    });

    expect(events.some((event) => event.type === "divergence_check")).toBeFalsy();
    expect(events).toContainEqual({ type: "round_start", round: 2 });
    expect(events).toContainEqual({ type: "session_done", sessionId: "resume-session" });

    const round2Starts = events
      .filter((event): event is Extract<CouncilEvent, { type: "turn_start" }> => event.type === "turn_start" && event.round === 2)
      .map((event) => event.role);
    expect(round2Starts).toEqual(["Literature Auditor"]);

    expect(fetchMock.calls[0].body?.contents).toBeTruthy();
    const resumedPrompt = (((fetchMock.calls[0].body?.contents as Array<{ parts: Array<{ text: string }> }>)[0]).parts[0].text);
    expect(resumedPrompt).toContain("Round 2 arguments already made by other seats");
    expect(resumedPrompt).toContain("Methods Critic");
  } finally {
    fetchMock.restore();
    dbMock.restore();
    restoreEnv();
  }
});

test("runCouncilSession emits round2_skipped when divergence is low", async () => {
  const restoreEnv = withEnv("GEMINI_API_KEY", "test-gemini-key");
  const seats = [makeSeat("Methods Critic"), makeSeat("Literature Auditor")];
  const dbMock = installCouncilDbMock({
    session: makeSessionRow({ id: "skip-session", seats }),
  });
  const fetchMock = installFetchSequence([
    geminiStreamResponse([makeRound1Content("Accept with minor revisions.")]),
    geminiStreamResponse([makeRound1Content("Accept with minor revisions from a literature perspective.")]),
    jsonResponse({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              level: "low",
              summary: "Both seats agree on the direction and differ only in framing.",
              proceed_to_round2: false,
            }),
          }],
        },
      }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 12 },
    }),
    geminiStreamResponse([
      JSON.stringify({
        summary: "The paper looks acceptable with minor revisions.",
        consensus: "Both seats support the same decision direction.",
        dissent: null,
        action_items: [{ action: "Tighten the revision notes.", priority: "recommended" }],
        veto: null,
        confidence: "medium",
        confidence_reason: "The seats converged early, so Round 2 was unnecessary.",
      }),
    ]),
  ]);

  const events: CouncilEvent[] = [];

  try {
    await runCouncilSession("skip-session", (event) => {
      events.push(event);
    });

    expect(events).toContainEqual({
      type: "divergence_check",
      level: "low",
      summary: "Both seats agree on the direction and differ only in framing.",
      proceed_to_round2: false,
    });
    expect(events.some((event) => event.type === "round2_skipped")).toBeTruthy();
    expect(events.some((event) => event.type === "high_divergence_warning")).toBeFalsy();
    expect(events.some((event) => event.type === "round_start" && event.round === 2)).toBeFalsy();

    const turnStarts = events
      .filter((event): event is Extract<CouncilEvent, { type: "turn_start" }> => event.type === "turn_start")
      .map((event) => `${event.round}:${event.role}`);
    expect(turnStarts).toEqual(["1:Methods Critic", "1:Literature Auditor"]);
    expect(fetchMock.calls).toHaveLength(4);
  } finally {
    fetchMock.restore();
    dbMock.restore();
    restoreEnv();
  }
});

test("runCouncilSession emits high_divergence_warning and still completes Round 2", async () => {
  const restoreEnv = withEnv("GEMINI_API_KEY", "test-gemini-key");
  const seats = [makeSeat("Methods Critic"), makeSeat("Literature Auditor")];
  const dbMock = installCouncilDbMock({
    session: makeSessionRow({ id: "high-divergence-session", seats }),
  });
  const fetchMock = installFetchSequence([
    geminiStreamResponse([makeRound1Content("Reject until the core methodology is validated.")]),
    geminiStreamResponse([makeRound1Content("Accept because the literature contribution is strong.")]),
    jsonResponse({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              level: "high",
              summary: "The seats disagree on the core accept/reject decision.",
              proceed_to_round2: true,
            }),
          }],
        },
      }],
      usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 13 },
    }),
    geminiStreamResponse([makeRound2Content(
      "Literature Auditor relies too much on narrative strength over missing validation.",
      "My stance is unchanged until the validation gap is closed.",
    )]),
    geminiStreamResponse([makeRound2Content(
      "Methods Critic overweights one missing experiment relative to the broader contribution.",
      "My stance is unchanged because the literature case still matters.",
    )]),
    geminiStreamResponse([
      JSON.stringify({
        summary: "The session ends with strong disagreement between the two seats.",
        consensus: null,
        dissent: [{ question: "Is the missing validation blocking?", seats: { "Methods Critic": "Yes", "Literature Auditor": "No" } }],
        action_items: [{ action: "Resolve the validation dispute directly.", priority: "blocking" }],
        veto: "The missing validation remains unresolved.",
        confidence: "low",
        confidence_reason: "The council never reached stable convergence.",
      }),
    ]),
  ]);

  const events: CouncilEvent[] = [];

  try {
    await runCouncilSession("high-divergence-session", (event) => {
      events.push(event);
    });

    expect(events).toContainEqual({
      type: "divergence_check",
      level: "high",
      summary: "The seats disagree on the core accept/reject decision.",
      proceed_to_round2: true,
    });
    expect(events).toContainEqual({ type: "round_start", round: 2 });
    expect(events.some((event) => event.type === "high_divergence_warning")).toBeTruthy();
    expect(events).toContainEqual({ type: "session_done", sessionId: "high-divergence-session" });

    const round2Starts = events
      .filter((event): event is Extract<CouncilEvent, { type: "turn_start" }> => event.type === "turn_start" && event.round === 2)
      .map((event) => event.role);
    expect(round2Starts).toEqual(["Methods Critic", "Literature Auditor"]);
  } finally {
    fetchMock.restore();
    dbMock.restore();
    restoreEnv();
  }
});
