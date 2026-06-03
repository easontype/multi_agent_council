import { NextRequest, NextResponse } from "next/server"
import { join, extname } from "path"
import { readFile, access } from "fs/promises"

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paperId: string; filename: string }> }
) {
  const { paperId, filename } = await params

  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
  }

  const filePath = join(process.cwd(), "uploads", "reader-images", paperId, filename)

  try {
    await access(filePath)
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const data = await readFile(filePath)
  const ext = extname(filename).toLowerCase()
  const contentType = MIME[ext] ?? "application/octet-stream"

  return new NextResponse(data as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
