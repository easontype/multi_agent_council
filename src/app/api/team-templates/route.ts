import { NextRequest, NextResponse } from "next/server";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { listTeamTemplatesForWorkspace, upsertTeamTemplate } from "@/lib/team-templates";

export async function GET() {
  const account = await resolveAuthAccountContext();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await listTeamTemplatesForWorkspace(account.workspaceId);
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const account = await resolveAuthAccountContext();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const template = await upsertTeamTemplate({
      id: typeof body.id === "string" ? body.id : undefined,
      workspaceId: account.workspaceId,
      createdByUserId: account.userId,
      name: body.name,
      mode: body.mode,
      rounds: body.rounds,
      agents: body.agents,
    });
    const templates = await listTeamTemplatesForWorkspace(account.workspaceId);
    return NextResponse.json({ template, templates }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save team template";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
