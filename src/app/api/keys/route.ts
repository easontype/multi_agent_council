import { NextRequest, NextResponse } from "next/server";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { generateApiKey, listApiKeysForWorkspace } from "@/lib/api-keys";

export async function GET() {
  const account = await resolveAuthAccountContext();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await listApiKeysForWorkspace(account.workspaceId);
  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : undefined;
    const account = await resolveAuthAccountContext();

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { id, plaintextKey } = await generateApiKey(name, email || undefined, {
      workspaceId: account?.workspaceId,
      createdByUserId: account?.userId,
    });

    return NextResponse.json(
      {
        id,
        key: plaintextKey,
        name,
        tier: "free",
        dailyLimit: 10,
        workspaceId: account?.workspaceId ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
