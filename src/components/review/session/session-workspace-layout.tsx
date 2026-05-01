'use client'

import { CompareView } from '@/components/council/compare-view'
import { DebateMap } from '@/components/council/debate-map'
import { DiscussionTimeline } from '@/components/council/discussion-timeline'
import { ReviewSidebar } from '@/components/council/review-sidebar'
import { SessionTopBar } from './session-top-bar'
import type { ReviewPhase } from '@/hooks/use-council-review'
import type { DiscussionSession } from '@/types/council'

interface SessionWorkspaceLayoutProps {
  session: DiscussionSession
  phase: ReviewPhase
  error: string | null
  canResume: boolean
  sourceSummary: string
  activeSourceLabel: string | null
  sidebarTab: 'sources' | 'chat'
  currentView: 'timeline' | 'compare' | 'map'
  isPublic: boolean
  shareLoading: boolean
  shareCopied: boolean
  rerunLoading: boolean
  activeCount: number
  rounds: 1 | 2
  onSourceClick: (label: string) => void
  onTabChange: (tab: 'sources' | 'chat') => void
  onViewChange: (view: 'timeline' | 'compare' | 'map') => void
  onRerun: () => void
  onDuplicateAsNew: () => void
  onExport: () => void
  onSetShareAccess: (nextPublic: boolean) => void
  onCopyShareLink: () => void
}

function WorkspaceCanvas({
  session,
  currentView,
  onSourceClick,
}: {
  session: DiscussionSession
  currentView: 'timeline' | 'compare' | 'map'
  onSourceClick: (label: string) => void
}) {
  if (currentView === 'compare') {
    return <CompareView session={session} onSourceClick={onSourceClick} />
  }

  if (currentView === 'map') {
    return <DebateMap session={session} />
  }

  return <DiscussionTimeline session={session} onSourceClick={onSourceClick} />
}

export function SessionWorkspaceLayout({
  session,
  phase,
  error,
  canResume,
  sourceSummary,
  activeSourceLabel,
  sidebarTab,
  currentView,
  isPublic,
  shareLoading,
  shareCopied,
  rerunLoading,
  activeCount,
  rounds,
  onSourceClick,
  onTabChange,
  onViewChange,
  onRerun,
  onDuplicateAsNew,
  onExport,
  onSetShareAccess,
  onCopyShareLink,
}: SessionWorkspaceLayoutProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        background: '#f5f5f4',
      }}
    >
      <SessionTopBar
        paperTitle={session.paperTitle || 'Review Session'}
        sourceSummary={sourceSummary}
        phase={phase}
        sessionId={session.id}
        isPublic={isPublic}
        shareLoading={shareLoading}
        shareCopied={shareCopied}
        activeCount={activeCount}
        rounds={rounds}
        currentView={currentView}
        canRerun={phase !== 'running' && phase !== 'ingesting'}
        rerunLoading={rerunLoading}
        onViewChange={onViewChange}
        onRerun={onRerun}
        onDuplicateAsNew={onDuplicateAsNew}
        onExport={onExport}
        onSetShareAccess={onSetShareAccess}
        onCopyShareLink={onCopyShareLink}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.65fr) minmax(320px, 0.95fr)',
          gap: 0,
        }}
      >
        <section
          style={{
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #e7e5e4',
            background: '#fff',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 18px',
              borderBottom: '1px solid #f0eeeb',
              background: '#fcfcfb',
              flexShrink: 0,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#a1a1aa',
                  marginBottom: 2,
                }}
              >
                Debate Canvas
              </div>
              <div style={{ fontSize: 13, color: '#52525b' }}>
                {currentView === 'timeline'
                  ? 'Live transcript, agent progression, and moderator synthesis.'
                  : currentView === 'compare'
                    ? 'Cross-agent comparison by dimension and debate round.'
                    : 'Round 2 challenge graph and stance shifts.'}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <WorkspaceCanvas
              session={session}
              currentView={currentView}
              onSourceClick={onSourceClick}
            />
          </div>
        </section>

        <aside
          style={{
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#fafaf9',
          }}
        >
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid #ececf1',
              background: '#f7f7f5',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#a1a1aa',
                marginBottom: 6,
              }}
            >
              Workspace Rail
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  color: '#52525b',
                  background: '#fff',
                  border: '1px solid #e7e5e4',
                  borderRadius: 999,
                  padding: '5px 9px',
                }}
              >
                {session.sourceRefs.length} sources
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: '#52525b',
                  background: '#fff',
                  border: '1px solid #e7e5e4',
                  borderRadius: 999,
                  padding: '5px 9px',
                }}
              >
                {session.messages.filter((message) => message.isComplete).length} completed turns
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: '#52525b',
                  background: '#fff',
                  border: '1px solid #e7e5e4',
                  borderRadius: 999,
                  padding: '5px 9px',
                }}
              >
                {sourceSummary}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
              padding: '14px 18px',
              borderBottom: '1px solid #ececf1',
              background: '#fafaf9',
              flexShrink: 0,
            }}
          >
            {[
              { label: 'Status', value: phase },
              { label: 'Current Round', value: session.currentRound ? `Round ${session.currentRound}` : 'Not started' },
              { label: 'Divergence', value: session.divergenceLevel ?? 'Not recorded' },
              { label: 'Resume', value: canResume ? 'Available' : 'No pending resume' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  border: '1px solid #ececf1',
                  borderRadius: 10,
                  background: '#fff',
                  padding: '10px 11px',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a1a1aa', marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 13, color: '#3f3f46' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {(error || (session.alerts?.length ?? 0) > 0) && (
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #ececf1',
                background: '#fff',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a1a1aa', marginBottom: 8 }}>
                Session Signals
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {error && (
                  <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 10, padding: '10px 11px', fontSize: 12 }}>
                    {error}
                  </div>
                )}
                {(session.alerts ?? []).slice(-2).map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      border: `1px solid ${alert.level === 'warning' ? '#fde68a' : '#dbeafe'}`,
                      background: alert.level === 'warning' ? '#fffbeb' : '#eff6ff',
                      color: alert.level === 'warning' ? '#92400e' : '#1d4ed8',
                      borderRadius: 10,
                      padding: '10px 11px',
                      fontSize: 12,
                    }}
                  >
                    {alert.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0 }}>
            <ReviewSidebar
              session={session}
              activeSourceLabel={activeSourceLabel}
              tab={sidebarTab}
              onTabChange={onTabChange}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
