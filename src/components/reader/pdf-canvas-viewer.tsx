"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  paperId: string
  numPages?: number
}

interface PageState {
  pageNum: number
  rendered: boolean
}

export function PdfCanvasViewer({ paperId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<PageState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())

  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      try {
        // Dynamic import — only in browser
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

        const pdfUrl = `/api/reader/papers/${paperId}/pdf`
        const loadingTask = pdfjs.getDocument({ url: pdfUrl })
        const pdf = await loadingTask.promise

        if (cancelled) return

        const pageStates: PageState[] = Array.from({ length: pdf.numPages }, (_, i) => ({
          pageNum: i + 1,
          rendered: false,
        }))
        setPages(pageStates)
        setLoading(false)

        // Render pages sequentially (first 3 immediately, rest lazily)
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) break
          const canvas = canvasRefs.current.get(pageNum)
          if (!canvas) {
            // Canvas not mounted yet — wait briefly and retry
            await new Promise((r) => setTimeout(r, 50))
          }
          const c = canvasRefs.current.get(pageNum)
          if (!c) continue

          const page = await pdf.getPage(pageNum)
          const scale = getScale(c.parentElement?.clientWidth ?? 800)
          const viewport = page.getViewport({ scale })

          c.width = viewport.width
          c.height = viewport.height

          const ctx = c.getContext("2d")
          if (!ctx) continue

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (page.render as any)({ canvasContext: ctx, viewport }).promise

          if (!cancelled) {
            setPages((prev) =>
              prev.map((p) => (p.pageNum === pageNum ? { ...p, rendered: true } : p))
            )
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PDF")
          setLoading(false)
        }
      }
    }

    loadPdf()
    return () => { cancelled = true }
  }, [paperId])

  // Track current page by scroll position
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onScroll = () => {
      const canvases = container.querySelectorAll<HTMLDivElement>("[data-page]")
      for (const el of canvases) {
        const rect = el.getBoundingClientRect()
        if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
          setCurrentPage(Number(el.dataset.page))
          break
        }
      }
    }
    container.addEventListener("scroll", onScroll, { passive: true })
    return () => container.removeEventListener("scroll", onScroll)
  }, [pages.length])

  function scrollToPage(pageNum: number) {
    const el = containerRef.current?.querySelector<HTMLDivElement>(`[data-page="${pageNum}"]`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading PDF…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col">
      {/* Page counter + nav */}
      <div className="absolute top-3 right-4 z-10 flex items-center gap-1 bg-background/90 backdrop-blur border border-border rounded-lg px-2 py-1 shadow-sm">
        <button
          onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-0.5 hover:text-foreground text-muted-foreground disabled:opacity-30"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <span className="text-xs tabular-nums text-muted-foreground px-1">
          {currentPage} / {pages.length}
        </span>
        <button
          onClick={() => scrollToPage(Math.min(pages.length, currentPage + 1))}
          disabled={currentPage >= pages.length}
          className="p-0.5 hover:text-foreground text-muted-foreground disabled:opacity-30"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* PDF pages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-muted/30 px-4 py-6 flex flex-col items-center gap-4"
      >
        {pages.map(({ pageNum, rendered }) => (
          <div
            key={pageNum}
            data-page={pageNum}
            className={cn(
              "relative shadow-md rounded overflow-hidden bg-white",
              !rendered && "min-h-[800px] flex items-center justify-center"
            )}
          >
            {!rendered && (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground absolute" />
            )}
            <canvas
              ref={(el) => {
                if (el) canvasRefs.current.set(pageNum, el)
                else canvasRefs.current.delete(pageNum)
              }}
              className="block max-w-full"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function getScale(containerWidth: number): number {
  // Target ~800px wide content at 96 DPI
  const targetWidth = Math.min(containerWidth - 32, 900)
  return targetWidth / 612 // 612pt = standard letter page width
}
