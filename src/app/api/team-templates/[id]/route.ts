import { NextResponse } from "next/server";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { deleteTeamTemplate, listTeamTemplatesForWorkspace } from "@/lib/team-templates";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const account = await resolveAuthAccountContext();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteTeamTemplate(id, account.workspaceId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const templates = await listTeamTemplatesForWorkspace(account.workspaceId);
  return NextResponse.json({ ok: true, templates });
}
