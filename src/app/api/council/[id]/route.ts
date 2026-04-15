import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCouncilSessionBundle } from "@/lib/council";
import { canAccessCouncilSession, clearCouncilSessionCookie } from "@/lib/council-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const allowed = await canAccessCouncilSession(req, id);
  if (!allowed) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const bundle = await getCouncilSessionBundle(id);

  if (!bundle.session) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(bundle);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const allowed = await canAccessCouncilSession(req, id);
  if (!allowed) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await db.query(`DELETE FROM council_sessions WHERE id = $1`, [id]);
  const response = NextResponse.json({ ok: true });
  clearCouncilSessionCookie(response, id);
  return response;
}
