'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DiscussionTimeline } from '@/components/council/discussion-timeline'
import { SourcePanel } from '@/components/council/source-panel'
import { useCouncilReview } from '@/hooks/use-council-review'

function BackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'hdr-spin 0.8s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function AnalyzeContent() {
  const searchParams = useSearchParams()
  const arxivId = searchParams.get('arxiv')
  const isUpload = searchParams.get('tab') === 'upload'

  const { session, phase, error, start } = useCouncilReview(arxivId)
  const [hasStarted, setHasStarted] = useState(false)

  const handleStart = () => {
    setHasStarted(true)
    start()
  }

  const isRunning = phase === 'ingesting' || phase === 'running'

  const statusConfig = phase === 'error'
    ? { dot: '#ef4444', label: 'Error', pulse: false }
    : phase === 'ingesting'
    ? { dot: '#f59e0b', label: 'Ingesting…', pulse: true }
    : phase === 'running'
    ? { dot: '#f59e0b', label: 'In Progress', pulse: true }
    : phase === 'concluded'
    ? { dot: '#22c55e', label: 'Concluded', pulse: false }
    : { dot: '#d1d5db', label: 'Ready', pulse: false }

  const sourceLabel = isUpload ? 'Upload' : arxivId ? arxivId : '—'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#fff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 54, flexShrink: 0,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid #f0f0f2',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 0 #f0f0f2',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/home" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            color: '#888', textDecoration: 'none',
            fontSize: 13, fontWeight: 500, padding: '5px 8px', borderRadius: 6,
            transition: 'color 150ms, background 150ms',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = '#333'; e.currentTarget.style.background = '#f5f5f7' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.background = 'transparent' }}
          >
            <BackIcon /> Back
          </a>

          <div style={{ width: 1, height: 16, background: '#ebebed' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', letterSpacing: '-0.02em' }}>Council</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              background: '#eef2ff', color: '#6366f1', borderRadius: 3,
              padding: '1px 5px', textTransform: 'uppercase',
            }}>Beta</span>
          </div>

          <div style={{ width: 1, height: 16, background: '#ebebed' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: '#bbb', textTransform: 'uppercase' }}>
              {isUpload ? 'PDF' : 'arXiv'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#444', fontVariantNumeric: 'tabular-nums' }}>
              {session.paperTitle || sourceLabel}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Status dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: statusConfig.dot,
              ...(statusConfig.pulse ? { animation: 'hdr-pulse 1.2s ease-in-out infinite' } : {}),
            }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#888' }}>{statusConfig.label}</span>
          </div>

          {error && (
            <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {error}
            </span>
          )}

          {!hasStarted && !error && (
            <button onClick={handleStart} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 16px', background: '#111', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '-0.01em',
              transition: 'background 150ms, box-shadow 200ms, transform 80ms',
              boxShadow: '0 1px 2px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#333'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)' }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <PlayIcon /> Start Review
            </button>
          )}

          {isRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#555' }}>
              <SpinnerIcon />
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                {phase === 'ingesting' ? 'Ingesting paper…' : 'Running…'}
              </span>
            </div>
          )}

          {phase === 'error' && (
            <button onClick={() => { setHasStarted(false) }} style={{
              fontSize: 12, fontWeight: 500, color: '#888',
              background: 'none', border: '1px solid #ebebed', borderRadius: 6,
              padding: '5px 12px', cursor: 'pointer',
            }}>
              Retry
            </button>
          )}
        </div>
      </header>

      {/* Split body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRight: '1px solid #f0f0f2' }}>
          <DiscussionTimeline session={session} />
        </div>
        <div style={{ flex: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
          <SourcePanel session={session} />
        </div>
      </div>

      <style>{`
        @keyframes hdr-pulse { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
        @keyframes hdr-spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
        background: '#fff', color: '#bbb', fontSize: 14,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      }}>
        Loading…
      </div>
    }>
      <AnalyzeContent />
    </Suspense>
  )
}
