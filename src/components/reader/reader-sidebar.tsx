"use client"

import { cn } from "@/lib/utils"
import type { ParsedPaper } from "@/lib/reader/types"
import { BookOpen } from "lucide-react"

interface Props {
  paper: ParsedPaper
  activeSectionId: string
  onSectionClick: (id: string) => void
}

export function ReaderSidebar({ paper, activeSectionId, onSectionClick }: Props) {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    onSectionClick(id)
  }

  return (
    <aside className="w-60 shrink-0 border-r border-border flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <BookOpen className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate">{paper.title}</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {paper.sections.filter(s => !/^abstract$/i.test(s.title.trim())).map((section) => (
          <button
            key={section.id}
            onClick={() => scrollTo(section.id)}
            className={cn(
              "w-full text-left px-4 py-1.5 text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              section.level > 2 && "pl-6 text-xs",
              section.level > 3 && "pl-8",
              activeSectionId === section.id
                ? "text-foreground font-medium bg-accent/60"
                : "text-muted-foreground"
            )}
          >
            {section.title}
          </button>
        ))}
      </nav>
    </aside>
  )
}
