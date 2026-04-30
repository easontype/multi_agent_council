jest.mock("@/auth", () => ({
  auth: jest.fn((handler?: unknown) => {
    if (typeof handler === "function") return handler;
    return Promise.resolve(null);
  }),
}));

jest.mock("@/lib/auth-account", () => ({
  ensureAccountContextForAuthUser: jest.fn(),
  resolveAuthAccountContext: jest.fn(),
}));

jest.mock("@/lib/core/council", () => ({
  createCouncilSession: jest.fn(),
  listSessions: jest.fn(),
}));

jest.mock("@/lib/core/council-access", () => ({
  attachCouncilSessionCookie: jest.fn(),
  createCouncilAnonymousAccess: jest.fn(),
}));

jest.mock("@/lib/web-quota", () => ({
  enforceAnonymousWebQuota: jest.fn(),
}));

import { GET, POST } from "@/app/api/sessions/route";
import { ensureAccountContextForAuthUser, resolveAuthAccountContext } from "@/lib/auth-account";
import { createCouncilSession, listSessions } from "@/lib/core/council";
import { attachCouncilSessionCookie, createCouncilAnonymousAccess } from "@/lib/core/council-access";
import { enforceAnonymousWebQuota } from "@/lib/web-quota";

const mockedEnsureAccountContextForAuthUser = jest.mocked(ensureAccountContextForAuthUser);
const mockedResolveAuthAccountContext = jest.mocked(resolveAuthAccountContext);
const mockedCreateCouncilSession = jest.mocked(createCouncilSession);
const mockedListSessions = jest.mocked(listSessions);
const mockedAttachCouncilSessionCookie = jest.mocked(attachCouncilSessionCookie);
const mockedCreateCouncilAnonymousAccess = jest.mocked(createCouncilAnonymousAccess);
const mockedEnforceAnonymousWebQuota = jest.mocked(enforceAnonymousWebQuota);

describe("/api/sessions account ownership wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists sessions by workspace context for authenticated users", async () => {
    mockedEnsureAccountContextForAuthUser.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User",
    });
    mockedListSessions.mockResolvedValue([]);

    const response = await GET({
      auth: {
        user: {
          email: "user@example.com",
        },
      },
    } as never);

    expect(response.status).toBe(200);
    expect(mockedListSessions).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      ownerUserEmail: "user@example.com",
    });
  });

  it("creates authenticated sessions with workspace and creator ids", async () => {
    mockedEnforceAnonymousWebQuota.mockResolvedValue({ ok: true });
    mockedResolveAuthAccountContext.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User",
    });
    mockedCreateCouncilSession.mockResolvedValue({ id: "session-1" } as never);

    const response = await POST(new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "Review this paper" }),
    }) as never);

    expect(response.status).toBe(201);
    expect(mockedCreateCouncilSession).toHaveBeenCalledWith(expect.objectContaining({
      topic: "Review this paper",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      ownerUserEmail: "user@example.com",
      accessTokenHash: undefined,
    }));
    expect(mockedAttachCouncilSessionCookie).not.toHaveBeenCalled();
  });

  it("keeps anonymous session cookies for unauthenticated creates", async () => {
    mockedEnforceAnonymousWebQuota.mockResolvedValue({ ok: true });
    mockedResolveAuthAccountContext.mockResolvedValue(null);
    mockedCreateCouncilAnonymousAccess.mockReturnValue({
      plaintextToken: "plain-token",
      tokenHash: "hash-token",
    });
    mockedCreateCouncilSession.mockResolvedValue({ id: "session-2" } as never);

    const response = await POST(new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "Anonymous review" }),
    }) as never);

    expect(response.status).toBe(201);
    expect(mockedCreateCouncilSession).toHaveBeenCalledWith(expect.objectContaining({
      topic: "Anonymous review",
      workspaceId: undefined,
      createdByUserId: undefined,
      ownerUserEmail: undefined,
      accessTokenHash: "hash-token",
    }));
    expect(mockedAttachCouncilSessionCookie).toHaveBeenCalledTimes(1);
  });
});
