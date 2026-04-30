import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/db";
import { getCouncilSessionBundle } from "@/lib/core/council";
import { canAccessCouncilSession, clearCouncilSessionCookie, isCouncilSessionOwner } from "@/lib/core/council-access";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isOwner = await isCouncilSessionOwner(req, id);
  if (!isOwner) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.is_public !== "boolean") {
    return NextResponse.json({ error: "is_public (boolean) required" }, { status: 400 });
  }

  await db.query(`UPDATE council_sessions SET is_public = $1 WHERE id = $2`, [body.is_public, id]);
  return NextResponse.json({ ok: true, is_public: body.is_public });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isOwner = await isCouncilSessionOwner(req, id);
  if (!isOwner) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await db.query(`DELETE FROM council_sessions WHERE id = $1`, [id]);
  const response = NextResponse.json({ ok: true });
  clearCouncilSessionCookie(response, id);
  return response;
}
