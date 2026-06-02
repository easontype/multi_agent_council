"use client"

import type { PaperSection, ContentBlock } from "@/lib/reader/types"
import { TextBlockView, renderText } from "./text-block"
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
        <h2 className="text-xl font-semibold mt-8 mb-4">{renderText(section.title)}</h2>
      ) : (
        <h3 className="text-base font-semibold mt-6 mb-3 text-foreground/80">{renderText(section.title)}</h3>
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
          {renderText(block.text)}
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
    case "caption":
      return (
        <p className="text-xs text-muted-foreground italic mb-4 leading-relaxed">
          {block.text}
        </p>
      )
    case "table":
      return (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                {block.headers.map((h, i) => (
                  <th key={i} className="text-left py-2 pr-4 font-medium text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-2 pr-4 text-sm text-foreground/80 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return null
  }
}
