import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Public API is not available" }, { status: 410 });
}
