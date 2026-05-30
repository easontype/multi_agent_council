"use client"

import { useState } from "react"
import type { FigureBlock } from "@/lib/reader/types"
import { cn } from "@/lib/utils"

interface Props {
  block: FigureBlock
}

export function FigureBlockView({ block }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <figure className="my-6 border border-border rounded-lg overflow-hidden">
      <div
        className={cn(
          "relative bg-muted/30 cursor-zoom-in flex items-center justify-center",
          expanded ? "cursor-zoom-out" : "cursor-zoom-in"
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.src}
          alt={block.alt}
          className={cn(
            "max-w-full object-contain transition-all",
            expanded ? "max-h-none" : "max-h-72"
          )}
          loading="lazy"
        />
      </div>
      {block.caption && (
        <figcaption className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
          {block.caption}
        </figcaption>
      )}
    </figure>
  )
}
