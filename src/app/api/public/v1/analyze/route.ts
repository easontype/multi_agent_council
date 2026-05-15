import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Public API is not available" }, { status: 410 });
}
