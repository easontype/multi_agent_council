// /reader — Paper library (list of saved papers + add new)
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookOpen, Plus, Loader2 } from "lucide-react"

export default function ReaderLibraryPage() {
  const router = useRouter()
  const [arxivId, setArxivId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleAdd() {
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
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to add paper")
      }
      const paper = await res.json()
      router.push(`/reader/${paper.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 p-8">
      <div className="flex items-center gap-3">
        <BookOpen className="w-8 h-8" />
        <h1 className="text-2xl font-semibold tracking-tight">Paper Reader</h1>
      </div>

      <div className="w-full max-w-lg flex gap-2">
        <Input
          placeholder="arXiv ID or URL — e.g. 2301.00001"
          value={arxivId}
          onChange={(e) => setArxivId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={loading}
        />
        <Button onClick={handleAdd} disabled={loading || !arxivId.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
