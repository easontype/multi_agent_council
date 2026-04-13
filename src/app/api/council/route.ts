import { NextRequest, NextResponse } from "next/server";
import { createCouncilSession, listSessions } from "@/lib/council";

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session = await createCouncilSession(body);
    return NextResponse.json({ id: session.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to create council session";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
