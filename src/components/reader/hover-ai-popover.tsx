"use client"

import { useState } from "react"
import { Sparkles, MessageSquare, BookOpen, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props {
  paperId: string
  blockId: string
  sentenceId: string
  selectedText: string
  context: string
  rect: DOMRect
}

type QuickAction = {
  label: string
  icon: React.ReactNode
  question: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "解釋這句", icon: <MessageSquare className="w-3 h-3" />, question: "Please explain this sentence in simple terms." },
  { label: "這是什麼方法", icon: <BookOpen className="w-3 h-3" />, question: "What method or technique is being described here?" },
  { label: "這很重要嗎", icon: <Sparkles className="w-3 h-3" />, question: "How important is this claim to the paper's argument?" },
]

export function HoverAIPopover({
  paperId,
  blockId,
  selectedText,
  context,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState("")
  const [activeQuestion, setActiveQuestion] = useState("")

  async function ask(question: string) {
    setOpen(true)
    setActiveQuestion(question)
    setLoading(true)
    setAnswer("")
    try {
      const res = await fetch("/api/reader/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, blockId, selectionText: selectedText, context, question }),
      })
      const data = await res.json()
      setAnswer(data.answer ?? data.error ?? "No answer")
    } catch {
      setAnswer("Failed to get answer.")
    } finally {
      setLoading(false)
    }
  }

  if (open) {
    return (
      <div className="absolute left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{activeQuestion}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setOpen(false)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        {loading ? (
          <div className="text-muted-foreground animate-pulse">Thinking…</div>
        ) : (
          <p className="leading-relaxed">{answer}</p>
        )}
      </div>
    )
  }

  return (
    <div className="absolute left-0 z-40 mt-1 flex gap-1">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          onClick={() => ask(action.question)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs",
            "bg-popover border border-border shadow-sm",
            "hover:bg-accent hover:text-accent-foreground transition-colors"
          )}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  )
}
