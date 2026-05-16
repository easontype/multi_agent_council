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

jest.mock("@/lib/anonymous-access", () => ({
  ensureAnonymousVisitorIdentity: jest.fn(),
}));

jest.mock("@/lib/entitlements", () => ({
  checkEntitlement: jest.fn(),
  quotaDenied: jest.fn(),
  applyEntitlementResponse: jest.fn((r: Response) => r),
}));

jest.mock("@/lib/session-job-registry", () => ({
  getSessionJob: jest.fn(),
  registerSessionJob: jest.fn(),
}));

jest.mock("@/lib/auth-account", () => ({
  resolveAuthAccountContext: jest.fn(),
}));

import { NextResponse } from "next/server";
import { DELETE as deleteSession } from "@/app/api/sessions/[id]/route";
import { POST as runSession } from "@/app/api/sessions/[id]/run/route";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { clearCouncilSessionCookie, isCouncilSessionOwner } from "@/lib/core/council-access";
import { runCouncilSession } from "@/lib/core/council";
import { db } from "@/lib/db/db";
import { ensureAnonymousVisitorIdentity } from "@/lib/anonymous-access";
import { checkEntitlement, quotaDenied } from "@/lib/entitlements";
import { getSessionJob, registerSessionJob } from "@/lib/session-job-registry";

const mockedIsCouncilSessionOwner = jest.mocked(isCouncilSessionOwner);
const mockedClearCouncilSessionCookie = jest.mocked(clearCouncilSessionCookie);
const mockedRunCouncilSession = jest.mocked(runCouncilSession);
const mockedDbQuery = jest.mocked(db.query);
const mockedResolveAuthAccountContext = jest.mocked(resolveAuthAccountContext);
const mockedEnsureAnonymousVisitorIdentity = jest.mocked(ensureAnonymousVisitorIdentity);
const mockedCheckEntitlement = jest.mocked(checkEntitlement);
const mockedQuotaDenied = jest.mocked(quotaDenied);
const mockedGetSessionJob = jest.mocked(getSessionJob);
const mockedRegisterSessionJob = jest.mocked(registerSessionJob);

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init) as never;
}

function makeSessionJob() {
  return {
    promise: Promise.resolve(),
    emitter: { on: jest.fn(), off: jest.fn(), once: jest.fn() },
  };
}

describe("session mutation access control", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveAuthAccountContext.mockResolvedValue(null);
    mockedEnsureAnonymousVisitorIdentity.mockReturnValue({
      plaintextId: "anon-test-id",
      idHash: "testhash",
      needsSetCookie: false,
    });
    mockedGetSessionJob.mockReturnValue(undefined);
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
    expect(mockedCheckEntitlement).not.toHaveBeenCalled();
    expect(mockedRunCouncilSession).not.toHaveBeenCalled();
  });

  it("allows rerunning a session when the caller is the owner", async () => {
    mockedIsCouncilSessionOwner.mockResolvedValue(true);
    mockedCheckEntitlement.mockResolvedValue({ ok: true });
    mockedRegisterSessionJob.mockReturnValue(makeSessionJob() as never);
    mockedRunCouncilSession.mockResolvedValue(undefined);

    const response = await runSession(makeRequest("http://localhost/api/sessions/test-session/run", {
      method: "POST",
      body: JSON.stringify({ forceRestart: true }),
      headers: { "Content-Type": "application/json" },
    }), {
      params: Promise.resolve({ id: "test-session" }),
    });

    expect(response.status).toBe(200);
    expect(mockedCheckEntitlement).toHaveBeenCalledTimes(1);
  });

  it("returns 429 when rerun quota is exceeded", async () => {
    mockedIsCouncilSessionOwner.mockResolvedValue(true);
    mockedCheckEntitlement.mockResolvedValue({
      ok: false,
      error: "Too many review runs",
      retryAfterSeconds: 60,
    });
    mockedQuotaDenied.mockReturnValue(
      NextResponse.json({ error: "Too many review runs" }, { status: 429, headers: { "Retry-After": "60" } })
    );

    const response = await runSession(makeRequest("http://localhost/api/sessions/test-session/run", {
      method: "POST",
      body: JSON.stringify({ forceRestart: true }),
      headers: { "Content-Type": "application/json" },
    }), {
      params: Promise.resolve({ id: "test-session" }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mockedRunCouncilSession).not.toHaveBeenCalled();
  });

  it("passes authenticated preferred language into reruns", async () => {
    mockedIsCouncilSessionOwner.mockResolvedValue(true);
    mockedCheckEntitlement.mockResolvedValue({ ok: true });
    mockedResolveAuthAccountContext.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User",
      preferredLanguage: "zh-TW",
    });
    mockedRegisterSessionJob.mockReturnValue(makeSessionJob() as never);
    mockedRunCouncilSession.mockResolvedValue(undefined);

    const response = await runSession(makeRequest("http://localhost/api/sessions/test-session/run", {
      method: "POST",
      body: JSON.stringify({ forceRestart: true, staleAfterMinutes: 15 }),
      headers: { "Content-Type": "application/json" },
    }), {
      params: Promise.resolve({ id: "test-session" }),
    });

    expect(response.status).toBe(200);
    expect(mockedRegisterSessionJob).toHaveBeenCalledWith(
      "test-session",
      expect.any(Function),
    );
  });
});
