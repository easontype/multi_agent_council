'use client'

import { useState, useRef } from 'react'
import { reviewTheme } from '@/components/review/review-theme'
import { useUiLocale } from '@/lib/i18n/ui-locale-context'
import type { UiMessages } from '@/lib/i18n/translations'
import type { PaperMeta, PaperComparison } from '@/app/api/compare/papers/route'

type Phase = 'idle' | 'loading' | 'done' | 'error'

interface ArxivSlot { kind: 'arxiv'; id: string }
interface UploadSlot { kind: 'upload'; uploading: boolean; title: string | null; abstract: string | null; err: string | null }
type Slot = ArxivSlot | UploadSlot

function emptyArxiv(): ArxivSlot { return { kind: 'arxiv', id: '' } }
function emptyUpload(): UploadSlot { return { kind: 'upload', uploading: false, title: null, abstract: null, err: null } }

const COMPARISON_ROWS: { key: keyof Omit<PaperComparison, 'verdict'>; tKey: keyof UiMessages; color: string }[] = [
  { key: 'methodology',      tKey: 'compare_row_methodology',    color: '#1d4ed8' },
  { key: 'data_experiments', tKey: 'compare_row_data',           color: '#7c3aed' },
  { key: 'contributions',    tKey: 'compare_row_contributions',  color: '#065f46' },
  { key: 'limitations',      tKey: 'compare_row_limitations',    color: '#9a3412' },
  { key: 'novelty',          tKey: 'compare_row_novelty',        color: '#92400e' },
]

const TEAM_COLORS = ['#1d4ed8', '#065f46', '#7c3aed', '#9a3412']

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.9s linear infinite' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 11.5v1.5a1 1 0 001 1h9a1 1 0 001-1v-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M8 10V3m0 0L5.5 5.5M8 3l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function PaperSlotInput({
  index,
  slot,
  onSlotChange,
  onRemove,
  canRemove,
}: {
  index: number
  slot: Slot
  onSlotChange: (s: Slot) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const color = TEAM_COLORS[index] ?? '#555'
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      onSlotChange({ kind: 'upload', uploading: false, title: null, abstract: null, err: 'Only PDF files are supported' })
      return
    }
    onSlotChange({ kind: 'upload', uploading: true, title: null, abstract: null, err: null })
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/papers/asset', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onSlotChange({ kind: 'upload', uploading: false, title: data.title ?? file.name.replace(/\.pdf$/i, ''), abstract: data.abstract ?? '', err: null })
    } catch (err) {
      onSlotChange({ kind: 'upload', uploading: false, title: null, abstract: null, err: err instanceof Error ? err.message : 'Upload failed' })
    }
  }

  const badge = (
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      background: color, color: '#fff',
      fontSize: 10, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {index + 1}
    </div>
  )

  const removeBtn = canRemove && (
    <button
      type="button"
      onClick={onRemove}
      style={{
        width: 30, height: 30,
        border: `1px solid ${reviewTheme.colors.border}`, borderRadius: 7,
        background: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#999', flexShrink: 0, transition: 'color 120ms, border-color 120ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#999'; e.currentTarget.style.borderColor = reviewTheme.colors.border }}
    >
      <TrashIcon />
    </button>
  )

  const isUploadActive = slot.kind === 'upload' && (slot.uploading || slot.title !== null)
  const hasErr = slot.kind === 'upload' && !!slot.err

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {badge}
        <div
          style={{
            flex: 1,
            border: `1.5px solid ${hasErr ? '#fca5a5' : dragging ? color : reviewTheme.colors.border}`,
            borderRadius: 10,
            display: 'flex', alignItems: 'center',
            background: isUploadActive && slot.kind === 'upload' && slot.title ? `${color}06` : '#fff',
            transition: 'border-color 150ms',
            overflow: 'hidden',
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        >
          {isUploadActive ? (
            <>
              <span style={{ color: '#aaa', padding: '0 10px', flexShrink: 0 }}><UploadIcon /></span>
              {slot.kind === 'upload' && slot.uploading ? (
                <span style={{ fontSize: 12, color: '#aaa', flex: 1 }}><SpinnerIcon /> 上傳中…</span>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 600, color: reviewTheme.colors.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '10px 0' }}>
                  {slot.kind === 'upload' && slot.title}
                </span>
              )}
              <button
                type="button"
                onClick={() => onSlotChange(emptyArxiv())}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 16, padding: '0 12px', flexShrink: 0 }}
              >
                ×
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={slot.kind === 'arxiv' ? slot.id : ''}
                onChange={(e) => onSlotChange({ kind: 'arxiv', id: e.target.value })}
                placeholder={dragging ? '拖放 PDF 至此' : 'arXiv ID or URL (e.g. 2401.12345)'}
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  padding: '10px 13px', fontSize: 13, fontFamily: 'monospace',
                  color: reviewTheme.colors.ink, background: 'transparent',
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 9px', margin: 4,
                  border: `1px solid ${reviewTheme.colors.border}`, borderRadius: 7,
                  background: '#fafafa', cursor: 'pointer',
                  fontSize: 11, color: '#888', fontWeight: 600,
                  flexShrink: 0, transition: 'border-color 120ms, color 120ms',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = reviewTheme.colors.border; e.currentTarget.style.color = '#888' }}
              >
                <UploadIcon /> PDF
              </button>
            </>
          )}
        </div>
        {removeBtn}
      </div>
      {slot.kind === 'upload' && slot.err && (
        <div style={{ fontSize: 11, color: '#dc2626', paddingLeft: 32 }}>{slot.err}</div>
      )}
      {slot.kind === 'upload' && slot.abstract && (
        <div style={{
          marginLeft: 32, padding: '8px 12px', borderRadius: 8,
          background: `${color}08`, border: `1px solid ${color}20`,
          fontSize: 11, color: reviewTheme.colors.muted, lineHeight: 1.55,
          maxHeight: 60, overflow: 'hidden',
        }}>
          {slot.abstract.slice(0, 200)}{slot.abstract.length > 200 ? '…' : ''}
        </div>
      )}
      <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}

