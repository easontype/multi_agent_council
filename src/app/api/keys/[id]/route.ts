import { NextResponse } from "next/server";

export async function DELETE() {
  return NextResponse.json({ error: "API key management is not available" }, { status: 410 });
}
