import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCouncilSessionBundle } from "@/lib/council";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bundle = await getCouncilSessionBundle(id);

  if (!bundle.session) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(bundle);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.query(`DELETE FROM council_sessions WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
