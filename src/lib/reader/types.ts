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
  display: boolean
}

export type FigureBlock = {
  type: "figure"
  id: string
  src: string
  caption: string
  alt: string
  description?: string  // Marker AI description paragraph (verbose, for inspection)
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

export type CaptionBlock = {
  type: "caption"
  id: string
  text: string
}

export type TableBlock = {
  type: "table"
  id: string
  headers: string[]
  rows: string[][]
}

export type ContentBlock =
  | TextBlock
  | HeadingBlock
  | MathBlock
  | FigureBlock
  | ListBlock
  | CodeBlock
  | CaptionBlock
  | TableBlock

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
  collapsible?: boolean   // Acknowledgements etc — collapsed by default
  isReferences?: boolean  // References section — fold + enable [N] nav
}

export type AuthorDetail = {
  name: string
  affiliations: string[]
  isCorresponding: boolean
  equalContribution: boolean
}

export type ParsedPaper = {
  paperId: string
  title: string
  authors: string[]
  authorDetails?: AuthorDetail[]  // PDF only — full name + affiliations
  abstract: string
  journal?: string
  publishedDate?: string
  keywords?: string[]             // from ## ARTICLE INFO
  sections: PaperSection[]
  figures: FigureBlock[]
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
  context: string
  question?: string
}

export type AskAIResponse = {
  answer: string
  relatedPapers?: { title: string; arxivId: string }[]
}
