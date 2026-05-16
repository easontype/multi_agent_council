'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Stage =
  | { kind: 'idle' }
  | { kind: 'arxiv_fetching'; id: string }
  | { kind: 'arxiv_preview'; arxivId: string; title: string; abstract: string; url: string }
  | { kind: 'pdf_ready'; file: File }
  | { kind: 'confirming'; label: string }
  | { kind: 'confirmed'; assetId: string; title: string; abstract: string }

export function PaperInputBox() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [arxivInput, setArxivInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  /* ─── helpers ─────────────────────────────────────────── */

  const reset = () => {
    setStage({ kind: 'idle' })
    setArxivInput('')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const fetchPreview = async (raw: string) => {
    const id = raw.trim().replace(/^arxiv:/i, '').replace(/^https?:\/\/arxiv\.org\/abs\//i, '')
    if (!id) return
    setError(null)
    setStage({ kind: 'arxiv_fetching', id })
    try {
      const res = await fetch(`/api/papers/preview?arxiv=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Preview failed')
      setStage({ kind: 'arxiv_preview', arxivId: data.arxivId, title: data.title, abstract: data.abstract, url: data.url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
      setStage({ kind: 'idle' })
    }
  }

  const handleArxivSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchPreview(arxivInput)
  }

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf') { setError('Only PDF files are supported'); return }
    if (file.size > 20 * 1024 * 1024) { setError('File exceeds 20 MB limit'); return }
    setError(null)
    setStage({ kind: 'pdf_ready', file })
  }

  const handleConfirm = async () => {
    setError(null)

    if (stage.kind === 'arxiv_preview') {
      setStage({ kind: 'confirming', label: stage.title })
      try {
        const res = await fetch('/api/papers/asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ arxivId: stage.arxivId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Ingest failed')
        setStage({ kind: 'confirmed', assetId: data.paperAssetId, title: data.title, abstract: data.abstract })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process paper')
        setStage({ kind: 'idle' })
      }
    } else if (stage.kind === 'pdf_ready') {
      setStage({ kind: 'confirming', label: stage.file.name.replace(/\.pdf$/i, '') })
      try {
        const form = new FormData()
        form.append('file', stage.file)
        const res = await fetch('/api/papers/asset', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Ingest failed')
        setStage({ kind: 'confirmed', assetId: data.paperAssetId, title: data.title, abstract: data.abstract })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process paper')
        setStage({ kind: 'idle' })
      }
    }
  }

  /* ─── mode launch ──────────────────────────────────────── */

  const launch = (mode: 'review' | 'debate') => {
    if (stage.kind !== 'confirmed') return
    const base = mode === 'review' ? '/review/setup' : '/debate/setup'
    router.push(`${base}/${stage.assetId}`)
  }

  /* ─── drag ─────────────────────────────────────────────── */

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  /* ─── render ────────────────────────────────────────────── */

  const isIdle = stage.kind === 'idle'
  const isFetching = stage.kind === 'arxiv_fetching'

  return (
    <div style={{ marginBottom: 28 }}>

      {/* ── Input row (arxiv ID entry) — shown when idle / fetching ── */}
      {(isIdle || isFetching) && (
        <form onSubmit={handleArxivSubmit}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: `1.5px solid ${dragging ? '#111' : '#e4e4e7'}`,
            borderRadius: 10, background: '#fff', padding: '6px 6px 6px 14px',
            transition: 'border-color 120ms',
          }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="text"
              value={arxivInput}
              onChange={e => setArxivInput(e.target.value)}
              placeholder={dragging ? 'Drop PDF here' : 'arXiv ID or URL  ·  or drop a PDF'}
              autoFocus
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 13.5, color: '#111', fontFamily: 'inherit',
              }}
            />

            {/* PDF upload button */}
            <button
              type="button"
              title="Upload PDF"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 7,
                border: '1px solid #e4e4e7', background: '#fafafa',
                cursor: 'pointer', flexShrink: 0, color: '#666',
              }}
            >
              <UploadIcon />
            </button>

            {/* Fetch / loading button */}
            <button
              type="submit"
              disabled={isFetching || !arxivInput.trim()}
              style={{
                padding: '0 14px', height: 34, borderRadius: 7, border: 'none',
                background: isFetching || !arxivInput.trim() ? '#f4f4f5' : '#111',
                color: isFetching || !arxivInput.trim() ? '#aaa' : '#fff',
                fontSize: 12.5, fontWeight: 600, cursor: isFetching || !arxivInput.trim() ? 'default' : 'pointer',
                flexShrink: 0, transition: 'background 120ms, color 120ms',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {isFetching ? <SpinnerIcon /> : null}
              {isFetching ? 'Fetching…' : 'Fetch'}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
          />
        </form>
      )}

      {/* ── arXiv preview card ── */}
      {stage.kind === 'arxiv_preview' && (
        <PreviewCard
          eyebrow={`arXiv ${stage.arxivId}`}
          title={stage.title}
          abstract={stage.abstract}
          onConfirm={handleConfirm}
          onCancel={reset}
        />
      )}

      {/* ── PDF ready card ── */}
      {stage.kind === 'pdf_ready' && (
        <PreviewCard
          eyebrow={`PDF  ·  ${formatBytes(stage.file.size)}`}
          title={stage.file.name.replace(/\.pdf$/i, '')}
          abstract="Embedding will start after confirmation. We'll extract and index the full text of your PDF."
          onConfirm={handleConfirm}
          onCancel={reset}
        />
      )}

      {/* ── Confirming (spinner) ── */}
      {stage.kind === 'confirming' && (
        <div style={{
          border: '1.5px solid #e4e4e7', borderRadius: 10, padding: '20px 20px',
          display: 'flex', alignItems: 'center', gap: 12, color: '#666', fontSize: 13,
        }}>
          <SpinnerIcon size={16} />
          <span>Processing <em style={{ color: '#1a1a1a', fontStyle: 'normal', fontWeight: 600 }}>{stage.label}</em>…</span>
        </div>
      )}

      {/* ── Confirmed: mode selection ── */}
      {stage.kind === 'confirmed' && (
        <div>
          {/* confirmed paper strip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: '1px solid #f0f0f2', paddingBottom: 14, marginBottom: 18,
          }}>
            <CheckIcon />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: '#1a1a1a',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {stage.title}
              </div>
            </div>
            <button
              onClick={reset}
              style={{
                marginLeft: 'auto', flexShrink: 0,
                fontSize: 11.5, color: '#aaa', background: 'none',
                border: 'none', cursor: 'pointer', padding: '2px 6px',
              }}
            >
              Change
            </button>
          </div>

          {/* mode cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <ModeCard
              icon={<ReviewIcon />}
              title="審查論文"
              sub="Paper Review"
              description="Multi-agent critical review — methods, literature, novelty, statistics."
              onClick={() => launch('review')}
              accent="#111"
            />
            <ModeCard
              icon={<DebateIcon />}
              title="對抗辯論"
              sub="Adversarial Debate"
              description="Two opposing councils argue for and against the paper's claims."
              onClick={() => launch('debate')}
              accent="#1e3a8a"
            />
          </div>
        </div>
      )}

      {/* ── error ── */}
      {error && (
        <div style={{
          marginTop: 8, fontSize: 12, color: '#b91c1c',
          padding: '6px 10px', background: '#fef2f2', borderRadius: 6,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

/* ─── sub-components ────────────────────────────────────── */

function PreviewCard({
  eyebrow, title, abstract, onConfirm, onCancel,
}: {
  eyebrow: string
  title: string
  abstract: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div style={{ border: '1.5px solid #e4e4e7', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #f0f0f2' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#aaa', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
          {eyebrow}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111', lineHeight: 1.35, marginBottom: 6 }}>
          {title}
        </div>
        {abstract && (
          <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.6, maxHeight: 72, overflow: 'hidden' }}>
            {abstract}
          </div>
        )}
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', gap: 8, justifyContent: 'flex-end', background: '#fafafa' }}>
        <button onClick={onCancel} style={{
          border: '1px solid #e4e4e7', borderRadius: 7, padding: '6px 14px',
          background: '#fff', color: '#52525b', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
        }}>
          Cancel
        </button>
        <button onClick={onConfirm} style={{
          border: 'none', borderRadius: 7, padding: '6px 18px',
          background: '#111', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}>
          Confirm
        </button>
      </div>
    </div>
  )
}

function ModeCard({
  icon, title, sub, description, onClick, accent,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  description: string
  onClick: () => void
  accent: string
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left',
        padding: '16px 18px 14px', borderRadius: 10, cursor: 'pointer',
        border: `1.5px solid ${hover ? accent : '#e4e4e7'}`,
        background: hover ? (accent === '#111' ? '#111' : '#1e3a8a') : '#fff',
        transition: 'all 150ms ease', outline: 'none',
      }}
    >
      <div style={{ color: hover ? '#fff' : accent, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: hover ? '#fff' : '#111', letterSpacing: '-0.02em', fontFamily: "'Georgia', serif" }}>
        {title}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: hover ? 'rgba(255,255,255,0.6)' : '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        {sub}
      </div>
      <div style={{ fontSize: 12, color: hover ? 'rgba(255,255,255,0.75)' : '#71717a', lineHeight: 1.55 }}>
        {description}
      </div>
    </button>
  )
}

/* ─── tiny icons ────────────────────────────────────────── */

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 11.5v1.5a1 1 0 001 1h9a1 1 0 001-1v-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M8 10V3m0 0L5.5 5.5M8 3l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="8.25" stroke="#16a34a" strokeWidth="1.5"/>
      <path d="M5.5 9l2.5 2.5 4.5-5" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SpinnerIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" style={{ animation: 'spin 700ms linear infinite', flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25"/>
      <path d="M6.5 1.5a5 5 0 015 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function ReviewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2.5" width="14" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6.5 7h7M6.5 10h7M6.5 13h4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

function DebateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 4.5h7a1 1 0 011 1v4a1 1 0 01-1 1H6l-3 2V5.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M17 9.5h-4a1 1 0 00-1 1v3a1 1 0 001 1h2l2 1.5V10.5a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
