import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { revokeApiKey } from "@/lib/api-keys";

export const DELETE = auth(async (
  req,
  { params }: { params: Promise<{ id: string }> }
) => {
  if (!req.auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await revokeApiKey(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
