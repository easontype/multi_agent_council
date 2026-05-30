"use client"

import { useState, useRef } from "react"
import type { TextBlock } from "@/lib/reader/types"
import { HoverAIPopover } from "./hover-ai-popover"

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
            {s.text}{" "}
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
