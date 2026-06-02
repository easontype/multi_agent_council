"use client"

import { useState } from "react"
import type { FigureBlock } from "@/lib/reader/types"
import { cn } from "@/lib/utils"

interface Props {
  block: FigureBlock
}

export function FigureBlockView({ block }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [descOpen, setDescOpen] = useState(false)

  return (
    <figure className="my-6 border border-border rounded-lg overflow-hidden">
      <div
        className={cn(
          "relative bg-muted/30 flex items-center justify-center",
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
        <figcaption className="px-4 py-2 text-xs text-muted-foreground border-t border-border leading-relaxed">
          {block.caption}
        </figcaption>
      )}

      {block.description && (
        <div className="border-t border-border/50">
          <button
            onClick={() => setDescOpen((v) => !v)}
            className="w-full text-left px-4 py-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center gap-1"
          >
            <span>{descOpen ? "▾" : "▸"}</span>
            <span>AI description</span>
          </button>
          {descOpen && (
            <p className="px-4 pb-3 text-xs text-muted-foreground/70 leading-relaxed">
              {block.description}
            </p>
          )}
        </div>
      )}
    </figure>
  )
}
