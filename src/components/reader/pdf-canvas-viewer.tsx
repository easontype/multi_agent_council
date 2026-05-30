"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Loader2, ChevronUp, ChevronDown, ZoomIn, ZoomOut } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  paperId: string
}

export function PdfCanvasViewer({ paperId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.5)
  // Store the pdf document for re-render on zoom
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null)
  const renderingRef = useRef(false)

  const renderAllPages = useCallback(async (pdf: unknown, targetScale: number) => {
    if (renderingRef.current) return
    renderingRef.current = true
    setRenderedPages(new Set())

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = pdf as any
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const canvas = document.getElementById(`pdf-page-${pageNum}`) as HTMLCanvasElement | null
      if (!canvas) continue

      const page = await doc.getPage(pageNum)
      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: targetScale * dpr })

      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width / dpr}px`
      canvas.style.height = `${viewport.height / dpr}px`

      const ctx = canvas.getContext("2d")
      if (!ctx) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.render as any)({ canvasContext: ctx, viewport }).promise

      setRenderedPages((prev) => new Set(prev).add(pageNum))
    }
    renderingRef.current = false
  }, [])

  // Initial load
  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

        const pdf = await pdfjs.getDocument({
          url: `/api/reader/papers/${paperId}/pdf`,
        }).promise

        if (cancelled) return
        pdfRef.current = pdf
        setTotalPages(pdf.numPages)
        setLoading(false)

        // Auto-fit scale to container width
        const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth - 240
        const fitScale = Math.min((containerWidth - 48) / 612, 2.5)
        setScale(fitScale)
        await renderAllPages(pdf, fitScale)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PDF")
          setLoading(false)
        }
      }
    }

    loadPdf()
    return () => { cancelled = true }
  }, [paperId, renderAllPages])

  // Re-render on zoom
  useEffect(() => {
    if (!pdfRef.current || loading) return
    renderAllPages(pdfRef.current, scale)
  }, [scale, loading, renderAllPages])

  // Track current page by scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onScroll = () => {
      for (let i = 1; i <= totalPages; i++) {
        const el = document.getElementById(`pdf-page-wrap-${i}`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top >= 0 && rect.top < window.innerHeight * 0.6) {
          setCurrentPage(i)
          break
        }
      }
    }
    container.addEventListener("scroll", onScroll, { passive: true })
    return () => container.removeEventListener("scroll", onScroll)
  }, [totalPages])

  function scrollToPage(pageNum: number) {
    document.getElementById(`pdf-page-wrap-${pageNum}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
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
      <div className="flex-1 flex items-center justify-center text-destructive text-sm px-8 text-center">
        {error}
      </div>
    )
  }

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="absolute top-3 right-4 z-10 flex items-center gap-1 bg-background/95 backdrop-blur border border-border rounded-lg px-2 py-1 shadow-sm">
        <button
          onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
          className="p-1 hover:text-foreground text-muted-foreground"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs tabular-nums text-muted-foreground w-10 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
          className="p-1 hover:text-foreground text-muted-foreground"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-1 hover:text-foreground text-muted-foreground disabled:opacity-30"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs tabular-nums text-muted-foreground w-12 text-center">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-1 hover:text-foreground text-muted-foreground disabled:opacity-30"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-zinc-100 dark:bg-zinc-900 px-6 py-6 flex flex-col items-center gap-6"
      >
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
          <div
            key={pageNum}
            id={`pdf-page-wrap-${pageNum}`}
            className={cn(
              "relative shadow-lg rounded bg-white",
              !renderedPages.has(pageNum) && "flex items-center justify-center"
            )}
            style={{ minHeight: !renderedPages.has(pageNum) ? 800 : undefined }}
          >
            {!renderedPages.has(pageNum) && (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            )}
            <canvas id={`pdf-page-${pageNum}`} className="block" />
          </div>
        ))}
      </div>
    </div>
  )
}
