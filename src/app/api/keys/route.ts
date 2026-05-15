import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "API key management is not available" }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: "API key management is not available" }, { status: 410 });
}
