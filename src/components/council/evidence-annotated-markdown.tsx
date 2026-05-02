'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { FileText, GraduationCap, Globe } from 'lucide-react'
import type { SourceRef } from '@/types/council'
import {
  buildEvidenceAnnotations,
  getSourceRefDisplayUrl,
  type EvidenceAnnotation,
} from '@/lib/evidence-annotations'
import { CitationPopover } from './citation-popover'

interface EvidenceAnnotatedMarkdownProps {
  content: string
  sourceRefs: SourceRef[]
  onSourceClick?: (label: string) => void
  onLocateInDocument?: (docId: string, chunkIndex: number) => void
  color?: string
  fontSize?: number
}

interface TextSegment {
  text: string
  annotation: EvidenceAnnotation | null
}

type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = []
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  let listItems: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ type: 'paragraph', text: paragraph.join(' ').trim() })
    paragraph = []
  }

  const flushList = () => {
    if (!listItems.length) return
    blocks.push({ type: 'list', items: listItems })
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    if (/^\*\*[^*]+\*\*$/.test(line) || /^#{1,3}\s+/.test(line)) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'heading', text: line.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, '').trim() })
      continue
    }

    if (/^-\s+/.test(line)) {
      flushParagraph()
      listItems.push(line.replace(/^-\s+/, '').trim())
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()

  return blocks
}

function buildSegments(text: string, annotations: EvidenceAnnotation[]): TextSegment[] {
  if (!annotations.length) return [{ text, annotation: null }]

  const segments: TextSegment[] = []
  let cursor = 0

  for (const annotation of annotations) {
    if (annotation.start > cursor) {
      segments.push({ text: text.slice(cursor, annotation.start), annotation: null })
    }
    segments.push({ text: text.slice(annotation.start, annotation.end), annotation })
    cursor = annotation.end
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), annotation: null })
  }

  return segments.filter((segment) => segment.text.length > 0)
}

const SOURCE_TYPE_CONFIG = {
  local_doc: {
    Icon: FileText,
    label: 'Local Document',
    confirmedColor: '#d97706',
    heuristicColor: '#fcd34d',
    hoverBg: '#fffbeb',
  },
  academic: {
    Icon: GraduationCap,
    label: 'Academic Paper',
    confirmedColor: '#2563eb',
    heuristicColor: '#93c5fd',
    hoverBg: '#eff6ff',
  },
  web: {
    Icon: Globe,
    label: 'Web Source',
    confirmedColor: '#0d9488',
    heuristicColor: '#5eead4',
    hoverBg: '#f0fdfa',
  },
} as const

function getSourceConfig(sourceType: string) {
  return SOURCE_TYPE_CONFIG[sourceType as keyof typeof SOURCE_TYPE_CONFIG] ?? SOURCE_TYPE_CONFIG.local_doc
}

