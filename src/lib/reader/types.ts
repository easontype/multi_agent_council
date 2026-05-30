// Core content block types for the paper reader

export type TextBlock = {
  type: "paragraph"
  id: string
  text: string
  sentences: Sentence[]
}

export type HeadingBlock = {
  type: "heading"
  id: string
  level: 1 | 2 | 3 | 4
  text: string
}

export type MathBlock = {
  type: "math"
  id: string
  latex: string
  display: boolean // true = block equation, false = inline
}

export type FigureBlock = {
  type: "figure"
  id: string
  src: string        // data URI or URL
  caption: string
  alt: string
  width?: number
  height?: number
}

export type ListBlock = {
  type: "list"
  id: string
  ordered: boolean
  items: string[]
}

export type CodeBlock = {
  type: "code"
  id: string
  language: string
  content: string
}

export type ContentBlock =
  | TextBlock
  | HeadingBlock
  | MathBlock
  | FigureBlock
  | ListBlock
  | CodeBlock

export type Sentence = {
  id: string
  text: string
  startChar: number
  endChar: number
}

export type PaperSection = {
  id: string
  title: string
  level: number
  blocks: ContentBlock[]
}

export type ParsedPaper = {
  paperId: string
  title: string
  authors: string[]
  abstract: string
  sections: PaperSection[]
  figures: FigureBlock[]   // all figures indexed for sidebar
  sourceType: "arxiv" | "pdf"
  arxivId?: string
  parsedAt: string
}

// DB row shape for reader_papers
export type ReaderPaper = {
  id: string
  userId: string | null
  title: string
  authors: string[]
  abstract: string
  arxivId: string | null
  sourceType: "arxiv" | "pdf"
  pdfUrl: string | null
  contentJson: ParsedPaper | null
  parsedAt: string | null
  createdAt: string
}

// Hover AI interaction
export type AskAIRequest = {
  paperId: string
  selectionText: string
  blockId: string
  context: string   // surrounding paragraph for grounding
  question?: string // if user typed custom question
}

export type AskAIResponse = {
  answer: string
  relatedPapers?: { title: string; arxivId: string }[]
}
