'use client'

import { CompareView } from '@/components/council/compare-view'
import { DebateMap } from '@/components/council/debate-map'
import { DiscussionTimeline } from '@/components/council/discussion-timeline'
import { GapMapView } from '@/components/council/gap-map-view'
import { ReviewSidebar } from '@/components/council/review-sidebar'
import type { SourceReaderTarget } from '@/components/council/source-reader-panel'
import { SessionTopBar } from './session-top-bar'
import type { ReviewPhase } from '@/hooks/use-council-review'
import type { DiscussionSession } from '@/types/council'
import { ReviewPageBody, ReviewRailCard } from '../review-primitives'
import { panelHeaderStyle, pillStyle, reviewTheme, sectionEyebrowStyle, softCard } from '../review-theme'

interface SessionWorkspaceLayoutProps {
  session: DiscussionSession
  phase: ReviewPhase
  error: string | null
  canResume: boolean
  sourceSummary: string
  activeSourceLabel: string | null
  activeDocumentTarget: SourceReaderTarget | null
  sidebarTab: 'reader' | 'citations' | 'flow' | 'chat'
  currentView: 'timeline' | 'compare' | 'map' | 'gap-map'
  isPublic: boolean
  shareLoading: boolean
  shareCopied: boolean
  rerunLoading: boolean
  activeCount: number
  rounds: 1 | 2
  onSourceClick: (label: string) => void
  onTabChange: (tab: 'reader' | 'citations' | 'flow' | 'chat') => void
  onViewChange: (view: 'timeline' | 'compare' | 'map' | 'gap-map') => void
  onLocateInDocument: (docId: string, chunkIndex: number) => void
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
  onLocateInDocument,
}: {
  session: DiscussionSession
  currentView: 'timeline' | 'compare' | 'map' | 'gap-map'
  onSourceClick: (label: string) => void
  onLocateInDocument: (docId: string, chunkIndex: number) => void
}) {
  if (currentView === 'compare') {
    return <CompareView session={session} onSourceClick={onSourceClick} />
  }

  if (currentView === 'map') {
    return <DebateMap session={session} />
  }

  if (currentView === 'gap-map') {
    return <GapMapView session={session} onLocateInDocument={onLocateInDocument} />
  }

  return <DiscussionTimeline session={session} onSourceClick={onSourceClick} onLocateInDocument={onLocateInDocument} />
}

export function SessionWorkspaceLayout({
  session,
  phase,
  error,
  canResume,
  sourceSummary,
  activeSourceLabel,
  activeDocumentTarget,
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
  onLocateInDocument,
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

      <ReviewPageBody
        className="review-session-grid"
        padding="18px"
      >
        <div
          style={{
            minHeight: 0,
            height: '100%',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.65fr) minmax(320px, 0.95fr)',
            gap: 18,
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
              style={panelHeaderStyle({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexShrink: 0,
              })}
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
                      : currentView === 'map'
                        ? 'Round 2 challenge graph and stance shifts.'
                        : 'Citation coverage heatmap — uncited sections shown as blind spots.'}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              <WorkspaceCanvas
                session={session}
                currentView={currentView}
                onSourceClick={onSourceClick}
                onLocateInDocument={onLocateInDocument}
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
              style={panelHeaderStyle({
                background: 'rgba(246, 241, 233, 0.78)',
                flexShrink: 0,
              })}
            >
              <div style={sectionEyebrowStyle({ marginBottom: 8 })}>
                Workspace Rail
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span style={pillStyle({ fontSize: 12, color: reviewTheme.colors.muted, padding: '5px 9px', boxShadow: 'none' })}>
                  {session.sourceRefs.length} sources
                </span>
                <span style={pillStyle({ fontSize: 12, color: reviewTheme.colors.muted, padding: '5px 9px', boxShadow: 'none' })}>
                  {session.messages.filter((message) => message.isComplete).length} completed turns
                </span>
                <span style={pillStyle({ fontSize: 12, color: reviewTheme.colors.muted, padding: '5px 9px', boxShadow: 'none' })}>
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
                <ReviewRailCard key={item.label} eyebrow={item.label}>
                  <div style={{ fontSize: 13, color: '#3f3f46' }}>{item.value}</div>
                </ReviewRailCard>
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
                activeDocumentTarget={activeDocumentTarget}
                tab={sidebarTab}
                onTabChange={onTabChange}
                onLocateInDocument={onLocateInDocument}
              />
            </div>
          </aside>
        </div>
        <style>{`
          @media (max-width: 1080px) {
            .review-session-grid > div {
              grid-template-columns: 1fr !important;
            }
          }
          @media (max-width: 900px) {
            .review-session-grid {
              padding: 12px !important;
            }
            .review-session-grid > div {
              gap: 12px !important;
            }
          }
        `}</style>
      </ReviewPageBody>
    </div>
  )
}
