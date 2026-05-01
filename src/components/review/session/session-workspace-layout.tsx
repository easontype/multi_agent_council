'use client'

import { CompareView } from '@/components/council/compare-view'
import { DebateMap } from '@/components/council/debate-map'
import { DiscussionTimeline } from '@/components/council/discussion-timeline'
import { ReviewSidebar } from '@/components/council/review-sidebar'
import { SessionTopBar } from './session-top-bar'
import type { ReviewPhase } from '@/hooks/use-council-review'
import type { DiscussionSession } from '@/types/council'
import { reviewTheme, sectionEyebrowStyle, softCard } from '../review-theme'

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
      className="review-session-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        background: `linear-gradient(180deg, ${reviewTheme.colors.pageGlow} 0%, ${reviewTheme.colors.page} 100%)`,
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
        className="review-session-grid"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.65fr) minmax(320px, 0.95fr)',
          gap: 18,
          padding: '18px',
        }}
      >
        <section
          style={{
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            ...softCard(),
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px 18px',
              borderBottom: `1px solid ${reviewTheme.colors.border}`,
              background: `linear-gradient(180deg, rgba(248,242,232,0.7) 0%, rgba(255,255,255,0.92) 100%)`,
              flexShrink: 0,
            }}
          >
            <div>
              <div style={sectionEyebrowStyle({ marginBottom: 3 })}>
                Debate Canvas
              </div>
              <div style={{ fontSize: 13.5, color: reviewTheme.colors.muted }}>
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
            ...softCard({ background: 'rgba(252,250,245,0.86)' }),
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${reviewTheme.colors.border}`,
              background: 'rgba(246, 241, 233, 0.78)',
              flexShrink: 0,
            }}
          >
            <div style={sectionEyebrowStyle({ marginBottom: 8 })}>
              Workspace Rail
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  color: reviewTheme.colors.muted,
                  background: '#fff',
                  border: `1px solid ${reviewTheme.colors.border}`,
                  borderRadius: 999,
                  padding: '5px 9px',
                }}
              >
                {session.sourceRefs.length} sources
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: reviewTheme.colors.muted,
                  background: '#fff',
                  border: `1px solid ${reviewTheme.colors.border}`,
                  borderRadius: 999,
                  padding: '5px 9px',
                }}
              >
                {session.messages.filter((message) => message.isComplete).length} completed turns
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: reviewTheme.colors.muted,
                  background: '#fff',
                  border: `1px solid ${reviewTheme.colors.border}`,
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
              borderBottom: `1px solid ${reviewTheme.colors.border}`,
              background: 'rgba(252,250,245,0.72)',
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
                  ...softCard({ borderRadius: 10, boxShadow: 'none', padding: '10px 11px' }),
                }}
              >
                <div style={sectionEyebrowStyle({ marginBottom: 4 })}>
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
                borderBottom: `1px solid ${reviewTheme.colors.border}`,
                background: '#fff',
                flexShrink: 0,
              }}
            >
              <div style={sectionEyebrowStyle({ marginBottom: 8 })}>
                Session Signals
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {error && (
                  <div style={{ border: `1px solid ${reviewTheme.colors.errorBorder}`, background: reviewTheme.colors.errorBg, color: reviewTheme.colors.errorText, borderRadius: 10, padding: '10px 11px', fontSize: 12 }}>
                    {error}
                  </div>
                )}
                {(session.alerts ?? []).slice(-2).map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      border: `1px solid ${alert.level === 'warning' ? reviewTheme.colors.warningBorder : reviewTheme.colors.infoBorder}`,
                      background: alert.level === 'warning' ? reviewTheme.colors.warningBg : reviewTheme.colors.infoBg,
                      color: alert.level === 'warning' ? reviewTheme.colors.warningText : reviewTheme.colors.infoText,
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
      <style>{`
        @media (max-width: 1080px) {
          .review-session-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 900px) {
          .review-session-grid {
            padding: 12px !important;
            gap: 12px !important;
          }
        }
      `}</style>
    </div>
  )
}
