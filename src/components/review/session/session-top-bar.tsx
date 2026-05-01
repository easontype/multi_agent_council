'use client'

import type { ReviewPhase } from '@/hooks/use-council-review'

interface SessionTopBarProps {
  paperTitle: string
  sourceSummary: string
  phase: ReviewPhase
  sessionId: string
  isPublic: boolean
  shareLoading: boolean
  shareCopied: boolean
  activeCount: number
  rounds: 1 | 2
  currentView: 'timeline' | 'compare' | 'map'
  canRerun: boolean
  rerunLoading: boolean
  onViewChange: (view: 'timeline' | 'compare' | 'map') => void
  onRerun: () => void
  onDuplicateAsNew: () => void
  onExport: () => void
  onSetShareAccess: (nextPublic: boolean) => void
  onCopyShareLink: () => void
}

const STATUS_CONFIG: Record<ReviewPhase, { dot: string; label: string; pulse: boolean }> = {
  error: { dot: '#ef4444', label: 'Error', pulse: false },
  ingesting: { dot: '#f59e0b', label: 'Preparing', pulse: true },
  running: { dot: '#f59e0b', label: 'In Progress', pulse: true },
  concluded: { dot: '#16a34a', label: 'Concluded', pulse: false },
  idle: { dot: '#9ca3af', label: 'Saved', pulse: false },
}

const VIEW_OPTIONS = [
  { key: 'timeline' as const, label: 'Timeline' },
  { key: 'compare' as const, label: 'Compare' },
  { key: 'map' as const, label: 'Map' },
]

export function SessionTopBar({
  paperTitle,
  sourceSummary,
  phase,
  sessionId,
  isPublic,
  shareLoading,
  shareCopied,
  activeCount,
  rounds,
  currentView,
  canRerun,
  rerunLoading,
  onViewChange,
  onRerun,
  onDuplicateAsNew,
  onExport,
  onSetShareAccess,
  onCopyShareLink,
}: SessionTopBarProps) {
  const statusConfig = STATUS_CONFIG[phase]
  const isPreparing = phase === 'ingesting'
  const isRunning = phase === 'running'
  const hasSession = Boolean(sessionId && sessionId !== 'demo-session')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '18px 24px 16px',
        borderBottom: '1px solid #ececf1',
        background: 'linear-gradient(180deg, #ffffff 0%, #fafaf9 100%)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <a
              href="/home/reviews"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#71717a',
                textDecoration: 'none',
              }}
            >
              Back to Reviews
            </a>
            <span style={{ color: '#d4d4d8' }}>/</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#71717a',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: statusConfig.dot,
                  ...(statusConfig.pulse ? { animation: 'hdr-pulse 1.2s ease-in-out infinite' } : {}),
                }}
              />
              {statusConfig.label}
            </span>
          </div>

          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                lineHeight: 1.15,
                fontWeight: 650,
                color: '#18181b',
              }}
            >
              {paperTitle}
            </h1>
            <div
              style={{
                marginTop: 7,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                color: '#71717a',
                fontSize: 13,
              }}
            >
              <span>{activeCount} agents</span>
              <span>{rounds} round{rounds > 1 ? 's' : ''}</span>
              {hasSession && <span>Session {sessionId.slice(0, 8)}</span>}
              <span>{sourceSummary}</span>
              {(isPreparing || isRunning) && (
                <span>{isPreparing ? 'Paper ingest is running' : 'Panel is streaming responses'}</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={onRerun}
            disabled={!canRerun || rerunLoading}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px',
              border: '1px solid #e4e4e7',
              borderRadius: 8,
              background: '#fff',
              color: canRerun ? '#3f3f46' : '#a1a1aa',
              cursor: !canRerun || rerunLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {rerunLoading ? 'Rerunning...' : 'Rerun Review'}
          </button>
          <button
            onClick={onDuplicateAsNew}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px',
              border: '1px solid #e4e4e7',
              borderRadius: 8,
              background: '#fff',
              color: '#3f3f46',
              cursor: 'pointer',
            }}
          >
            Duplicate as New
          </button>
          <button
            onClick={onExport}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px',
              border: '1px solid #e4e4e7',
              borderRadius: 8,
              background: '#fff',
              color: '#3f3f46',
              cursor: 'pointer',
            }}
          >
            Export .md
          </button>
          <button
            onClick={() => onSetShareAccess(!isPublic)}
            disabled={shareLoading}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px',
              border: `1px solid ${isPublic ? '#d4d4d8' : '#e4e4e7'}`,
              borderRadius: 8,
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
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px',
              border: `1px solid ${isPublic ? '#111827' : '#e4e4e7'}`,
              borderRadius: 8,
              background: isPublic ? '#111827' : '#fff',
              color: isPublic ? '#fff' : '#3f3f46',
              cursor: shareLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {shareCopied ? 'Link copied!' : 'Copy Share URL'}
          </button>
          {isPublic && hasSession && (
            <a
              href={`/share/${sessionId}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 12,
                fontWeight: 600,
                padding: '8px 12px',
                border: '1px solid #e4e4e7',
                borderRadius: 8,
                background: '#fff',
                color: '#3f3f46',
                textDecoration: 'none',
              }}
            >
              Open Shared Page
            </a>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            border: '1px solid #e4e4e7',
            borderRadius: 999,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {VIEW_OPTIONS.map((item) => {
            const active = currentView === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onViewChange(item.key)}
                style={{
                  border: 'none',
                  background: active ? '#111827' : 'transparent',
                  color: active ? '#fff' : '#71717a',
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <div
          style={{
            fontSize: 12,
            color: '#71717a',
          }}
        >
          Left canvas: debate workspace. Right rail: sources, metadata, and paper chat.
        </div>
      </div>
    </div>
  )
}