function PaperCard({ paper, index }: { paper: PaperMeta; index: number }) {
  const color = TEAM_COLORS[index] ?? '#555'
  const t = useUiLocale()
  return (
    <div style={{
      flex: 1,
      minWidth: 200,
      padding: '14px 16px',
      borderRadius: 13,
      border: `1.5px solid ${color}30`,
      background: `${color}08`,
    }}>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
        marginBottom: 6,
      }}>
        {t.table_paper} {index + 1}{paper.arxivId ? ` · arXiv:${paper.arxivId}` : ` · ${t.compare_pdf_upload}`}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: reviewTheme.colors.ink,
        lineHeight: 1.35,
        marginBottom: 8,
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      } as React.CSSProperties}>
        {paper.title}
      </div>
      {paper.arxivId && (
        <a
          href={`https://arxiv.org/abs/${paper.arxivId}`}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, color, textDecoration: 'none', fontWeight: 600 }}
        >
          {t.compare_view_arxiv}
        </a>
      )}
    </div>
  )
}

function CompareTable({ papers, comparison }: { papers: PaperMeta[]; comparison: PaperComparison }) {
  const t = useUiLocale()
  const n = papers.length
  const colWidth = n <= 2 ? 280 : n === 3 ? 220 : 175

  return (
    <div style={{ borderRadius: 16, border: `1px solid ${reviewTheme.colors.border}`, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          borderCollapse: 'collapse',
          width: '100%',
          minWidth: 160 + n * colWidth,
          tableLayout: 'fixed',
        }}>
          <colgroup>
            <col style={{ width: 160 }} />
            {papers.map((_, i) => <col key={i} style={{ width: colWidth }} />)}
          </colgroup>

          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={{
                padding: '11px 16px',
                borderBottom: `2px solid ${reviewTheme.colors.border}`,
                textAlign: 'left',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: '#a1a1aa',
                textTransform: 'uppercase',
              }}>
                {t.table_dimension}
              </th>
              {papers.map((p, i) => (
                <th key={i} style={{
                  padding: '11px 16px',
                  borderBottom: `2px solid ${reviewTheme.colors.border}`,
                  borderLeft: `1px solid ${reviewTheme.colors.border}`,
                  textAlign: 'left',
                }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: TEAM_COLORS[i] ?? '#555',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: 3,
                  }}>
                    {t.table_paper} {i + 1}
                  </div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: reviewTheme.colors.ink,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  } as React.CSSProperties}>
                    {p.title}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {COMPARISON_ROWS.map((row, rowIdx) => (
              <tr key={row.key} style={{ background: rowIdx % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{
                  padding: '13px 16px',
                  borderBottom: `1px solid ${reviewTheme.colors.border}`,
                  verticalAlign: 'top',
                }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: row.color,
                    background: `${row.color}12`,
                    border: `1px solid ${row.color}25`,
                    borderRadius: 4,
                    padding: '2px 7px',
                  }}>
                    {t[row.tKey]}
                  </span>
                </td>
                {papers.map((_, i) => (
                  <td key={i} style={{
                    padding: '13px 16px',
                    borderBottom: `1px solid ${reviewTheme.colors.border}`,
                    borderLeft: `1px solid ${reviewTheme.colors.border}`,
                    verticalAlign: 'top',
                    fontSize: 12,
                    color: reviewTheme.colors.muted,
                    lineHeight: 1.6,
                  }}>
                    {comparison[row.key][i] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Verdict row */}
      <div style={{
        padding: '18px 20px',
        background: `${reviewTheme.colors.accent}08`,
        borderTop: `1.5px solid ${reviewTheme.colors.accent}25`,
      }}>
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: reviewTheme.colors.accent,
          marginBottom: 8,
        }}>
          {t.compare_verdict}
        </div>
        <p style={{
          fontSize: 13,
          color: reviewTheme.colors.ink,
          lineHeight: 1.65,
          margin: 0,
        }}>
          {comparison.verdict}
        </p>
      </div>
    </div>
  )
}

function isSlotFilled(s: Slot): boolean {
  if (s.kind === 'arxiv') return s.id.trim().length > 0
  return s.title !== null
}

export default function ComparePage() {
  const t = useUiLocale()
  const [slots, setSlots] = useState<Slot[]>([emptyArxiv(), emptyArxiv()])
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [papers, setPapers] = useState<PaperMeta[]>([])
  const [comparison, setComparison] = useState<PaperComparison | null>(null)

  const filledCount = slots.filter(isSlotFilled).length
  const canCompare = filledCount >= 2 && phase !== 'loading'

  function updateSlot(index: number, s: Slot) {
    setSlots((prev) => prev.map((v, i) => (i === index ? s : v)))
  }

  function addSlot() {
    if (slots.length < 4) setSlots((prev) => [...prev, emptyArxiv()])
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleCompare() {
    const paperInputs = slots
      .filter(isSlotFilled)
      .map((s) => {
        if (s.kind === 'arxiv') {
          return {
            kind: 'arxiv' as const,
            arxivId: s.id.trim().replace(/^https?:\/\/arxiv\.org\/abs\//i, '').replace(/^arxiv:/i, ''),
          }
        }
        return { kind: 'upload' as const, title: s.title!, abstract: s.abstract ?? '' }
      })

    if (paperInputs.length < 2) return

    setPhase('loading')
    setError(null)
    setPapers([])
    setComparison(null)

    try {
      const res = await fetch('/api/compare/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers: paperInputs }),
      })
      const data = await res.json() as { papers?: PaperMeta[]; comparison?: PaperComparison; error?: string }

      if (!res.ok || data.error) {
        setError(data.error ?? 'Comparison failed')
        setPhase('error')
        return
      }

      setPapers(data.papers ?? [])
      setComparison(data.comparison ?? null)
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setPhase('error')
    }
  }

  function handleReset() {
    setPhase('idle')
    setError(null)
    setPapers([])
    setComparison(null)
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '40px 24px 80px',
        fontFamily: reviewTheme.fonts.body,
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: reviewTheme.colors.softMuted,
            marginBottom: 8,
          }}>
            {t.compare_research_tool}
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            color: reviewTheme.colors.ink,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            fontFamily: reviewTheme.fonts.display,
          }}>
            {t.compare_title}
          </h1>
          <p style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: reviewTheme.colors.muted,
            lineHeight: 1.55,
          }}>
            {t.compare_subtitle}
          </p>
        </div>

        {/* Input panel */}
        <div style={{
          background: '#fff',
          border: `1px solid ${reviewTheme.colors.border}`,
          borderRadius: 18,
          padding: '22px 20px',
          marginBottom: 24,
          boxShadow: '0 4px 16px rgba(63, 43, 24, 0.05)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {slots.map((slot, i) => (
              <PaperSlotInput
                key={i}
                index={i}
                slot={slot}
                onSlotChange={(s) => updateSlot(i, s)}
                onRemove={() => removeSlot(i)}
                canRemove={slots.length > 2}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {slots.length < 4 && (
              <button
                type="button"
                onClick={addSlot}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  border: `1px dashed ${reviewTheme.colors.border}`,
                  borderRadius: 9,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: reviewTheme.colors.muted,
                  fontWeight: 500,
                  transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = reviewTheme.colors.accent; e.currentTarget.style.color = reviewTheme.colors.accent }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = reviewTheme.colors.border; e.currentTarget.style.color = reviewTheme.colors.muted }}
              >
                <PlusIcon />
                {t.compare_add_paper}
              </button>
            )}

            <div style={{ flex: 1 }} />

            {phase === 'done' && (
              <button
                type="button"
                onClick={handleReset}
                style={{
                  padding: '8px 16px',
                  border: `1px solid ${reviewTheme.colors.border}`,
                  borderRadius: 9,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: reviewTheme.colors.muted,
                  fontWeight: 500,
                }}
              >
                {t.compare_new}
              </button>
            )}

            <button
              type="button"
              onClick={handleCompare}
              disabled={!canCompare}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 20px',
                border: 'none',
                borderRadius: 9,
                background: canCompare ? reviewTheme.colors.accent : '#d1d5db',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: canCompare ? 'pointer' : 'not-allowed',
                transition: 'background 150ms',
              }}
            >
              {phase === 'loading' ? <SpinnerIcon /> : null}
              {phase === 'loading' ? t.compare_running : t.compare_run}
            </button>
          </div>
        </div>

        {/* Error */}
        {phase === 'error' && error && (
          <div style={{
            padding: '14px 18px',
            borderRadius: 12,
            background: reviewTheme.colors.errorBg,
            border: `1px solid ${reviewTheme.colors.errorBorder}`,
            color: reviewTheme.colors.errorText,
            fontSize: 13,
            marginBottom: 24,
          }}>
            {error}
          </div>
        )}

        {/* Loading state */}
        {phase === 'loading' && (
          <div style={{
            textAlign: 'center',
            padding: '60px 0',
            color: reviewTheme.colors.softMuted,
            fontSize: 13,
          }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <SpinnerIcon />
            </div>
            {t.compare_fetching_msg}
          </div>
        )}

        {/* Results */}
        {phase === 'done' && papers.length > 0 && comparison && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Paper cards */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {papers.map((p, i) => (
                <PaperCard key={p.arxivId} paper={p} index={i} />
              ))}
            </div>

            {/* Comparison table */}
            <CompareTable papers={papers} comparison={comparison} />
          </div>
        )}
      </div>
    </>
  )
}
