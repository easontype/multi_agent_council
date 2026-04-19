jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/db/account-db", () => ({
  ensureUserAccountByEmail: jest.fn(),
}));

import { auth } from "@/auth";
import { ensureUserAccountByEmail } from "@/lib/db/account-db";
import { ensureAccountContextForAuthUser, resolveAuthAccountContext } from "@/lib/auth-account";

const mockedAuth = jest.mocked(auth);
const mockedEnsureUserAccountByEmail = jest.mocked(ensureUserAccountByEmail);

describe("auth account resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when the auth user has no email", async () => {
    await expect(ensureAccountContextForAuthUser({
      name: "No Email",
      email: null,
    })).resolves.toBeNull();

    expect(mockedEnsureUserAccountByEmail).not.toHaveBeenCalled();
  });

  it("normalizes auth user fields before ensuring the account context", async () => {
    mockedEnsureUserAccountByEmail.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User Name",
    });

    const result = await ensureAccountContextForAuthUser({
      email: "  USER@example.com  ",
      name: "User Name",
      image: "https://example.com/avatar.png",
    });

    expect(mockedEnsureUserAccountByEmail).toHaveBeenCalledWith({
      email: "user@example.com",
      displayName: "User Name",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result?.workspaceId).toBe("ws-1");
  });

  it("resolves the current auth session into an account context", async () => {
    mockedAuth.mockResolvedValue({
      user: {
        email: "person@example.com",
        name: "Person",
        image: null,
      },
    } as never);
    mockedEnsureUserAccountByEmail.mockResolvedValue({
      userId: "user-2",
      workspaceId: "ws-2",
      role: "owner",
      email: "person@example.com",
      displayName: "Person",
    });

    const result = await resolveAuthAccountContext();

    expect(mockedAuth).toHaveBeenCalledTimes(1);
    expect(mockedEnsureUserAccountByEmail).toHaveBeenCalledWith({
      email: "person@example.com",
      displayName: "Person",
      avatarUrl: null,
    });
    expect(result?.userId).toBe("user-2");
  });
});
