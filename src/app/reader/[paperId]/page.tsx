// /reader/[paperId] — The actual paper reader
import { notFound } from "next/navigation"
import { getReaderPaper } from "@/lib/reader/db"
import { PaperReaderShell } from "@/components/reader/paper-reader-shell"

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ paperId: string }>
}) {
  const { paperId } = await params
  const paper = await getReaderPaper(paperId)
  if (!paper) notFound()

  return <PaperReaderShell paper={paper} />
}
