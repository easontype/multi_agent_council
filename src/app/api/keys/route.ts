import { NextRequest, NextResponse } from "next/server";
import { generateApiKey } from "@/lib/api-keys";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : undefined;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { id, plaintextKey } = await generateApiKey(name, email || undefined);

    return NextResponse.json(
      {
        id,
        key: plaintextKey,
        name,
        tier: "free",
        dailyLimit: 10,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
