"use client"

import { useEffect, useState } from "react"
import type { ReaderPaper, ParsedPaper } from "@/lib/reader/types"
import { ReaderSidebar } from "./reader-sidebar"
import { ContentRenderer } from "./content-renderer"
import { PdfCanvasViewer } from "./pdf-canvas-viewer"
import { Loader2 } from "lucide-react"

interface Props {
  paper: ReaderPaper
}

export function PaperReaderShell({ paper }: Props) {
  const [content, setContent] = useState<ParsedPaper | null>(paper.contentJson)
  const [loading, setLoading] = useState(!paper.contentJson)
  const [error, setError] = useState("")
  const [activeSectionId, setActiveSectionId] = useState<string>("")

  useEffect(() => {
    if (content) return
    fetch(`/api/reader/papers/${paper.id}/content`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: ParsedPaper) => {
        setContent(data)
        setActiveSectionId(data.sections[0]?.id ?? "")
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [paper.id, content])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Parsing paper…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-destructive">
        Failed to load: {error}
      </div>
    )
  }

  // ── PDF: canvas rendering (images + math rendered by browser) ─────────────
  if (paper.sourceType === "pdf") {
    return (
      <div className="h-screen flex overflow-hidden bg-background">
        {content && (
          <ReaderSidebar
            paper={content}
            activeSectionId={activeSectionId}
            onSectionClick={setActiveSectionId}
          />
        )}
        <PdfCanvasViewer paperId={paper.id} />
      </div>
    )
  }

  // ── arXiv: structured text rendering ─────────────────────────────────────
  if (!content) return null

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <ReaderSidebar
        paper={content}
        activeSectionId={activeSectionId}
        onSectionClick={setActiveSectionId}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-12">
          <header className="mb-10">
            <h1 className="text-2xl font-bold leading-tight mb-3">{content.title}</h1>
            {content.authors.length > 0 && (
              <p className="text-sm text-muted-foreground mb-4">
                {content.authors.join(", ")}
              </p>
            )}
            {content.abstract && (
              <div className="border-l-2 border-muted pl-4 text-sm text-muted-foreground italic">
                <p className="font-semibold not-italic text-foreground mb-1">Abstract</p>
                {content.abstract}
              </div>
            )}
          </header>

          {content.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              onMouseEnter={() => setActiveSectionId(section.id)}
            >
              <ContentRenderer section={section} paperId={paper.id} />
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
