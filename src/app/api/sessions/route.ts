import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCouncilSession, listSessions } from "@/lib/council";
import { ensureAccountContextForAuthUser, resolveAuthAccountContext } from "@/lib/auth-account";
import {
  attachCouncilSessionCookie,
  createCouncilAnonymousAccess,
} from "@/lib/council-access";
import { enforceAnonymousWebQuota } from "@/lib/web-quota";

export const GET = auth(async (req) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await ensureAccountContextForAuthUser(req.auth.user);
  if (!account) {
    return NextResponse.json({ error: "Account email required" }, { status: 403 });
  }

  const sessions = await listSessions({
    workspaceId: account.workspaceId,
    ownerUserEmail: account.email,
  });
  return NextResponse.json(sessions);
});

export async function POST(req: NextRequest) {
  try {
    const quota = await enforceAnonymousWebQuota(req, "review_create", [
      { limit: 3, windowSeconds: 10 * 60, label: "10 minutes" },
      { limit: 10, windowSeconds: 24 * 60 * 60, label: "day" },
    ]);
    if (!quota.ok) {
      return NextResponse.json(
        { error: quota.error },
        {
          status: 429,
          headers: quota.retryAfterSeconds
            ? { "Retry-After": String(quota.retryAfterSeconds) }
            : undefined,
        },
      );
    }

    const body = await req.json();
    const account = await resolveAuthAccountContext();
    const anonymousAccess = account ? null : createCouncilAnonymousAccess();
    const session = await createCouncilSession({
      ...body,
      workspaceId: account?.workspaceId,
      createdByUserId: account?.userId,
      ownerUserEmail: account?.email ?? undefined,
      accessTokenHash: anonymousAccess?.tokenHash,
    });

    const response = NextResponse.json({ id: session.id }, { status: 201 });
    if (anonymousAccess) {
      attachCouncilSessionCookie(response, session.id, anonymousAccess.plaintextToken);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to create council session";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
