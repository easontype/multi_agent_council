jest.mock("@/auth", () => ({
  auth: jest.fn(() => Promise.resolve(null)),
}));

import { NextResponse } from "next/server";
import { attachCouncilSessionCookie } from "@/lib/core/council-access";

describe("council access cookies", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.APP_URL;
  const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalNextAuthUrl = process.env.NEXTAUTH_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.APP_URL = originalAppUrl;
    process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl;
    process.env.NEXTAUTH_URL = originalNextAuthUrl;
  });

  it("does not mark localhost cookies as secure in local production testing", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "http://localhost:3001";
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;

    const response = NextResponse.json({ ok: true });
    attachCouncilSessionCookie(response, "session-1", "plain-token");

    const cookieHeader = response.headers.get("set-cookie") ?? "";
    expect(cookieHeader).toContain("council_session_session-1=plain-token");
    expect(cookieHeader).not.toContain("Secure");
  });
});
