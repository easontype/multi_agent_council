import { NextRequest, NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/api-keys";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await revokeApiKey(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
