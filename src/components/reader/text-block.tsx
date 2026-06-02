"use client"

import { useState, useRef, useEffect } from "react"
import type { TextBlock } from "@/lib/reader/types"
import { HoverAIPopover } from "./hover-ai-popover"

function InlineMath({ latex }: { latex: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    import("katex").then(({ default: katex }) => {
      if (!ref.current) return
      try {
        katex.render(latex, ref.current, { displayMode: false, throwOnError: false, trust: false })
      } catch {
        if (ref.current) ref.current.textContent = `$${latex}$`
      }
    })
  }, [latex])
  return <span ref={ref} className="inline-block align-middle mx-0.5" />
}

function renderText(text: string): React.ReactNode[] {
  const parts = text.split(/(\$[^$\n]+\$)/g)
  return parts.map((part, i) => {
    if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) {
      return <InlineMath key={i} latex={part.slice(1, -1)} />
    }
    return part
  })
}

interface Props {
  block: TextBlock
  paperId: string
}

export function TextBlockView({ block, paperId }: Props) {
  const [hovered, setHovered] = useState<{
    sentenceId: string
    text: string
    rect: DOMRect
  } | null>(null)
  const paraRef = useRef<HTMLParagraphElement>(null)

  function handleMouseOver(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.dataset.sentenceId) return
    const rect = target.getBoundingClientRect()
    setHovered({
      sentenceId: target.dataset.sentenceId,
      text: target.textContent ?? "",
      rect,
    })
  }

  function handleMouseLeave() {
    setHovered(null)
  }

  return (
    <div className="relative mb-4">
      <p
        ref={paraRef}
        className="text-sm leading-7 text-foreground/90"
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
      >
        {block.sentences.map((s) => (
          <span
            key={s.id}
            data-sentence-id={s.id}
            className="cursor-default transition-colors rounded hover:bg-primary/10 hover:text-foreground px-0.5"
          >
            {renderText(s.text)}{" "}
          </span>
        ))}
      </p>

      {hovered && (
        <HoverAIPopover
          paperId={paperId}
          blockId={block.id}
          sentenceId={hovered.sentenceId}
          selectedText={hovered.text}
          context={block.text}
          rect={hovered.rect}
        />
      )}
    </div>
  )
}
