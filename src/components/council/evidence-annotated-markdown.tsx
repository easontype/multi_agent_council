'use client'

import { useMemo, useState } from 'react'
import type { SourceRef } from '@/types/council'
import {
  buildEvidenceAnnotations,
  getSourceRefDisplayUrl,
  type EvidenceAnnotation,
} from '@/lib/evidence-annotations'

interface EvidenceAnnotatedMarkdownProps {
  content: string
  sourceRefs: SourceRef[]
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

function EvidenceTooltip({ annotation }: { annotation: EvidenceAnnotation }) {
  const displayUrl = getSourceRefDisplayUrl(annotation.sourceRef)

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
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
        Evidence Support
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.55, color: '#18181b', marginBottom: 8 }}>
        "{annotation.sourceRef.snippet}"
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b', lineHeight: 1.45 }}>
        {annotation.sourceRef.label}
      </div>
      {displayUrl && (
        <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
          {displayUrl}
        </div>
      )}
      {annotation.sourceRef.uri && (
        <div style={{ fontSize: 11, color: '#355d7a', marginTop: 8, textDecoration: 'underline' }}>
          Click to open source
        </div>
      )}
    </span>
  )
}

function AnnotatedInlineText({
  text,
  sourceRefs,
  color,
}: {
  text: string
  sourceRefs: SourceRef[]
  color: string
}) {
  const annotations = useMemo(() => buildEvidenceAnnotations(text, sourceRefs), [text, sourceRefs])
  const segments = useMemo(() => buildSegments(text, annotations), [annotations, text])

  return (
    <>
      {segments.map((segment, index) => (
        segment.annotation ? (
          <EvidenceHoverSpan key={`${segment.annotation.id}-${index}`} annotation={segment.annotation}>
            {segment.text}
          </EvidenceHoverSpan>
        ) : (
          <span key={`plain-${index}`} style={{ color }}>{segment.text}</span>
        )
      ))}
    </>
  )
}

function EvidenceHoverSpan({
  annotation,
  children,
}: {
  annotation: EvidenceAnnotation
  children: string
}) {
  const [hovered, setHovered] = useState(false)
  const clickable = Boolean(annotation.sourceRef.uri)

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        role={clickable ? 'link' : undefined}
        tabIndex={clickable ? 0 : -1}
        onClick={() => {
          if (annotation.sourceRef.uri) window.open(annotation.sourceRef.uri, '_blank', 'noopener')
        }}
        onKeyDown={(event) => {
          if (!annotation.sourceRef.uri) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            window.open(annotation.sourceRef.uri, '_blank', 'noopener')
          }
        }}
        style={{
          textDecorationLine: 'underline',
          textDecorationStyle: 'solid',
          textDecorationThickness: '1.5px',
          textUnderlineOffset: '3px',
          textDecorationColor: '#355d7a88',
          background: hovered ? '#eef6fb' : 'transparent',
          borderRadius: 4,
          cursor: clickable ? 'pointer' : 'help',
          transition: 'background 120ms ease',
        }}
      >
        {children}
      </span>
      {hovered && <EvidenceTooltip annotation={annotation} />}
    </span>
  )
}

export function EvidenceAnnotatedMarkdown({
  content,
  sourceRefs,
  color = '#3f3f46',
  fontSize = 14,
}: EvidenceAnnotatedMarkdownProps) {
  const blocks = useMemo(() => parseBlocks(content), [content])

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
                  <AnnotatedInlineText text={item} sourceRefs={sourceRefs} color={color} />
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={`paragraph-${index}`} style={{ margin: '0 0 10px' }}>
            <AnnotatedInlineText text={block.text} sourceRefs={sourceRefs} color={color} />
          </p>
        )
      })}
    </div>
  )
}
