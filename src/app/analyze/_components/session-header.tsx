'use client'

import { BackIcon, SpinnerIcon } from './icons'
import type { ReviewPhase } from '@/hooks/use-council-review'

interface SessionHeaderProps {
  paperTitle: string
  isUpload: boolean
  arxivId: string | null
  phase: ReviewPhase
  sessionId: string
  isPublic: boolean
  shareLoading: boolean
  shareCopied: boolean
  activeCount: number
  rounds: 1 | 2
  showSetup: boolean
  onExport: () => void
  onSetShareAccess: (nextPublic: boolean) => void
  onCopyShareLink: () => void
}

const STATUS_CONFIG: Record<ReviewPhase, { dot: string; label: string; pulse: boolean }> = {
  error:     { dot: '#ef4444', label: 'Error',       pulse: false },
  ingesting: { dot: '#f59e0b', label: 'Preparing',   pulse: true  },
  running:   { dot: '#f59e0b', label: 'In Progress', pulse: true  },
  concluded: { dot: '#16a34a', label: 'Concluded',   pulse: false },
  idle:      { dot: '#9ca3af', label: 'Staged',      pulse: false },
}

export function SessionHeader({
  paperTitle,
  isUpload,
  arxivId,
  phase,
  sessionId,
  isPublic,
  shareLoading,
  shareCopied,
  activeCount,
  rounds,
  showSetup,
  onExport,
  onSetShareAccess,
  onCopyShareLink,
}: SessionHeaderProps) {
  const statusConfig = STATUS_CONFIG[phase]
  const isPreparing = phase === 'ingesting'
  const isRunning = phase === 'running'
  const isConcluded = phase === 'concluded'
  const hasSession = Boolean(sessionId && sessionId !== 'demo-session')

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: 54, flexShrink: 0,
      background: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid #ececf1',
      position: 'sticky', top: 0, zIndex: 100,
      boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <a href="/home" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          color: '#71717a', textDecoration: 'none',
          fontSize: 13, fontWeight: 500, padding: '5px 8px', borderRadius: 6,
          transition: 'color 150ms, background 150ms',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#18181b'; e.currentTarget.style.background = '#f5f5f7' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.background = 'transparent' }}
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

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 1 }}>
            {isUpload ? 'PDF' : arxivId ? 'arXiv' : 'Paper'}
          </div>
          <div style={{
            fontSize: 13, fontWeight: 500, color: '#3f3f46',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420,
          }}>
            {paperTitle}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        {showSetup && (
          <span style={{ fontSize: 12, color: '#71717a' }}>
            {activeCount} agents - {rounds} round{rounds > 1 ? 's' : ''}
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: statusConfig.dot,
            ...(statusConfig.pulse ? { animation: 'hdr-pulse 1.2s ease-in-out infinite' } : {}),
          }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: '#71717a' }}>{statusConfig.label}</span>
        </div>

        {(isPreparing || isRunning) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#52525b' }}>
            <SpinnerIcon />
            <span style={{ fontSize: 12, fontWeight: 500 }}>
              {isPreparing ? 'Ingesting paper...' : 'Running panel...'}
            </span>
          </div>
        )}

        {isConcluded && hasSession && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onExport}
              style={{
                fontSize: 12, fontWeight: 600, padding: '5px 12px',
                border: '1px solid #e4e4e7', borderRadius: 6,
                background: '#fff', color: '#3f3f46', cursor: 'pointer',
              }}
            >
              Export .md
            </button>
            <button
              onClick={() => onSetShareAccess(!isPublic)}
              disabled={shareLoading}
              style={{
                fontSize: 12, fontWeight: 600, padding: '5px 12px',
                border: `1px solid ${isPublic ? '#d4d4d8' : '#e4e4e7'}`,
                borderRadius: 6,
                background: isPublic ? '#fafaf9' : '#fff',
                color: isPublic ? '#52525b' : '#3f3f46',
                cursor: shareLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isPublic ? 'Make Private' : 'Publish Link'}
            </button>
            <button
              onClick={onCopyShareLink}
              disabled={shareLoading}
              style={{
                fontSize: 12, fontWeight: 600, padding: '5px 12px',
                border: `1px solid ${isPublic ? '#111827' : '#e4e4e7'}`,
                borderRadius: 6,
                background: isPublic ? '#111827' : '#fff',
                color: isPublic ? '#fff' : '#3f3f46',
                cursor: shareLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {shareCopied ? 'Link copied!' : 'Copy Share URL'}
            </button>
            {isPublic && (
              <a
                href={`/share/${sessionId}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: 12, fontWeight: 600, padding: '5px 12px',
                  border: '1px solid #e4e4e7', borderRadius: 6,
                  background: '#fff', color: '#3f3f46', textDecoration: 'none',
                }}
              >
                Open Shared Page
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
