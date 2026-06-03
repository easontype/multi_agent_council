"use client"

import { useEffect, useRef } from "react"
import type { MathBlock } from "@/lib/reader/types"

interface Props {
  block: MathBlock
}

export function MathBlockView({ block }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !block.latex) return
    // Dynamically import KaTeX to avoid SSR issues
    import("katex").then(({ default: katex }) => {
      if (!ref.current) return
      try {
        katex.render(block.latex, ref.current, {
          displayMode: block.display,
          throwOnError: false,
          trust: false,
        })
      } catch {
        if (ref.current) ref.current.textContent = block.latex
      }
    })
  }, [block.latex, block.display])

  if (block.display) {
    return (
      <div className="my-4 overflow-x-auto">
        <div ref={ref} className="text-center py-2" />
      </div>
    )
  }

  return <span ref={ref} className="inline-block align-middle mx-0.5" />
}
