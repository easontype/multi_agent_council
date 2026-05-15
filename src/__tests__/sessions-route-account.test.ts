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

jest.mock("@/lib/entitlements", () => ({
  checkEntitlement: jest.fn(),
  quotaDenied: jest.fn((error: string) => new Response(JSON.stringify({ error }), { status: 429 })),
  applyEntitlementResponse: jest.fn((response: Response) => response),
}));

import { GET, POST } from "@/app/api/sessions/route";
import { ensureAccountContextForAuthUser, resolveAuthAccountContext } from "@/lib/auth-account";
import { createCouncilSession, listSessions } from "@/lib/core/council";
import { attachCouncilSessionCookie, createCouncilAnonymousAccess } from "@/lib/core/council-access";
import { checkEntitlement } from "@/lib/entitlements";

const mockedEnsureAccountContextForAuthUser = jest.mocked(ensureAccountContextForAuthUser);
const mockedResolveAuthAccountContext = jest.mocked(resolveAuthAccountContext);
const mockedCreateCouncilSession = jest.mocked(createCouncilSession);
const mockedListSessions = jest.mocked(listSessions);
const mockedAttachCouncilSessionCookie = jest.mocked(attachCouncilSessionCookie);
const mockedCreateCouncilAnonymousAccess = jest.mocked(createCouncilAnonymousAccess);
const mockedCheckEntitlement = jest.mocked(checkEntitlement);

function makeApiRequest(body: Record<string, unknown>) {
  const request = new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    json: () => request.json(),
    headers: request.headers,
    cookies: { get: () => undefined },
  } as never;
}

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
      preferredLanguage: "en",
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
    mockedCheckEntitlement.mockResolvedValue({ ok: true } as never);
    mockedResolveAuthAccountContext.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User",
      preferredLanguage: "en",
    });
    mockedCreateCouncilSession.mockResolvedValue({ id: "session-1" } as never);

    const response = await POST(makeApiRequest({ topic: "Review this paper" }));

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
    mockedCheckEntitlement.mockResolvedValue({ ok: true } as never);
    mockedResolveAuthAccountContext.mockResolvedValue(null);
    mockedCreateCouncilAnonymousAccess.mockReturnValue({
      plaintextToken: "plain-token",
      tokenHash: "hash-token",
    });
    mockedCreateCouncilSession.mockResolvedValue({ id: "session-2" } as never);

    const response = await POST(makeApiRequest({ topic: "Anonymous review" }));

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
