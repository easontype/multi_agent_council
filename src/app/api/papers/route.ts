import { auth } from "@/auth";
import { ensureAccountContextForAuthUser } from "@/lib/auth-account";
import { listPaperAssets } from "@/lib/paper-assets";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await ensureAccountContextForAuthUser(req.auth.user);
  if (!account) {
    return NextResponse.json({ error: "Account email required" }, { status: 403 });
  }

  const papers = await listPaperAssets({
    workspaceId: account.workspaceId,
    limit: 100,
  });
  return NextResponse.json(papers);
});