function formatAuthors(authors: string[] | null | undefined): string | null {
  if (!authors?.length) return null
  if (authors.length === 1) return authors[0]
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`
  return `${authors[0]} et al.`
}

function EvidenceTooltip({ annotation }: { annotation: EvidenceAnnotation }) {
  const displayUrl = getSourceRefDisplayUrl(annotation.sourceRef)
  const config = getSourceConfig(annotation.sourceType)
  const { Icon } = config
  const authorStr = formatAuthors(annotation.sourceRef.authors)
  const year = annotation.sourceRef.year
  const score = annotation.sourceRef.similarity_score

  return (
    <span
      style={{
        position: 'absolute',
        left: 0,
        top: 'calc(100% + 8px)',
        width: 320,
        maxWidth: 'min(320px, 80vw)',
        zIndex: 30,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid #d4d4d8',
        background: '#fff',
        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        color: '#3f3f46',
        whiteSpace: 'normal',
      }}
    >
      {/* Source type eyebrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <Icon size={11} color={config.confirmedColor} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: config.confirmedColor, textTransform: 'uppercase' }}>
          {config.label}
        </span>
        {annotation.isHeuristic && (
          <span style={{ fontSize: 10, color: '#a1a1aa', marginLeft: 'auto' }}>推算配對</span>
        )}
      </div>

      {/* Title */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b', lineHeight: 1.45, marginBottom: 3 }}>
        {annotation.sourceRef.marker ? `${annotation.sourceRef.marker} ` : ''}{annotation.sourceRef.label}
      </div>

      {/* Authors + year */}
      {(authorStr || year) && (
        <div style={{ fontSize: 11, color: '#71717a', marginBottom: 6 }}>
          {[authorStr, year].filter(Boolean).join(' · ')}
        </div>
      )}

      {/* Divider */}
      {annotation.sourceRef.snippet && (
        <div style={{ borderTop: '1px solid #f4f4f5', margin: '7px 0' }} />
      )}

      {/* Snippet quote */}
      {annotation.sourceRef.snippet && (
        <div style={{ fontSize: 12, lineHeight: 1.55, color: '#3f3f46', fontStyle: 'italic' }}>
          "{annotation.sourceRef.snippet}"
        </div>
      )}

      {/* Footer: domain + score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
        {displayUrl && (
          <span style={{ fontSize: 11, color: '#71717a' }}>{displayUrl}</span>
        )}
        {score != null && (
          <span style={{ fontSize: 10, color: '#a1a1aa', marginLeft: 'auto' }}>
            {Math.round(score * 100)}% match
          </span>
        )}
      </div>

      {annotation.sourceRef.uri && (
        <div style={{ fontSize: 11, color: config.confirmedColor, marginTop: 6, textDecoration: 'underline' }}>
          Click to open source
        </div>
      )}
    </span>
  )
}

const INLINE_MD_RE = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g

function renderInlineMd(text: string, color: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  INLINE_MD_RE.lastIndex = 0
  while ((match = INLINE_MD_RE.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(<span key={cursor} style={{ color }}>{text.slice(cursor, match.index)}</span>)
    if (match[2]) nodes.push(<strong key={match.index} style={{ color, fontWeight: 700 }}><em>{match[2]}</em></strong>)
    else if (match[3]) nodes.push(<strong key={match.index} style={{ color, fontWeight: 700 }}>{match[3]}</strong>)
    else if (match[4]) nodes.push(<em key={match.index} style={{ color }}>{match[4]}</em>)
    else if (match[5]) nodes.push(<code key={match.index} style={{ fontFamily: 'monospace', fontSize: '0.9em', background: '#f4f4f5', borderRadius: 3, padding: '1px 4px', color: '#18181b' }}>{match[5]}</code>)
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) nodes.push(<span key={cursor} style={{ color }}>{text.slice(cursor)}</span>)
  return nodes
}

function AnnotatedInlineText({
  text,
  sourceRefs,
  onCitationClick,
  color,
}: {
  text: string
  sourceRefs: SourceRef[]
  onCitationClick: (annotation: EvidenceAnnotation, rect: DOMRect) => void
  color: string
}) {
  const annotations = useMemo(() => buildEvidenceAnnotations(text, sourceRefs), [text, sourceRefs])
  const segments = useMemo(() => buildSegments(text, annotations), [annotations, text])

  return (
    <>
      {segments.map((segment, index) => (
        segment.annotation ? (
          <EvidenceHoverSpan
            key={`${segment.annotation.id}-${index}`}
            annotation={segment.annotation}
            onCitationClick={onCitationClick}
          >
            {segment.text}
          </EvidenceHoverSpan>
        ) : (
          <React.Fragment key={`plain-${index}`}>{renderInlineMd(segment.text, color)}</React.Fragment>
        )
      ))}
    </>
  )
}

function EvidenceHoverSpan({
  annotation,
  onCitationClick,
  children,
}: {
  annotation: EvidenceAnnotation
  onCitationClick: (annotation: EvidenceAnnotation, rect: DOMRect) => void
  children: string
}) {
  const [hovered, setHovered] = useState(false)
  const spanRef = useRef<HTMLSpanElement>(null)
  const config = getSourceConfig(annotation.sourceType)
  const { Icon } = config
  const underlineColor = annotation.isHeuristic ? config.heuristicColor : config.confirmedColor

  const handleClick = () => {
    if (spanRef.current) {
      onCitationClick(annotation, spanRef.current.getBoundingClientRect())
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleClick()
    }
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        ref={spanRef}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          textDecorationLine: 'underline',
          textDecorationStyle: annotation.isHeuristic ? 'dashed' : 'solid',
          textDecorationThickness: '1.5px',
          textUnderlineOffset: '3px',
          textDecorationColor: underlineColor,
          background: hovered ? config.hoverBg : 'transparent',
          borderRadius: 3,
          cursor: 'pointer',
          transition: 'background 100ms ease',
        }}
      >
        <Icon
          size={10}
          style={{ display: 'inline', verticalAlign: 'baseline', marginRight: 2, opacity: 0.7, color: underlineColor }}
        />
        {children}
      </span>
      {hovered && <EvidenceTooltip annotation={annotation} />}
    </span>
  )
}

export function EvidenceAnnotatedMarkdown({
  content,
  sourceRefs,
  onSourceClick: _onSourceClick,
  onLocateInDocument,
  color = '#3f3f46',
  fontSize = 14,
}: EvidenceAnnotatedMarkdownProps) {
  const blocks = useMemo(() => parseBlocks(content), [content])
  const [activePopover, setActivePopover] = useState<{
    annotation: EvidenceAnnotation
    anchorRect: DOMRect
  } | null>(null)

  const handleCitationClick = useCallback((annotation: EvidenceAnnotation, rect: DOMRect) => {
    setActivePopover((prev) =>
      prev?.annotation.id === annotation.id ? null : { annotation, anchorRect: rect }
    )
  }, [])

  const handleLocate = useCallback((docId: string, chunkIndex: number) => {
    setActivePopover(null)
    onLocateInDocument?.(docId, chunkIndex)
  }, [onLocateInDocument])

  return (
    <div
      style={{
        color,
        fontSize,
        lineHeight: 1.75,
        wordBreak: 'break-word',
      }}
    >
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <div key={`heading-${index}`} style={{ margin: '0 0 10px' }}>
              <strong style={{ color: '#18181b', fontWeight: 700, letterSpacing: '-0.01em' }}>{block.text}</strong>
            </div>
          )
        }

        if (block.type === 'list') {
          return (
            <ul key={`list-${index}`} style={{ margin: '8px 0 10px', paddingLeft: 20 }}>
              {block.items.map((item, itemIndex) => (
                <li key={`list-item-${index}-${itemIndex}`} style={{ marginBottom: 4 }}>
                  <AnnotatedInlineText
                    text={item}
                    sourceRefs={sourceRefs}
                    onCitationClick={handleCitationClick}
                    color={color}
                  />
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={`paragraph-${index}`} style={{ margin: '0 0 10px' }}>
            <AnnotatedInlineText
              text={block.text}
              sourceRefs={sourceRefs}
              onCitationClick={handleCitationClick}
              color={color}
            />
          </p>
        )
      })}
      {activePopover && (
        <CitationPopover
          annotation={activePopover.annotation}
          anchorRect={activePopover.anchorRect}
          onClose={() => setActivePopover(null)}
          onLocateInDocument={onLocateInDocument ? handleLocate : undefined}
        />
      )}
    </div>
  )
}
