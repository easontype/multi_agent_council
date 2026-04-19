jest.mock("@/lib/api-keys", () => ({
  checkApiKey: jest.fn(),
}));

jest.mock("@/lib/council", () => ({
  getSession: jest.fn(),
  getSessionTurns: jest.fn(),
  getSessionConclusion: jest.fn(),
  MODERATOR_ROUND: 99,
}));

import { GET as getPublicSession } from "@/app/api/public/v1/sessions/[id]/route";
import { checkApiKey } from "@/lib/api-keys";
import { getSession, getSessionConclusion, getSessionTurns } from "@/lib/council";

const mockedCheckApiKey = jest.mocked(checkApiKey);
const mockedGetSession = jest.mocked(getSession);
const mockedGetSessionTurns = jest.mocked(getSessionTurns);
const mockedGetSessionConclusion = jest.mocked(getSessionConclusion);

function makeRequest(url: string, token = "cak_test") {
  return new Request(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }) as never;
}

describe("public API session ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects access when the session belongs to a different API key", async () => {
    mockedCheckApiKey.mockResolvedValue({ valid: true, keyId: "key-a", tier: "free" });
    mockedGetSession.mockResolvedValue({
      id: "session-1",
      title: "Bound session",
      topic: "Topic",
      context: null,
      goal: null,
      status: "pending",
      rounds: 1,
      moderator_model: "gemma-4-31b-it",
      seats: [],
      owner_agent_id: null,
      owner_api_key_id: "key-b",
      created_at: "2026-04-19T00:00:00.000Z",
      started_at: null,
      heartbeat_at: null,
      concluded_at: null,
      last_error: null,
      run_attempts: 0,
      updated_at: null,
      divergence_level: null,
      is_public: false,
    });

    const response = await getPublicSession(makeRequest("http://localhost/api/public/v1/sessions/session-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });

    expect(response.status).toBe(404);
    expect(mockedGetSessionTurns).not.toHaveBeenCalled();
    expect(mockedGetSessionConclusion).not.toHaveBeenCalled();
  });

  it("returns the session when the API key matches the session owner", async () => {
    mockedCheckApiKey.mockResolvedValue({ valid: true, keyId: "key-a", tier: "free" });
    mockedGetSession.mockResolvedValue({
      id: "session-1",
      title: "Bound session",
      topic: "Topic",
      context: null,
      goal: null,
      status: "concluded",
      rounds: 1,
      moderator_model: "gemma-4-31b-it",
      seats: [],
      owner_agent_id: null,
      owner_api_key_id: "key-a",
      created_at: "2026-04-19T00:00:00.000Z",
      started_at: null,
      heartbeat_at: null,
      concluded_at: null,
      last_error: null,
      run_attempts: 0,
      updated_at: null,
      divergence_level: null,
      is_public: false,
    });
    mockedGetSessionTurns.mockResolvedValue([
      {
        id: "turn-1",
        session_id: "session-1",
        round: 1,
        role: "Methods Critic",
        model: "gemma-4-31b-it",
        content: "Turn content",
        input_tokens: 10,
        output_tokens: 5,
        created_at: "2026-04-19T00:00:01.000Z",
      },
      {
        id: "turn-2",
        session_id: "session-1",
        round: 99,
        role: "Moderator",
        model: "gemma-4-31b-it",
        content: "Moderator content",
        input_tokens: 10,
        output_tokens: 5,
        created_at: "2026-04-19T00:00:02.000Z",
      },
    ]);
    mockedGetSessionConclusion.mockResolvedValue({
      id: "conclusion-1",
      session_id: "session-1",
      summary: "Summary",
      consensus: "Consensus",
      dissent: null,
      action_items: [],
      veto: null,
      confidence: "medium",
      confidence_reason: null,
      created_at: "2026-04-19T00:00:03.000Z",
    });

    const response = await getPublicSession(makeRequest("http://localhost/api/public/v1/sessions/session-1"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.sessionId).toBe("session-1");
    expect(json.turns).toHaveLength(1);
    expect(json.turns[0].id).toBe("turn-1");
  });
});
