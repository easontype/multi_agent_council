import { auth } from "@/auth";
import { ensureAccountContextForAuthUser } from "@/lib/auth-account";
import { getPaperAssetDetail } from "@/lib/paper-assets";
import { NextResponse } from "next/server";

export const GET = auth(async (req, { params }) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await ensureAccountContextForAuthUser(req.auth.user);
  if (!account) {
    return NextResponse.json({ error: "Account email required" }, { status: 403 });
  }

  const { id } = await params as { id: string };
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing paper id" }, { status: 400 });
  }

  const detail = await getPaperAssetDetail(id.trim(), account.workspaceId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
});
