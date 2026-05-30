import { join } from "path"
import { writeFile, readFile, mkdir } from "fs/promises"
import { existsSync } from "fs"

const UPLOAD_DIR = join(process.cwd(), "uploads", "reader-pdfs")

async function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })
}

export async function savePdf(paperId: string, buffer: Buffer): Promise<string> {
  await ensureDir()
  const path = join(UPLOAD_DIR, `${paperId}.pdf`)
  await writeFile(path, buffer)
  return path
}

export async function loadPdf(paperId: string): Promise<Buffer | null> {
  const path = join(UPLOAD_DIR, `${paperId}.pdf`)
  if (!existsSync(path)) return null
  return readFile(path)
}

export function pdfExists(paperId: string): boolean {
  return existsSync(join(UPLOAD_DIR, `${paperId}.pdf`))
}
