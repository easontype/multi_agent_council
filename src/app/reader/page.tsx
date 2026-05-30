"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookOpen, Plus, Upload, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ReaderLibraryPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [arxivId, setArxivId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)

  async function addByArxivId() {
    const id = arxivId.trim().replace(/^https?:\/\/(arxiv\.org|ar5iv\.org)\/(abs|html)\//, "")
    if (!id) return
    setLoading(true)
    setError("")
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
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file")
      return
    }
    setLoading(true)
    setError("")
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
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadPdf(file)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 p-8">
      <div className="flex items-center gap-3">
        <BookOpen className="w-8 h-8" />
        <h1 className="text-2xl font-semibold tracking-tight">Paper Reader</h1>
      </div>

      {/* arXiv input */}
      <div className="w-full max-w-lg flex gap-2">
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

      <div className="flex items-center gap-3 text-muted-foreground text-sm w-full max-w-lg">
        <div className="flex-1 h-px bg-border" />
        or
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* PDF drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && fileRef.current?.click()}
        className={cn(
          "w-full max-w-lg border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
          loading && "pointer-events-none opacity-50"
        )}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Processing…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">Drop PDF here or click to upload</span>
            <span className="text-xs">Max 20 MB</span>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f) }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
