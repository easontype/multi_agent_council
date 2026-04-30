jest.mock("@/lib/core/council-access", () => ({
  canAccessCouncilSession: jest.fn(),
  clearCouncilSessionCookie: jest.fn(),
  isCouncilSessionOwner: jest.fn(),
}));

jest.mock("@/lib/core/council", () => ({
  getCouncilSessionBundle: jest.fn(),
  runCouncilSession: jest.fn(),
}));

jest.mock("@/lib/db/db", () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock("@/lib/web-quota", () => ({
  enforceAnonymousWebQuota: jest.fn(),
}));

import { DELETE as deleteSession } from "@/app/api/sessions/[id]/route";
import { POST as runSession } from "@/app/api/sessions/[id]/run/route";
import { clearCouncilSessionCookie, isCouncilSessionOwner } from "@/lib/core/council-access";
import { runCouncilSession } from "@/lib/core/council";
import { db } from "@/lib/db/db";
import { enforceAnonymousWebQuota } from "@/lib/web-quota";

const mockedIsCouncilSessionOwner = jest.mocked(isCouncilSessionOwner);
const mockedClearCouncilSessionCookie = jest.mocked(clearCouncilSessionCookie);
const mockedRunCouncilSession = jest.mocked(runCouncilSession);
const mockedDbQuery = jest.mocked(db.query);
const mockedEnforceAnonymousWebQuota = jest.mocked(enforceAnonymousWebQuota);

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init) as never;
}

describe("session mutation access control", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects deleting a session when the caller is not the owner", async () => {
    mockedIsCouncilSessionOwner.mockResolvedValue(false);

    const response = await deleteSession(makeRequest("http://localhost/api/sessions/test-session", {
      method: "DELETE",
    }), {
      params: Promise.resolve({ id: "test-session" }),
    });

    expect(response.status).toBe(404);
    expect(mockedDbQuery).not.toHaveBeenCalled();
    expect(mockedClearCouncilSessionCookie).not.toHaveBeenCalled();
  });

  it("deletes a session when the caller is the owner", async () => {
    mockedIsCouncilSessionOwner.mockResolvedValue(true);
    mockedDbQuery.mockResolvedValue({ rows: [] } as never);

    const response = await deleteSession(makeRequest("http://localhost/api/sessions/test-session", {
      method: "DELETE",
    }), {
      params: Promise.resolve({ id: "test-session" }),
    });

    expect(response.status).toBe(200);
    expect(mockedDbQuery).toHaveBeenCalledWith("DELETE FROM council_sessions WHERE id = $1", ["test-session"]);
    expect(mockedClearCouncilSessionCookie).toHaveBeenCalledTimes(1);
  });

  it("rejects rerunning a session when the caller is not the owner", async () => {
    mockedIsCouncilSessionOwner.mockResolvedValue(false);

    const response = await runSession(makeRequest("http://localhost/api/sessions/test-session/run", {
      method: "POST",
      body: JSON.stringify({ forceRestart: true }),
      headers: { "Content-Type": "application/json" },
    }), {
      params: Promise.resolve({ id: "test-session" }),
    });

    expect(response.status).toBe(404);
    expect(mockedEnforceAnonymousWebQuota).not.toHaveBeenCalled();
    expect(mockedRunCouncilSession).not.toHaveBeenCalled();
  });

  it("allows rerunning a session when the caller is the owner", async () => {
    mockedIsCouncilSessionOwner.mockResolvedValue(true);
    mockedEnforceAnonymousWebQuota.mockResolvedValue({ ok: true });
    mockedRunCouncilSession.mockResolvedValue(undefined);

    const response = await runSession(makeRequest("http://localhost/api/sessions/test-session/run", {
      method: "POST",
      body: JSON.stringify({ forceRestart: true }),
      headers: { "Content-Type": "application/json" },
    }), {
      params: Promise.resolve({ id: "test-session" }),
    });

    expect(response.status).toBe(200);
    expect(mockedEnforceAnonymousWebQuota).toHaveBeenCalledTimes(1);
    expect(mockedRunCouncilSession).toHaveBeenCalledWith(
      "test-session",
      expect.any(Function),
      expect.objectContaining({ forceRestart: true }),
    );
  });
});
