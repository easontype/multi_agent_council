"use client"

import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookOpen, Plus, Upload, Loader2, FileText, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReaderPaper } from "@/lib/reader/types"

export default function ReaderLibraryPage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [arxivId, setArxivId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const [dragging, setDragging] = useState(false)

  const [papers, setPapers]           = useState<ReaderPaper[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)

  useEffect(() => {
    fetch("/api/reader/papers")
      .then((r) => r.json())
      .then((d) => setPapers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLibraryLoading(false))
  }, [])

  async function addByArxivId() {
    const id = arxivId.trim().replace(/^https?:\/\/(arxiv\.org|ar5iv\.org)\/(abs|html)\//, "")
    if (!id) return
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/reader/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arxivId: id }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      const paper = await res.json()
      router.push(`/reader/${paper.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
      setLoading(false)
    }
  }

  async function uploadPdf(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) { setError("Please upload a PDF file"); return }
    setLoading(true); setError("")
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/reader/papers", { method: "POST", body: form })
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed")
      const paper = await res.json()
      router.push(`/reader/${paper.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
      setLoading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadPdf(file)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7" />
          <h1 className="text-2xl font-semibold tracking-tight">Paper Reader</h1>
        </div>

        {/* Add paper */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              placeholder="arXiv ID or URL — e.g. 2301.00001"
              value={arxivId}
              onChange={(e) => setArxivId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addByArxivId()}
              disabled={loading}
            />
            <Button onClick={addByArxivId} disabled={loading || !arxivId.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !loading && fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
              loading && "pointer-events-none opacity-50"
            )}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /><span>Processing…</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Upload className="w-4 h-4" /><span>Drop PDF here or click to upload</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f) }} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {/* Library */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Library</h2>

          {libraryLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /><span>Loading…</span>
            </div>
          ) : papers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No papers yet. Add an arXiv ID or upload a PDF above.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border border border-border rounded-xl overflow-hidden">
              {papers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/reader/${p.id}`)}
                  className="flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="mt-0.5 shrink-0 text-muted-foreground">
                    {p.sourceType === "pdf" ? <FileText className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug truncate">{p.title || "Untitled"}</p>
                    {p.authors.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.authors.slice(0, 3).join(", ")}{p.authors.length > 3 ? " et al." : ""}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground mt-0.5">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
