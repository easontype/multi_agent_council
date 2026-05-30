"use client"

import type { PaperSection, ContentBlock } from "@/lib/reader/types"
import { TextBlockView } from "./text-block"
import { MathBlockView } from "./math-block"
import { FigureBlockView } from "./figure-block"

interface Props {
  section: PaperSection
  paperId: string
}

export function ContentRenderer({ section, paperId }: Props) {
  return (
    <div className="mb-10">
      {section.level <= 2 ? (
        <h2 className="text-xl font-semibold mt-8 mb-4">{section.title}</h2>
      ) : (
        <h3 className="text-base font-semibold mt-6 mb-3 text-foreground/80">{section.title}</h3>
      )}

      {section.blocks.map((block) => (
        <BlockView key={block.id} block={block} paperId={paperId} />
      ))}
    </div>
  )
}

function BlockView({ block, paperId }: { block: ContentBlock; paperId: string }) {
  switch (block.type) {
    case "paragraph":
      return <TextBlockView block={block} paperId={paperId} />
    case "math":
      return <MathBlockView block={block} />
    case "figure":
      return <FigureBlockView block={block} />
    case "heading":
      return (
        <h4 className="font-medium mt-4 mb-2 text-sm text-muted-foreground uppercase tracking-wide">
          {block.text}
        </h4>
      )
    case "list":
      return block.ordered ? (
        <ol className="list-decimal list-inside space-y-1 mb-4 text-sm">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ol>
      ) : (
        <ul className="list-disc list-inside space-y-1 mb-4 text-sm">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )
    case "code":
      return (
        <pre className="bg-muted rounded p-4 text-xs overflow-x-auto mb-4">
          <code>{block.content}</code>
        </pre>
      )
    default:
      return null
  }
}
