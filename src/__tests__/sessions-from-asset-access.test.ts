jest.mock("@/lib/auth-account", () => ({
  resolveAuthAccountContext: jest.fn(),
}));

jest.mock("@/lib/entitlements", () => ({
  checkEntitlement: jest.fn(),
  quotaDenied: jest.fn((error: string) => new Response(JSON.stringify({ error }), { status: 429 })),
  applyEntitlementResponse: jest.fn((response: Response) => response),
}));

jest.mock("@/lib/paper-assets", () => ({
  getPaperAssetByIdForOwner: jest.fn(),
}));

jest.mock("@/lib/core/council", () => ({
  createCouncilSession: jest.fn(),
}));

jest.mock("@/lib/core/council-access", () => ({
  createCouncilAnonymousAccess: jest.fn(() => ({
    plaintextToken: "anon-token",
    tokenHash: "anon-hash",
  })),
  attachCouncilSessionCookie: jest.fn(),
}));

jest.mock("@/lib/anonymous-access", () => ({
  ensureAnonymousVisitorIdentity: jest.fn(() => ({
    plaintextId: "anon-visitor",
    idHash: "anon-visitor-hash",
    needsSetCookie: true,
  })),
}));

import { POST } from "@/app/api/sessions/from-asset/route";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { checkEntitlement } from "@/lib/entitlements";
import { getPaperAssetByIdForOwner } from "@/lib/paper-assets";
import { createCouncilSession } from "@/lib/core/council";

const mockedResolveAuthAccountContext = jest.mocked(resolveAuthAccountContext);
const mockedCheckEntitlement = jest.mocked(checkEntitlement);
const mockedGetPaperAssetByIdForOwner = jest.mocked(getPaperAssetByIdForOwner);
const mockedCreateCouncilSession = jest.mocked(createCouncilSession);

describe("sessions/from-asset access control", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveAuthAccountContext.mockResolvedValue(null);
    mockedCheckEntitlement.mockResolvedValue({ ok: true, anonymousVisitorIdToSet: "anon-visitor" } as never);
  });

  it("rejects anonymous reuse of another actor's paper asset", async () => {
    mockedGetPaperAssetByIdForOwner.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/sessions/from-asset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperAssetId: "asset-1", sessionType: "review" }),
      }) as never,
    );

    expect(response.status).toBe(404);
    expect(mockedCreateCouncilSession).not.toHaveBeenCalled();
  });
});
