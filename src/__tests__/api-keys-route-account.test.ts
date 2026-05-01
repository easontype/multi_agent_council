jest.mock("@/lib/auth-account", () => ({
  resolveAuthAccountContext: jest.fn(),
  ensureAccountContextForAuthUser: jest.fn(),
}));

jest.mock("@/lib/api-keys", () => ({
  generateApiKey: jest.fn(),
  listApiKeysForWorkspace: jest.fn(),
  revokeApiKeyForWorkspace: jest.fn(),
}));

jest.mock("@/auth", () => ({
  auth: jest.fn((handler?: unknown) => {
    if (typeof handler === "function") return handler;
    return Promise.resolve(null);
  }),
}));

import { GET, POST } from "@/app/api/keys/route";
import { DELETE } from "@/app/api/keys/[id]/route";
import { resolveAuthAccountContext, ensureAccountContextForAuthUser } from "@/lib/auth-account";
import { generateApiKey, listApiKeysForWorkspace, revokeApiKeyForWorkspace } from "@/lib/api-keys";

const mockedResolveAuthAccountContext = jest.mocked(resolveAuthAccountContext);
const mockedEnsureAccountContextForAuthUser = jest.mocked(ensureAccountContextForAuthUser);
const mockedGenerateApiKey = jest.mocked(generateApiKey);
const mockedListApiKeysForWorkspace = jest.mocked(listApiKeysForWorkspace);
const mockedRevokeApiKeyForWorkspace = jest.mocked(revokeApiKeyForWorkspace);

describe("API key account ownership routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates API keys with workspace ownership when authenticated", async () => {
    mockedResolveAuthAccountContext.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User",
      preferredLanguage: "en",
    });
    mockedGenerateApiKey.mockResolvedValue({
      id: "key-1",
      plaintextKey: "cak_secret",
      keyHash: "hash",
    });

    const response = await POST(new Request("http://localhost/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Research Bot", email: "user@example.com" }),
    }) as never);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(mockedGenerateApiKey).toHaveBeenCalledWith(
      "Research Bot",
      "user@example.com",
      { workspaceId: "ws-1", createdByUserId: "user-1" },
    );
    expect(json.workspaceId).toBe("ws-1");
  });

  it("lists API keys for the active workspace", async () => {
    mockedResolveAuthAccountContext.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User",
      preferredLanguage: "en",
    });
    mockedListApiKeysForWorkspace.mockResolvedValue([
      {
        id: "key-1",
        name: "Research Bot",
        email: "user@example.com",
        tier: "free",
        daily_limit: 10,
        used_today: 1,
        reset_date: "2026-04-19",
        created_at: "2026-04-19T00:00:00.000Z",
        last_used_at: null,
        revoked_at: null,
      },
    ]);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockedListApiKeysForWorkspace).toHaveBeenCalledWith("ws-1");
    expect(json).toHaveLength(1);
  });

  it("revokes keys only within the caller workspace", async () => {
    mockedEnsureAccountContextForAuthUser.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User",
      preferredLanguage: "en",
    });
    mockedRevokeApiKeyForWorkspace.mockResolvedValue(true);

    const response = await DELETE({
      auth: { user: { email: "user@example.com" } },
    } as never, {
      params: Promise.resolve({ id: "key-1" }),
    });

    expect(response.status).toBe(204);
    expect(mockedRevokeApiKeyForWorkspace).toHaveBeenCalledWith("key-1", "ws-1");
  });

  it("returns 404 when revoking a key outside the caller workspace", async () => {
    mockedEnsureAccountContextForAuthUser.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User",
      preferredLanguage: "en",
    });
    mockedRevokeApiKeyForWorkspace.mockResolvedValue(false);

    const response = await DELETE({
      auth: { user: { email: "user@example.com" } },
    } as never, {
      params: Promise.resolve({ id: "key-2" }),
    });

    expect(response.status).toBe(404);
  });
});
