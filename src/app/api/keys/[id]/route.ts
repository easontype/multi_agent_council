import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureAccountContextForAuthUser } from "@/lib/auth-account";
import { revokeApiKeyForWorkspace } from "@/lib/api-keys";

export const DELETE = auth(async (
  req,
  { params }: { params: Promise<{ id: string }> }
) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const account = await ensureAccountContextForAuthUser(req.auth.user);
    if (!account) {
      return NextResponse.json({ error: "Account email required" }, { status: 403 });
    }

    const { id } = await params;
    const revoked = await revokeApiKeyForWorkspace(id, account.workspaceId);
    if (!revoked) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
