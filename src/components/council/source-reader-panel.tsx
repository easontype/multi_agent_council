'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import type { DiscussionSession, SourceRef } from '@/types/council'

export interface SourceReaderTarget {
  docId: string
  chunkIndex: number | null
}

interface MarkdownSection {
  heading: string
  level: number
  startChar: number
  endChar: number
}

interface MarkdownResponse {
  markdown: string
  sections: MarkdownSection[]
  markerProcessed: boolean
}

interface ChunkContextResponse {
  before: Array<{ chunk_index: number; content: string }>
  target: { chunk_index: number; content: string } | null
  after: Array<{ chunk_index: number; content: string }>
  sectionHeading: string | null
  pageEstimate: number | null
}

interface SourceReaderPanelProps {
  session: DiscussionSession
  target?: SourceReaderTarget | null
  onSelectTarget?: (target: SourceReaderTarget) => void
}

function slugifyHeading(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function truncate(text: string, max = 240): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1)}…`
}

function getSourceTypeLabel(sourceType: SourceRef['source_type']) {
  if (sourceType === 'academic') return 'Academic'
  if (sourceType === 'web') return 'Web'
  return 'Document'
}

function getDocumentCandidates(session: DiscussionSession) {
  const byDoc = new Map<string, { docId: string; title: string; sourceType: SourceRef['source_type']; refs: SourceRef[] }>()
  for (const ref of session.sourceRefs) {
    if (!ref.doc_id) continue
    const current = byDoc.get(ref.doc_id)
    if (current) {
      current.refs.push(ref)
      continue
    }
    byDoc.set(ref.doc_id, {
      docId: ref.doc_id,
      title: ref.source_type === 'local_doc' ? session.paperTitle : ref.label,
      sourceType: ref.source_type ?? 'local_doc',
      refs: [ref],
    })
  }
  return Array.from(byDoc.values())
}

function buildHeadingIds(sections: MarkdownSection[]): string[] {
  const counts = new Map<string, number>()
  return sections.map((section, index) => {
    const base = slugifyHeading(section.heading) || `section-${index + 1}`
    const next = (counts.get(base) ?? 0) + 1
    counts.set(base, next)
    return next === 1 ? base : `${base}-${next}`
  })
}

export function SourceReaderPanel({ session, target, onSelectTarget }: SourceReaderPanelProps) {
  const candidates = useMemo(() => getDocumentCandidates(session), [session])
  const defaultDocId = candidates[0]?.docId ?? null
  const [selectedDocId, setSelectedDocId] = useState<string | null>(target?.docId ?? defaultDocId)
  const [markdownData, setMarkdownData] = useState<MarkdownResponse | null>(null)
  const [contextData, setContextData] = useState<ChunkContextResponse | null>(null)
  const [markdownLoading, setMarkdownLoading] = useState(false)
  const [contextLoading, setContextLoading] = useState(false)
  const [markdownError, setMarkdownError] = useState<string | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)
  const readerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (target?.docId) {
      setSelectedDocId(target.docId)
      return
    }
    if (!selectedDocId && defaultDocId) {
      setSelectedDocId(defaultDocId)
    }
  }, [defaultDocId, selectedDocId, target?.docId])

  const selectedCandidate = candidates.find((candidate) => candidate.docId === selectedDocId) ?? null
  const activeChunkIndex = target?.docId === selectedDocId ? target.chunkIndex : null
  const headingIds = useMemo(() => buildHeadingIds(markdownData?.sections ?? []), [markdownData?.sections])

  // Sorted, deduplicated chunk refs for the selected document — used for prev/next nav
  const docChunkRefs = useMemo(() => {
    if (!selectedDocId) return []
    const seen = new Set<number>()
    return session.sourceRefs
      .filter((ref) => ref.doc_id === selectedDocId && ref.chunk_index != null)
      .sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0))
      .filter((ref) => {
        const idx = ref.chunk_index!
        if (seen.has(idx)) return false
        seen.add(idx)
        return true
      })
  }, [session.sourceRefs, selectedDocId])

  const currentNavIndex = activeChunkIndex == null
    ? -1
    : docChunkRefs.findIndex((ref) => ref.chunk_index === activeChunkIndex)
  const prevRef = currentNavIndex > 0 ? docChunkRefs[currentNavIndex - 1] : null
  const nextRef = currentNavIndex < docChunkRefs.length - 1 ? docChunkRefs[currentNavIndex + 1] : null

  useEffect(() => {
    if (!selectedDocId) return
    setMarkdownLoading(true)
    setMarkdownError(null)
    setMarkdownData(null)
    fetch(`/api/documents/${selectedDocId}/markdown`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load document markdown')
        return response.json() as Promise<MarkdownResponse>
      })
      .then((data) => setMarkdownData(data))
      .catch((error: unknown) => {
        setMarkdownError(error instanceof Error ? error.message : 'Failed to load document markdown')
      })
      .finally(() => setMarkdownLoading(false))
  }, [selectedDocId])

  useEffect(() => {
    if (!selectedDocId || activeChunkIndex == null) {
      setContextData(null)
      setContextError(null)
      setContextLoading(false)
      return
    }
    setContextLoading(true)
    setContextError(null)
    fetch(`/api/documents/${selectedDocId}/chunks/${activeChunkIndex}/context`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load cited chunk context')
        return response.json() as Promise<ChunkContextResponse>
      })
      .then((data) => setContextData(data))
      .catch((error: unknown) => {
        setContextError(error instanceof Error ? error.message : 'Failed to load cited chunk context')
      })
      .finally(() => setContextLoading(false))
  }, [activeChunkIndex, selectedDocId])

  useEffect(() => {
    if (!readerRef.current || !markdownData?.markerProcessed) return

    // Chunk-level precision: scroll to the injected span anchor
    if (activeChunkIndex != null) {
      const chunkEl = readerRef.current.querySelector<HTMLElement>(`#chunk-${activeChunkIndex}`)
      if (chunkEl) {
        chunkEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
    }

    // Fallback: scroll to section heading
    if (!contextData?.sectionHeading) return
    const sectionIndex = markdownData.sections.findIndex((s) => s.heading === contextData.sectionHeading)
    if (sectionIndex === -1) return
    const sectionEl = readerRef.current.querySelector<HTMLElement>(`#${CSS.escape(headingIds[sectionIndex] ?? '')}`)
    sectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeChunkIndex, contextData?.sectionHeading, headingIds, markdownData])

  // Highlight the paragraph(s) following the target chunk anchor
  useEffect(() => {
    if (!readerRef.current) return

    readerRef.current.querySelectorAll('[data-chunk-hl]').forEach((el) => {
      const htmlEl = el as HTMLElement
      htmlEl.style.removeProperty('background')
      htmlEl.style.removeProperty('border-left')
      htmlEl.style.removeProperty('padding-left')
      htmlEl.style.removeProperty('border-radius')
      htmlEl.style.removeProperty('margin-left')
      htmlEl.removeAttribute('data-chunk-hl')
    })

    if (activeChunkIndex == null || !markdownData?.markerProcessed) return
    const anchor = readerRef.current.querySelector<HTMLElement>(`#chunk-${activeChunkIndex}`)
    if (!anchor) return

    let next = anchor.nextElementSibling
    let highlighted = 0
    while (next && highlighted < 2) {
      const tag = next.tagName.toLowerCase()
      if (/^h[1-6]$/.test(tag)) break
      if (['p', 'ul', 'ol', 'blockquote', 'table'].includes(tag)) {
        const htmlEl = next as HTMLElement
        htmlEl.setAttribute('data-chunk-hl', '1')
        htmlEl.style.background = '#fff8ec'
        htmlEl.style.borderLeft = '3px solid #c28f3d'
        htmlEl.style.paddingLeft = '10px'
        htmlEl.style.marginLeft = '-10px'
        htmlEl.style.borderRadius = '0 6px 6px 0'
        highlighted++
      }
      next = next.nextElementSibling
    }
  }, [activeChunkIndex, markdownData])

  if (!candidates.length) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, color: '#71717a', textAlign: 'center' }}>
        No document-backed citations are available yet.
      </div>
    )
  }

  const headingCounts = new Map<string, number>()

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fafaf7' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #ece7dc', background: 'rgba(255,255,255,0.88)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 8 }}>
          Source Reader
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {candidates.map((candidate) => {
            const active = candidate.docId === selectedDocId
            return (
              <button
                key={candidate.docId}
                type="button"
                onClick={() => {
                  setSelectedDocId(candidate.docId)
                  onSelectTarget?.({ docId: candidate.docId, chunkIndex: null })
                }}
                style={{
                  borderRadius: 999,
                  border: `1px solid ${active ? '#c9b08a' : '#e7dfd1'}`,
                  background: active ? '#fff8ec' : '#fff',
                  color: active ? '#7a5a33' : '#71717a',
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {candidate.title}
                <span style={{ marginLeft: 6, opacity: 0.7 }}>{getSourceTypeLabel(candidate.sourceType)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {(activeChunkIndex != null || contextLoading || contextError) && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #ece7dc', background: '#fffefb', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#8a6a3d', textTransform: 'uppercase' }}>
                Cited Passage
              </div>
              {contextData?.sectionHeading && (
                <span style={{ fontSize: 11.5, color: '#7a5a33', fontStyle: 'italic' }}>§ {contextData.sectionHeading}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {contextData?.pageEstimate != null && (
                <span style={{ fontSize: 11, color: '#a1a1aa' }}>p.{contextData.pageEstimate}</span>
              )}
              {currentNavIndex >= 0 && docChunkRefs.length > 1 && (
                <span style={{ fontSize: 11, color: '#8b7355' }}>{currentNavIndex + 1} / {docChunkRefs.length}</span>
              )}
            </div>
          </div>

          {contextLoading && <div style={{ fontSize: 12, color: '#8b7355' }}>Loading cited chunk context…</div>}
          {contextError && <div style={{ fontSize: 12, color: '#b45309' }}>{contextError}</div>}
          {!contextLoading && contextData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contextData.target && (
                <div style={{ borderLeft: '3px solid #c28f3d', background: '#fff8ec', borderRadius: '0 10px 10px 0', padding: '10px 12px', fontSize: 12.5, color: '#3f3f46', lineHeight: 1.7 }}>
                  {contextData.target.content}
                </div>
              )}
              {(contextData.before.length > 0 || contextData.after.length > 0) && (
                <div style={{ fontSize: 11.5, color: '#71717a', lineHeight: 1.65 }}>
                  {[...contextData.before, ...contextData.after].slice(0, 2).map((chunk) => (
                    <p key={`${chunk.chunk_index}-${chunk.content.slice(0, 12)}`} style={{ margin: '0 0 6px' }}>
                      {truncate(chunk.content, 180)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div ref={readerRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 28px' }}>
        {markdownLoading && <div style={{ fontSize: 13, color: '#71717a' }}>Loading reader…</div>}
        {markdownError && <div style={{ fontSize: 13, color: '#b45309' }}>{markdownError}</div>}

        {!markdownLoading && !markdownError && markdownData && markdownData.markerProcessed && markdownData.markdown.trim() && (
          <div style={{ background: '#fffdf8', border: '1px solid #ece7dc', borderRadius: 16, padding: '20px 22px', boxShadow: '0 8px 26px rgba(81, 69, 46, 0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 12 }}>
              {selectedCandidate?.title ?? 'Document'}
            </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ children }) => {
                  const text = String(children).trim()
                  const base = slugifyHeading(text) || 'section'
                  const next = (headingCounts.get(base) ?? 0) + 1
                  headingCounts.set(base, next)
                  const id = next === 1 ? base : `${base}-${next}`
                  return <h1 id={id} style={{ margin: '0 0 12px', fontSize: 24, color: '#18181b', fontFamily: "'Georgia', 'Times New Roman', serif" }}>{children}</h1>
                },
                h2: ({ children }) => {
                  const text = String(children).trim()
                  const base = slugifyHeading(text) || 'section'
                  const next = (headingCounts.get(base) ?? 0) + 1
                  headingCounts.set(base, next)
                  const id = next === 1 ? base : `${base}-${next}`
                  return <h2 id={id} style={{ margin: '18px 0 10px', fontSize: 19, color: '#18181b' }}>{children}</h2>
                },
                h3: ({ children }) => {
                  const text = String(children).trim()
                  const base = slugifyHeading(text) || 'section'
                  const next = (headingCounts.get(base) ?? 0) + 1
                  headingCounts.set(base, next)
                  const id = next === 1 ? base : `${base}-${next}`
                  return <h3 id={id} style={{ margin: '14px 0 8px', fontSize: 16, color: '#18181b' }}>{children}</h3>
                },
                p: ({ children }) => <p style={{ margin: '0 0 12px', color: '#3f3f46', lineHeight: 1.8 }}>{children}</p>,
                ul: ({ children }) => <ul style={{ margin: '10px 0 12px', paddingLeft: 22, color: '#3f3f46' }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ margin: '10px 0 12px', paddingLeft: 22, color: '#3f3f46' }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 6, lineHeight: 1.7 }}>{children}</li>,
                code: ({ children }) => <code style={{ background: '#f5f5f4', borderRadius: 6, padding: '1px 5px', fontSize: '0.92em' }}>{children}</code>,
                table: ({ children }) => <div style={{ overflowX: 'auto', margin: '12px 0' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table></div>,
                th: ({ children }) => <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e7dfd1', fontSize: 12, color: '#18181b' }}>{children}</th>,
                td: ({ children }) => <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1ece3', fontSize: 12.5, color: '#3f3f46', verticalAlign: 'top' }}>{children}</td>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#355d7a', textDecoration: 'underline' }}>{children}</a>,
              }}
            >
              {markdownData.markdown}
            </ReactMarkdown>
          </div>
        )}

        {!markdownLoading && !markdownError && markdownData && (!markdownData.markerProcessed || !markdownData.markdown.trim()) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fffdf8', border: '1px solid #ece7dc', borderRadius: 16, padding: '18px 18px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#5f4b32', marginBottom: 6 }}>
                Full markdown reader is not available for this document yet.
              </div>
              <div style={{ fontSize: 12.5, color: '#71717a', lineHeight: 1.7 }}>
                Marker processing has not completed, so the reader is currently using chunk-context fallback.
              </div>
            </div>

            {contextData?.target ? (
              <div style={{ background: '#fff', border: '1px solid #ece7dc', borderRadius: 16, padding: '18px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 10 }}>
                  Chunk Context
                </div>
                <div style={{ fontSize: 13, color: '#3f3f46', lineHeight: 1.8 }}>
                  {contextData.before.map((chunk) => (
                    <p key={`before-${chunk.chunk_index}`} style={{ margin: '0 0 8px', color: '#71717a' }}>
                      {truncate(chunk.content, 180)}
                    </p>
                  ))}
                  <div style={{ borderLeft: '3px solid #c28f3d', background: '#fff8ec', borderRadius: '0 10px 10px 0', padding: '10px 12px', margin: '8px 0 10px' }}>
                    {contextData.target.content}
                  </div>
                  {contextData.after.map((chunk) => (
                    <p key={`after-${chunk.chunk_index}`} style={{ margin: '0 0 8px', color: '#71717a' }}>
                      {truncate(chunk.content, 180)}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #ece7dc', borderRadius: 16, padding: '18px', fontSize: 12.5, color: '#71717a' }}>
                Select a citation with document chunk metadata to focus the fallback reader.
              </div>
            )}
          </div>
        )}
      </div>

      {docChunkRefs.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #ece7dc', background: 'rgba(255,255,255,0.92)', flexShrink: 0, gap: 8 }}>
          <button
            type="button"
            disabled={!prevRef}
            onClick={() => prevRef && onSelectTarget?.({ docId: selectedDocId!, chunkIndex: prevRef.chunk_index ?? null })}
            style={{
              padding: '5px 10px', borderRadius: 6, border: '1px solid #e7dfd1',
              background: prevRef ? '#fff' : '#fafaf7', color: prevRef ? '#5f4b32' : '#c4b89a',
              fontSize: 11, fontWeight: 600, cursor: prevRef ? 'pointer' : 'default',
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 11, color: '#8b7355', textAlign: 'center' }}>
            {currentNavIndex >= 0
              ? `Citation ${currentNavIndex + 1} of ${docChunkRefs.length}`
              : `${docChunkRefs.length} citations`}
          </span>
          <button
            type="button"
            disabled={!nextRef}
            onClick={() => nextRef && onSelectTarget?.({ docId: selectedDocId!, chunkIndex: nextRef.chunk_index ?? null })}
            style={{
              padding: '5px 10px', borderRadius: 6, border: '1px solid #e7dfd1',
              background: nextRef ? '#fff' : '#fafaf7', color: nextRef ? '#5f4b32' : '#c4b89a',
              fontSize: 11, fontWeight: 600, cursor: nextRef ? 'pointer' : 'default',
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
