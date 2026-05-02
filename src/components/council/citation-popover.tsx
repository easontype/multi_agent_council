'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { FileText, GraduationCap, Globe, X, ExternalLink, MapPin, Loader2 } from 'lucide-react'
import type { EvidenceAnnotation } from '@/lib/evidence-annotations'
import { getSourceRefDisplayUrl } from '@/lib/evidence-annotations'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChunkContext {
  before: Array<{ chunk_index: number; content: string }>
  target: { chunk_index: number; content: string } | null
  after: Array<{ chunk_index: number; content: string }>
  sectionHeading: string | null
  pageEstimate: number | null
}

export interface CitationPopoverProps {
  annotation: EvidenceAnnotation
  anchorRect: DOMRect
  onClose: () => void
  onLocateInDocument?: (docId: string, chunkIndex: number) => void
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SOURCE_TYPE_CONFIG = {
  local_doc: { Icon: FileText,       label: 'Local Document', color: '#d97706' },
  academic:  { Icon: GraduationCap,  label: 'Academic Paper', color: '#2563eb' },
  web:       { Icon: Globe,          label: 'Web Source',     color: '#0d9488' },
} as const

function getSourceConfig(sourceType: string) {
  return SOURCE_TYPE_CONFIG[sourceType as keyof typeof SOURCE_TYPE_CONFIG]
    ?? SOURCE_TYPE_CONFIG.local_doc
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAuthors(authors: string[] | null | undefined): string | null {
  if (!authors?.length) return null
  if (authors.length === 1) return authors[0]
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`
  return `${authors[0]} et al.`
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `…${clean.slice(-(max - 1))}` : clean
}

function clampLeft(left: number, popoverWidth: number): number {
  const padding = 12
  const maxLeft = window.innerWidth - popoverWidth - padding
  return Math.max(padding, Math.min(left, maxLeft))
}

// ─── Inner content ────────────────────────────────────────────────────────────

function PopoverContent({
  annotation,
  onClose,
  onLocateInDocument,
}: {
  annotation: EvidenceAnnotation
  onClose: () => void
  onLocateInDocument?: (docId: string, chunkIndex: number) => void
}) {
  const [ctx, setCtx] = useState<ChunkContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchFailed, setFetchFailed] = useState(false)

  const { sourceRef, sourceType, isHeuristic } = annotation
  const config = getSourceConfig(sourceType)
  const { Icon } = config
  const displayUrl = getSourceRefDisplayUrl(sourceRef)
  const authorStr = formatAuthors(sourceRef.authors)
  const canLocate = Boolean(sourceRef.doc_id && sourceRef.chunk_index != null)

  useEffect(() => {
    if (!sourceRef.doc_id || sourceRef.chunk_index == null) return
    setLoading(true)
    fetch(`/api/documents/${sourceRef.doc_id}/chunks/${sourceRef.chunk_index}/context`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ChunkContext) => setCtx(data))
      .catch(() => setFetchFailed(true))
      .finally(() => setLoading(false))
  }, [sourceRef.doc_id, sourceRef.chunk_index])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Eyebrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <Icon size={11} color={config.color} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: config.color, textTransform: 'uppercase' }}>
                {config.label}
              </span>
              {isHeuristic && (
                <span style={{ fontSize: 10, color: '#a1a1aa', marginLeft: 4 }}>推算配對</span>
              )}
            </div>
            {/* Title */}
            <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', lineHeight: 1.4, wordBreak: 'break-word' }}>
              {sourceRef.marker && (
                <span style={{ color: config.color, marginRight: 4 }}>{sourceRef.marker}</span>
              )}
              {sourceRef.label}
            </div>
            {/* Authors · year */}
            {(authorStr || sourceRef.year) && (
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 3 }}>
                {[authorStr, sourceRef.year].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          {/* Actions: external link + close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {sourceRef.uri && (
              <a
                href={sourceRef.uri}
                target="_blank"
                rel="noopener noreferrer"
                title={displayUrl ?? 'Open source'}
                style={{ display: 'flex', padding: 4, borderRadius: 6, color: '#a1a1aa', textDecoration: 'none', lineHeight: 1 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = config.color; (e.currentTarget as HTMLElement).style.background = '#f4f4f5' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#a1a1aa'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <ExternalLink size={14} />
              </a>
            )}
            <button
              onClick={onClose}
              style={{ display: 'flex', padding: 4, borderRadius: 6, color: '#a1a1aa', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#71717a'; (e.currentTarget as HTMLElement).style.background = '#f4f4f5' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#a1a1aa'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Context body */}
      <div style={{ padding: '10px 14px', maxHeight: 280, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a1a1aa', fontSize: 12, padding: '8px 0' }}>
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            載入原文中…
          </div>
        )}

        {!loading && ctx && (
          <div style={{ fontSize: 12, lineHeight: 1.65, color: '#3f3f46' }}>
            {/* Section heading */}
            {ctx.sectionHeading && (
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 8 }}>
                {ctx.sectionHeading}
              </div>
            )}
            {/* Before */}
            {ctx.before.map((c) => (
              <p key={c.chunk_index} style={{ margin: '0 0 6px', color: '#71717a', fontSize: 11 }}>
                {truncate(c.content, 180)}
              </p>
            ))}
            {/* Target — highlighted */}
            {ctx.target && (
              <div style={{
                borderLeft: `3px solid ${config.color}`,
                background: sourceType === 'academic' ? '#eff6ff' : sourceType === 'web' ? '#f0fdfa' : '#fffbeb',
                borderRadius: '0 6px 6px 0',
                padding: '8px 10px',
                margin: '4px 0',
                fontSize: 12,
                color: '#18181b',
                lineHeight: 1.65,
              }}>
                {ctx.target.content}
              </div>
            )}
            {/* After */}
            {ctx.after.map((c) => (
              <p key={c.chunk_index} style={{ margin: '6px 0 0', color: '#71717a', fontSize: 11 }}>
                {truncate(c.content, 180)}
              </p>
            ))}
          </div>
        )}

        {/* Degraded: no chunk_index, show snippet */}
        {!loading && !ctx && !fetchFailed && sourceRef.snippet && (
          <div style={{
            borderLeft: `3px solid ${config.color}`,
            background: sourceType === 'academic' ? '#eff6ff' : sourceType === 'web' ? '#f0fdfa' : '#fffbeb',
            borderRadius: '0 6px 6px 0',
            padding: '8px 10px',
            fontSize: 12,
            color: '#18181b',
            lineHeight: 1.65,
            fontStyle: 'italic',
          }}>
            "{sourceRef.snippet}"
          </div>
        )}

        {fetchFailed && (
          <div style={{ fontSize: 11, color: '#a1a1aa', padding: '6px 0' }}>無法載入原文，顯示摘錄。</div>
        )}
        {fetchFailed && sourceRef.snippet && (
          <div style={{ fontSize: 12, color: '#3f3f46', lineHeight: 1.65, fontStyle: 'italic' }}>
            "{sourceRef.snippet}"
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{ fontSize: 11, color: '#a1a1aa' }}>
          {sourceRef.similarity_score != null
            ? `${Math.round(sourceRef.similarity_score * 100)}% match`
            : displayUrl ?? ''}
        </span>
        {canLocate && onLocateInDocument && (
          <button
            onClick={() => onLocateInDocument(sourceRef.doc_id!, sourceRef.chunk_index!)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, color: config.color,
              background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px',
              borderRadius: 6,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f4f4f5' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <MapPin size={11} />
            在文件中定位
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function CitationPopover({ annotation, anchorRect, onClose, onLocateInDocument }: CitationPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const POPOVER_WIDTH = 360
  const OFFSET = 10

  const left = clampLeft(anchorRect.left, POPOVER_WIDTH)
  const spaceBelow = window.innerHeight - anchorRect.bottom - OFFSET
  const top = spaceBelow > 240
    ? anchorRect.bottom + OFFSET
    : Math.max(12, anchorRect.top - OFFSET - Math.min(440, window.innerHeight * 0.55))

  // Close on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      onClose()
    }
  }, [onClose])

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleOutsideClick, handleKeyDown])

  if (typeof document === 'undefined') return null

  return ReactDOM.createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top,
        left,
        width: POPOVER_WIDTH,
        zIndex: 50,
        background: '#fff',
        border: '1px solid #e4e4e7',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.14)',
        overflow: 'hidden',
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <PopoverContent
        annotation={annotation}
        onClose={onClose}
        onLocateInDocument={onLocateInDocument}
      />
    </div>,
    document.body,
  )
}
