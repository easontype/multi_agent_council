'use client'

import type { ReviewPhase } from '@/hooks/use-council-review'
import { ReviewActionButton } from '../review-primitives'
import { heroGradientStyle, pillStyle, reviewTheme, sectionEyebrowStyle } from '../review-theme'

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
      className="review-session-top-bar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '24px 28px 18px',
        borderBottom: `1px solid ${reviewTheme.colors.border}`,
        ...heroGradientStyle(),
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
                color: reviewTheme.colors.muted,
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
                ...sectionEyebrowStyle({ fontSize: 11, color: reviewTheme.colors.muted }),
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
                fontSize: 30,
                lineHeight: 1.02,
                fontWeight: 650,
                color: reviewTheme.colors.ink,
                fontFamily: reviewTheme.fonts.display,
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
                color: reviewTheme.colors.muted,
                fontSize: 13.5,
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
          <ReviewActionButton
            onClick={onRerun}
            disabled={!canRerun || rerunLoading}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px',
            }}
          >
            {rerunLoading ? 'Rerunning...' : 'Rerun Review'}
          </ReviewActionButton>
          <ReviewActionButton
            onClick={onDuplicateAsNew}
            style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px' }}
          >
            Duplicate as New
          </ReviewActionButton>
          <ReviewActionButton
            onClick={onExport}
            style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px' }}
          >
            Export .md
          </ReviewActionButton>
          <button
            onClick={() => onSetShareAccess(!isPublic)}
            disabled={shareLoading}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 12px',
              border: `1px solid ${isPublic ? reviewTheme.colors.borderStrong : reviewTheme.colors.border}`,
              borderRadius: 999,
              background: isPublic ? '#fafaf9' : '#fff',
              color: isPublic ? reviewTheme.colors.muted : '#3f3f46',
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
              border: `1px solid ${isPublic ? reviewTheme.colors.accent : reviewTheme.colors.border}`,
              borderRadius: 999,
              background: isPublic ? reviewTheme.colors.accent : '#fff',
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
                border: `1px solid ${reviewTheme.colors.border}`,
                borderRadius: 999,
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
            ...pillStyle({ padding: 0, gap: 0 }),
            overflow: 'hidden',
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
                  background: active ? reviewTheme.colors.accent : 'transparent',
                  color: active ? '#fff' : '#71717a',
                  padding: '8px 16px',
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
            color: reviewTheme.colors.muted,
          }}
        >
          Left canvas: debate workspace. Right rail: sources, metadata, and paper chat.
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .review-session-top-bar {
            padding: 20px 18px 14px !important;
          }
        }
      `}</style>
    </div>
  )
}
