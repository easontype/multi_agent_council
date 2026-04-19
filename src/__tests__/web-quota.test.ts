jest.mock("@/lib/db", () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock("@/lib/council-access", () => ({
  getAuthenticatedCouncilOwnerEmail: jest.fn(),
}));

import { enforceAnonymousWebQuota } from "@/lib/web-quota";
import { db } from "@/lib/db";
import { getAuthenticatedCouncilOwnerEmail } from "@/lib/council-access";

const mockedDbQuery = jest.mocked(db.query);
const mockedGetAuthenticatedCouncilOwnerEmail = jest.mocked(getAuthenticatedCouncilOwnerEmail);

function makeRequest(url: string) {
  return new Request(url, {
    headers: {
      "user-agent": "jest-test",
      "x-forwarded-for": "203.0.113.10",
    },
  }) as never;
}

describe("web quota enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("enforces quota for authenticated users instead of bypassing them", async () => {
    mockedGetAuthenticatedCouncilOwnerEmail.mockResolvedValue("researcher@example.com");
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ count: 1 }] } as never);

    const result = await enforceAnonymousWebQuota(makeRequest("http://localhost/api/sessions"), "review_create", [
      { limit: 3, windowSeconds: 600, label: "10 minutes" },
    ]);

    expect(result).toEqual({ ok: true });
    expect(mockedDbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO web_rate_limits"),
      expect.arrayContaining(["review_create:600", "user:researcher@example.com"]),
    );
  });

  it("returns a limit error when an authenticated user exceeds quota", async () => {
    mockedGetAuthenticatedCouncilOwnerEmail.mockResolvedValue("researcher@example.com");
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await enforceAnonymousWebQuota(makeRequest("http://localhost/api/sessions"), "review_run", [
      { limit: 1, windowSeconds: 600, label: "10 minutes" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("User usage limit reached for review_run");
  });
});
