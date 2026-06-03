import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const { paperId } = await params
  try {
    const raw = await readFile(
      join(process.cwd(), "uploads", "reader-debug", paperId, "marker-raw.md"),
      "utf-8"
    )
    return new NextResponse(raw, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  } catch {
    return NextResponse.json(
      { error: "No debug data found — re-upload the PDF to generate raw output" },
      { status: 404 }
    )
  }
}
