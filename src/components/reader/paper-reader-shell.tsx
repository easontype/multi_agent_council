"use client"

import { useEffect, useState } from "react"
import type { ReaderPaper, ParsedPaper } from "@/lib/reader/types"
import { ReaderSidebar } from "./reader-sidebar"
import { ContentRenderer } from "./content-renderer"
import { Loader2 } from "lucide-react"

interface Props {
  paper: ReaderPaper
}

export function PaperReaderShell({ paper }: Props) {
  return <PaperContentReader paper={paper} />
}

// All papers (arXiv + PDF) → structured text renderer via Marker API / arXiv parser
function PaperContentReader({ paper }: Props) {
  const [content, setContent]           = useState<ParsedPaper | null>(paper.contentJson)
  const [loading, setLoading]           = useState(!paper.contentJson)
  const [error, setError]               = useState("")
  const [activeSectionId, setActiveSectionId] = useState("")

  useEffect(() => {
    if (paper.contentJson) return
    fetch(`/api/reader/papers/${paper.id}/content`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data: ParsedPaper) => { setContent(data); setActiveSectionId(data.sections[0]?.id ?? "") })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [paper.id, paper.contentJson])

  if (loading) return (
    <div className="h-screen flex items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" /><span>Parsing paper…</span>
    </div>
  )

  if (error) return (
    <div className="h-screen flex items-center justify-center text-destructive">Failed to load: {error}</div>
  )

  if (!content) return null

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <ReaderSidebar paper={content} activeSectionId={activeSectionId} onSectionClick={setActiveSectionId} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-12">
          <header className="mb-10">
            <h1 className="text-2xl font-bold leading-tight mb-3">{content.title}</h1>
            {content.authors.length > 0 && (
              <p className="text-sm text-muted-foreground mb-2">{content.authors.join(", ")}</p>
            )}
            {(content.journal || content.publishedDate) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {content.journal && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{content.journal}</span>
                )}
                {content.publishedDate && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{content.publishedDate}</span>
                )}
              </div>
            )}
            {content.abstract && (
              <div className="border-l-2 border-muted pl-4 text-sm text-muted-foreground italic">
                <p className="font-semibold not-italic text-foreground mb-1">Abstract</p>
                {content.abstract}
              </div>
            )}
          </header>
          {content.sections.map((section) => (
            <section key={section.id} id={section.id} onMouseEnter={() => setActiveSectionId(section.id)}>
              <ContentRenderer section={section} paperId={paper.id} />
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
