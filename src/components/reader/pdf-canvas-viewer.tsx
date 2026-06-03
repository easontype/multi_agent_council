"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Loader2, ChevronUp, ChevronDown, ZoomIn, ZoomOut, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface PdfTextItem {
  str: string
  transform: number[]  // [sx, kx, ky, sy, tx, ty] — PDF coords (origin bottom-left)
  width: number
  height: number
}

interface Segment {
  id: string
  text: string
  top: number
  left: number
  width: number
  height: number
}

interface HoverState {
  pageNum: number
  seg: Segment
}

interface AskState {
  pageNum: number
  seg: Segment
  question: string
  loading: boolean
  answer: string
}

const QUICK_ACTIONS = [
  { label: "解釋這段", question: "Please explain this passage in simple terms." },
  { label: "這是什麼方法", question: "What method or technique is being described here?" },
  { label: "這有多重要", question: "How important is this claim to the paper's argument?" },
]

// Convert PDF text items → hoverable sentence segments
type CItem = { str: string; top: number; left: number; width: number; fontSize: number }

// Split text into sentences, protecting common abbreviations
function splitSentences(text: string): string[] {
  const masked = text
    .replace(/\b(Fig|Eq|Ref|Sec|Tab|et al|i\.e|e\.g|vs|cf|Dr|Mr|Ms|Prof|No|Vol|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\./g, m => m.slice(0, -1) + "\x01")
    .replace(/\b([A-Z])\./g, m => m.slice(0, -1) + "\x01")   // initials like "J. Smith"
    .replace(/\b(\d+)\./g, m => m.slice(0, -1) + "\x01")     // "1." "2." etc.
  const parts = masked.split(/(?<=[.!?][)'"]?)\s+(?=[A-Z("])/)
  return parts.map(p => p.replace(/\x01/g, ".").trim()).filter(p => p.length >= 5)
}

function buildSegments(items: PdfTextItem[], viewportHeight: number, scale: number): Segment[] {
  const converted: CItem[] = items
    .filter((i) => i.str.trim().length > 0)
    .map((i) => {
      const fontSize = Math.abs(i.transform[3]) * scale
      return {
        str: i.str,
        top: viewportHeight - i.transform[5] * scale - fontSize,
        left: i.transform[4] * scale,
        width: i.width * scale,
        fontSize,
      }
    })
    .sort((a, b) => a.top - b.top || a.left - b.left)

  if (!converted.length) return []

  // Group into lines by Y proximity (within 3px)
  const lines: CItem[][] = []
  let curLine: CItem[] = []
  let lineTop = converted[0].top
  for (const item of converted) {
    if (item.top - lineTop > 3) {
      if (curLine.length) lines.push(curLine)
      curLine = [item]
      lineTop = item.top
    } else {
      curLine.push(item)
    }
  }
  if (curLine.length) lines.push(curLine)

  // Group lines into paragraphs (gap > 1.8× line height)
  const paragraphs: CItem[][][] = []
  let paraLines: CItem[][] = []
  for (let i = 0; i < lines.length; i++) {
    if (!paraLines.length) { paraLines.push(lines[i]); continue }
    const prev = paraLines[paraLines.length - 1]
    if (lines[i][0].top - prev[0].top > prev[0].fontSize * 1.8) {
      paragraphs.push(paraLines)
      paraLines = []
    }
    paraLines.push(lines[i])
  }
  if (paraLines.length) paragraphs.push(paraLines)

  const segments: Segment[] = []

  for (const para of paragraphs) {
    // Build joined text, tracking each line's char offset range
    type LR = { start: number; end: number; items: CItem[] }
    const lineRanges: LR[] = []
    const parts: string[] = []
    let offset = 0
    for (const lineItems of para) {
      const t = lineItems.map(i => i.str).join("")
      lineRanges.push({ start: offset, end: offset + t.length, items: lineItems })
      parts.push(t)
      offset += t.length + 1  // +1 for joining space
    }
    const joined = parts.join(" ")
    if (joined.trim().length < 10) continue

    // Split into sentences, map each back to overlapping lines for bbox
    const sentences = splitSentences(joined)
    let searchFrom = 0
    for (const sent of sentences) {
      const idx = joined.indexOf(sent, searchFrom)
      if (idx === -1) continue
      const sentEnd = idx + sent.length
      searchFrom = sentEnd

      const overlap = lineRanges.filter(lr => lr.end > idx && lr.start < sentEnd)
      if (!overlap.length) continue

      const all = overlap.flatMap(lr => lr.items)
      const top    = Math.min(...all.map(i => i.top))
      const bottom = Math.max(...all.map(i => i.top + i.fontSize * 1.2))
      const left   = Math.min(...all.map(i => i.left))
      const right  = Math.max(...all.map(i => i.left + i.width))

      segments.push({ id: `s${segments.length}`, text: sent, top: top - 2, left: left - 4, width: right - left + 8, height: bottom - top + 6 })
    }
  }

  return segments
}

interface Props {
  paperId: string
}

export function PdfCanvasViewer({ paperId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [totalPages, setTotalPages]     = useState(0)
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set())
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState("")
  const [currentPage, setCurrentPage]   = useState(1)
  const [scale, setScale]               = useState(1.5)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef       = useRef<any>(null)
  const renderingRef = useRef(false)

  const [pageSegments, setPageSegments] = useState<Record<number, Segment[]>>({})
  const [hover, setHover] = useState<HoverState | null>(null)
  const [ask,   setAsk]   = useState<AskState | null>(null)

  const renderAllPages = useCallback(async (pdf: unknown, targetScale: number) => {
    if (renderingRef.current) return
    renderingRef.current = true
    setRenderedPages(new Set())

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = pdf as any
    const newSegs: Record<number, Segment[]> = {}

    for (let n = 1; n <= doc.numPages; n++) {
      const canvas = document.getElementById(`pdf-page-${n}`) as HTMLCanvasElement | null
      if (!canvas) continue

      const page = await doc.getPage(n)
      const dpr  = window.devicePixelRatio || 1

      // HiDPI canvas
      const vp    = page.getViewport({ scale: targetScale * dpr })
      const vpCss = page.getViewport({ scale: targetScale })

      canvas.width        = vp.width
      canvas.height       = vp.height
      canvas.style.width  = `${vp.width / dpr}px`
      canvas.style.height = `${vp.height / dpr}px`

      const ctx = canvas.getContext("2d")!
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.render as any)({ canvasContext: ctx, viewport: vp }).promise

      // Text layer (coordinates based on CSS viewport, not HiDPI)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tc = await (page.getTextContent as any)()
      newSegs[n] = buildSegments(tc.items as PdfTextItem[], vpCss.height, targetScale)

      setRenderedPages((prev) => new Set(prev).add(n))
    }

    setPageSegments(newSegs)
    renderingRef.current = false
  }, [])

  // Load PDF
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
        const pdf = await pdfjs.getDocument({ url: `/api/reader/papers/${paperId}/pdf` }).promise
        if (cancelled) return
        pdfRef.current = pdf
        setTotalPages(pdf.numPages)
        setLoading(false)
        const w = containerRef.current?.clientWidth ?? window.innerWidth - 240
        const fit = Math.min((w - 48) / 612, 2.5)
        setScale(fit)
        await renderAllPages(pdf, fit)
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : "Failed to load PDF"); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [paperId, renderAllPages])

  // Re-render on zoom change
  useEffect(() => {
    if (!pdfRef.current || loading) return
    setAsk(null); setHover(null)
    renderAllPages(pdfRef.current, scale)
  }, [scale, loading, renderAllPages])

  // Track current page by scroll
  useEffect(() => {
    const c = containerRef.current
    if (!c) return
    const onScroll = () => {
      for (let i = 1; i <= totalPages; i++) {
        const el = document.getElementById(`pdf-page-wrap-${i}`)
        if (!el) continue
        if (el.getBoundingClientRect().top >= 0) { setCurrentPage(i); break }
      }
    }
    c.addEventListener("scroll", onScroll, { passive: true })
    return () => c.removeEventListener("scroll", onScroll)
  }, [totalPages])

  function scrollToPage(n: number) {
    document.getElementById(`pdf-page-wrap-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  async function doAsk(seg: Segment, pageNum: number, question: string) {
    setAsk({ pageNum, seg, question, loading: true, answer: "" })
    try {
      const res  = await fetch("/api/reader/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, blockId: seg.id, selectionText: seg.text, context: seg.text, question }),
      })
      const data = await res.json()
      setAsk((p) => p ? { ...p, loading: false, answer: data.answer ?? data.error ?? "No answer" } : null)
    } catch {
      setAsk((p) => p ? { ...p, loading: false, answer: "Failed to get answer." } : null)
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" /><span>Loading PDF…</span>
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center text-destructive text-sm px-8 text-center">{error}</div>
  )

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-1 bg-background/95 backdrop-blur border border-border rounded-lg px-2 py-1 shadow-sm">
        <button onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))} className="p-1 text-muted-foreground hover:text-foreground" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button>
        <span className="text-xs tabular-nums text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))} className="p-1 text-muted-foreground hover:text-foreground" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button>
        <div className="w-px h-4 bg-border mx-1" />
        <button onClick={() => scrollToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
        <span className="text-xs tabular-nums text-muted-foreground w-12 text-center">{currentPage} / {totalPages}</span>
        <button onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
      </div>

      {/* Page scroll area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto bg-zinc-100 dark:bg-zinc-900 px-6 py-6 flex flex-col items-center gap-6">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
          const segs = pageSegments[n] ?? []
          return (
            <div
              key={n}
              id={`pdf-page-wrap-${n}`}
              className={cn("relative shadow-lg rounded bg-white overflow-visible", !renderedPages.has(n) && "flex items-center justify-center")}
              style={{ minHeight: !renderedPages.has(n) ? 800 : undefined }}
            >
              {!renderedPages.has(n) && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}

              <canvas id={`pdf-page-${n}`} className="block" />

              {/* Hover text layer */}
              {segs.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {segs.map((seg) => {
                    const isHov = hover?.pageNum === n && hover.seg.id === seg.id
                    const isAsk = ask?.pageNum === n && ask.seg.id === seg.id
                    const showAbove = seg.top > 40

                    return (
                      <div
                        key={seg.id}
                        className="absolute pointer-events-auto"
                        style={{ top: seg.top, left: seg.left, width: seg.width, height: seg.height }}
                        onMouseEnter={() => { if (!ask) setHover({ pageNum: n, seg }) }}
                        onMouseLeave={() => setHover(null)}
                      >
                        {/* Highlight */}
                        {(isHov || isAsk) && (
                          <div className="absolute inset-0 bg-yellow-300/25 rounded pointer-events-none" />
                        )}

                        {/* Action buttons */}
                        {isHov && !ask && (
                          <div
                            className="absolute left-0 z-40 flex gap-1 whitespace-nowrap"
                            style={showAbove ? { bottom: "100%", marginBottom: 4 } : { top: "100%", marginTop: 4 }}
                          >
                            {QUICK_ACTIONS.map((a) => (
                              <button
                                key={a.label}
                                onClick={() => doAsk(seg, n, a.question)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-popover border border-border shadow-md hover:bg-accent hover:text-accent-foreground transition-colors"
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Answer popover */}
                        {isAsk && (
                          <div
                            className="absolute left-0 z-50 w-80 bg-popover border border-border rounded-lg shadow-xl p-3 text-sm"
                            style={showAbove ? { bottom: "100%", marginBottom: 4 } : { top: "100%", marginTop: 4 }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="text-xs text-muted-foreground font-medium leading-snug">{ask.question}</span>
                              <button onClick={() => setAsk(null)} className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                            </div>
                            {ask.loading
                              ? <div className="text-xs text-muted-foreground animate-pulse">Thinking…</div>
                              : <p className="text-xs leading-relaxed">{ask.answer}</p>
                            }
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
