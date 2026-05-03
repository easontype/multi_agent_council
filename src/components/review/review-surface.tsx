'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SessionRestoreBanner } from '@/components/council/session-restore-banner'
import { useCouncilReview } from '@/hooks/use-council-review'
import { ReviewDraftHeader } from './new/review-draft-header'
import { ReviewDraftLayout } from './new/review-draft-layout'
import { SessionWorkspaceLayout } from './session/session-workspace-layout'
import { reviewTheme } from './review-theme'
import { useReviewDraftState } from './use-review-draft-state'
import { useReviewSessionWorkspaceState } from './use-review-session-workspace-state'

export type ReviewSurfaceMode = 'draft' | 'session'

interface ReviewSurfaceProps {
  mode: ReviewSurfaceMode
  forcedSessionId?: string | null
}

function WorkspaceLoading({ label }: { label: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        fontSize: 14,
      }}
    >
      {label}
    </div>
  )
}

function ReviewSurfaceContent({ mode, forcedSessionId }: ReviewSurfaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDraftRoute = mode === 'draft'
  const routeArxivId = isDraftRoute ? searchParams.get('arxiv') : null

  const { session, phase, error, isRestoring, canResume, loadSession, resumeSession, rerunSession } = useCouncilReview(routeArxivId)
  const draftState = useReviewDraftState({
    isDraftRoute,
    routeArxivId,
    router,
  })
  const sessionState = useReviewSessionWorkspaceState({
    mode,
    forcedSessionId,
    router,
    session,
    phase,
    isRestoring,
    resumeSession,
    loadSession,
    rerunSession,
  })
  const paperTitle = session.paperTitle || draftState.paperTitle
  const showSetup = isDraftRoute && !isRestoring && !session.id && (phase === 'idle' || phase === 'error')

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#fff',
      fontFamily: reviewTheme.fonts.body,
    }}>
      {isDraftRoute && (
        <ReviewDraftHeader
          surfaceMode={mode}
          paperTitle={paperTitle}
          isUpload={draftState.isUpload}
          arxivId={routeArxivId}
          phase={phase}
          sessionId={session.id}
          isPublic={sessionState.isPublic}
          shareLoading={sessionState.shareLoading}
          shareCopied={sessionState.shareCopied}
          onExport={sessionState.handleExport}
          onSetShareAccess={sessionState.setShareAccess}
          onCopyShareLink={sessionState.handleCopyShareLink}
        />
      )}

      <SessionRestoreBanner
        isVisible={!showSetup && Boolean(session.id) && sessionState.restoreSource !== null}
        isResuming={isRestoring && canResume}
        canResume={canResume}
        restoredFrom={sessionState.restoreSource}
        onResume={sessionState.handleResumeSavedSession}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {sessionState.showWorkspaceLoading ? (
          <WorkspaceLoading label="Loading review workspace..." />
        ) : showSetup ? (
          <ReviewDraftLayout
            paperTitle={paperTitle}
            paperSummary={draftState.paperSummary}
            sourceLabel={draftState.sourceLabel}
            sourceHref={draftState.sourceHref}
            pdfUrl={draftState.pdfUrl}
            sourceDraft={draftState.arxivDraft}
            onSourceDraftChange={draftState.setArxivDraft}
            onSourceSubmit={draftState.handleArxivSubmit}
            onFileChange={draftState.handleFileSelect}
            hasSource={draftState.canStart}
            cacheStatus={draftState.cacheStatus}
            notice={draftState.draftNotice}
            topicError={draftState.topicError}
            topicPresetId={draftState.topicPresetId}
            selectedTopicLabel={draftState.selectedPreset.label}
            customGoal={draftState.customGoal}
            customTopic={draftState.customTopic}
            onCustomGoalChange={draftState.setCustomGoal}
            onCustomTopicChange={draftState.setCustomTopic}
            onTopicPresetChange={draftState.setTopicPresetId}
            canContinue={draftState.canContinue}
            onContinue={draftState.handleContinue}
          />
        ) : session.id ? (
          <SessionWorkspaceLayout
            session={session}
            phase={phase}
            error={error}
            canResume={canResume}
            sourceSummary={sessionState.sourceSummary}
            activeSourceLabel={sessionState.activeSourceLabel}
            activeDocumentTarget={sessionState.activeDocumentTarget}
            sidebarTab={sessionState.sidebarTab}
            currentView={sessionState.workspaceView}
            isPublic={sessionState.isPublic}
            shareLoading={sessionState.shareLoading}
            shareCopied={sessionState.shareCopied}
            rerunLoading={sessionState.rerunLoading}
            activeCount={sessionState.workspaceActiveCount}
            rounds={sessionState.workspaceRounds}
            onSourceClick={sessionState.handleSourceClick}
            onTabChange={sessionState.setSidebarTab}
            onViewChange={sessionState.setWorkspaceView}
            onLocateInDocument={sessionState.handleLocateInDocument}
            onRerun={sessionState.handleRerun}
            onDuplicateAsNew={sessionState.handleDuplicateAsNew}
            onExport={sessionState.handleExport}
            onSetShareAccess={sessionState.setShareAccess}
            onCopyShareLink={sessionState.handleCopyShareLink}
          />
        ) : (
          <WorkspaceLoading label={error ?? 'Unable to load this review session.'} />
        )}
      </div>

      <style>{`
        @keyframes hdr-pulse { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
        @keyframes hdr-spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </div>
  )
}

export function ReviewSurface(props: ReviewSurfaceProps) {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
        background: '#fff', color: '#a1a1aa', fontSize: 14,
        fontFamily: reviewTheme.fonts.body,
      }}>
        Loading...
      </div>
    }>
      <ReviewSurfaceContent {...props} />
    </Suspense>
  )
}
