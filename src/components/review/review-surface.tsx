'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SessionRestoreBanner } from '@/components/council/session-restore-banner'
import { useCouncilReview } from '@/hooks/use-council-review'
import {
  buildDiscussionAgents,
  buildSeatsFromEditableAgents,
} from '@/lib/prompts/review-presets'
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

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`
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

  const { session, phase, error, isRestoring, canResume, start, loadSession, resumeSession, rerunSession } = useCouncilReview(routeArxivId)
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
  const paperSummary = session.paperAbstract || draftState.paperSummary
  const isPreparing = phase === 'ingesting'
  const showSetup = isDraftRoute && !isRestoring && !session.id && (phase === 'idle' || phase === 'error' || phase === 'ingesting')

  const handleStart = () => {
    if (draftState.topicError) return
    sessionState.setRestoreSource(null)
    start({
      mode: draftState.modeSelection,
      rounds: draftState.rounds,
      customSeats: buildSeatsFromEditableAgents(draftState.teamAgents),
      discussionAgents: buildDiscussionAgents(draftState.teamAgents),
      topic: draftState.topicSelection.topic,
      goal: draftState.topicSelection.goal,
      topicPresetId: draftState.topicSelection.topicPresetId,
    })
  }

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
          activeCount={draftState.activeCount}
          rounds={draftState.rounds}
          showSetup={showSetup}
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
            paperSummary={paperSummary}
            sourceLabel={draftState.sourceLabel}
            sourceHref={draftState.sourceHref}
            pdfUrl={draftState.pdfUrl}
            sourceDraft={draftState.arxivDraft}
            onSourceDraftChange={draftState.setArxivDraft}
            onSourceSubmit={draftState.handleArxivSubmit}
            onFileChange={draftState.handleFileSelect}
            hasSource={draftState.canStart}
            cacheStatus={draftState.cacheStatus}
            mode={draftState.modeSelection}
            rounds={draftState.rounds}
            agents={draftState.teamAgents}
            busy={isPreparing}
            canStart={draftState.canStart}
            costLabel={`${formatUsd(draftState.costEstimate.minUsd)} - ${formatUsd(draftState.costEstimate.maxUsd)}`}
            error={error}
            notice={draftState.draftNotice}
            activeCount={draftState.activeCount}
            customGoal={draftState.customGoal}
            customTopic={draftState.customTopic}
            savedTemplates={draftState.savedTemplates}
            onModeChange={draftState.handleModeChange}
            onRoundsChange={draftState.setRounds}
            onAgentsChange={draftState.setTeamAgents}
            topicError={draftState.topicError}
            topicPresetId={draftState.topicPresetId}
            selectedTopicLabel={draftState.selectedPreset.label}
            onCustomGoalChange={draftState.setCustomGoal}
            onCustomTopicChange={draftState.setCustomTopic}
            onTopicPresetChange={draftState.setTopicPresetId}
            onAddAgent={() => draftState.setTeamAgents((current) => [...current, draftState.createCustomEditableAgent(current.length)])}
            onStart={handleStart}
            onSaveTemplate={draftState.handleSaveTemplate}
            onLoadTemplate={draftState.handleLoadTemplate}
            onDeleteTemplate={draftState.handleDeleteTemplate}
            onRenameTemplate={draftState.handleRenameTemplate}
            onDuplicateTemplate={draftState.handleDuplicateTemplate}
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
