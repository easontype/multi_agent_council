'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PaperPreview } from '@/components/council/paper-preview'
import { SessionRestoreBanner } from '@/components/council/session-restore-banner'
import { useCouncilReview } from '@/hooks/use-council-review'
import {
  clearLastOpenedCouncilSessionId,
  saveLastOpenedCouncilSessionId,
} from '@/lib/last-opened-session'
import { peekPendingUpload, setPendingUpload } from '@/lib/pending-upload'
import {
  buildDiscussionAgents,
  buildEditableTeam,
  buildSeatsFromEditableAgents,
  createCustomEditableAgent,
  type EditableReviewAgent,
  type ReviewMode,
} from '@/lib/prompts/review-presets'
import { estimateHostedReviewCost } from '@/lib/review-cost'
import {
  deleteSavedTeamTemplate,
  loadSavedTeamTemplates,
  upsertSavedTeamTemplate,
  type SavedTeamTemplate,
} from '@/lib/team-template-store'
import { ReviewResults } from '@/app/analyze/_components/review-results'
import { SessionHeader } from '@/app/analyze/_components/session-header'
import { ReviewDraftLayout } from './new/review-draft-layout'

export type ReviewSurfaceMode = 'draft' | 'session'

interface ReviewSurfaceProps {
  mode: ReviewSurfaceMode
  forcedSessionId?: string | null
}

function fileNameToTitle(fileName: string) {
  return fileName.replace(/\.pdf$/i, '').trim() || 'Uploaded PDF'
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`
}

function createTemplateId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tmpl-${Date.now()}`
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
  const [pendingFile, setLocalPendingFile] = useState<File | null>(() => peekPendingUpload())
  const [arxivDraft, setArxivDraft] = useState(routeArxivId ?? '')
  const isUpload = Boolean(pendingFile)

  const { session, phase, error, isRestoring, canResume, start, loadSession, resumeSession } = useCouncilReview(routeArxivId)
  const [modeSelection, setModeSelection] = useState<ReviewMode>('critique')
  const [rounds, setRounds] = useState<1 | 2>(1)
  const [teamAgents, setTeamAgents] = useState<EditableReviewAgent[]>(() => buildEditableTeam('critique'))
  const [savedTemplates, setSavedTemplates] = useState<SavedTeamTemplate[]>([])
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [activeSourceLabel, setActiveSourceLabel] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'sources' | 'chat'>('sources')
  const [restoreSource, setRestoreSource] = useState<'url' | 'local' | null>(null)
  const requestedSessionIdRef = useRef<string | null>(null)

  const handleSourceClick = useCallback((label: string) => {
    setActiveSourceLabel(label)
    setSidebarTab('sources')
  }, [])

  useEffect(() => {
    let cancelled = false
    loadSavedTeamTemplates().then((templates) => {
      if (!cancelled) setSavedTemplates(templates)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setArxivDraft(routeArxivId ?? '')
  }, [routeArxivId])

  useEffect(() => {
    if (pendingFile) {
      const objectUrl = URL.createObjectURL(pendingFile)
      setPdfUrl(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    }
    if (routeArxivId) {
      setPdfUrl(`https://arxiv.org/pdf/${encodeURIComponent(routeArxivId)}.pdf`)
      return
    }
    setPdfUrl(null)
  }, [routeArxivId, pendingFile])

  useEffect(() => {
    if (!session.id || session.id === 'demo-session') return
    fetch(`/api/sessions/${session.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.session && typeof data.session.is_public === 'boolean') {
          setIsPublic(Boolean(data.session.is_public))
        }
      })
      .catch(() => {})
  }, [session.id])

  useEffect(() => {
    if (mode !== 'session' || !forcedSessionId || requestedSessionIdRef.current === forcedSessionId) return
    requestedSessionIdRef.current = forcedSessionId
    setRestoreSource('url')
    loadSession(forcedSessionId).then((ok) => {
      if (!ok) clearLastOpenedCouncilSessionId()
    })
  }, [forcedSessionId, loadSession, mode])

  useEffect(() => {
    if (!session.id || session.id === 'demo-session') return
    saveLastOpenedCouncilSessionId(session.id)
    if (mode === 'draft') {
      router.replace(`/review/${session.id}`)
    }
  }, [mode, router, session.id])

  const paperTitle = session.paperTitle || (
    pendingFile ? fileNameToTitle(pendingFile.name) : routeArxivId ? `arXiv:${routeArxivId}` : 'Paper Preview'
  )
  const paperSummary = session.paperAbstract || (
    pendingFile
      ? `This PDF is staged locally and will only be parsed once you start the review. Current file: ${pendingFile.name} (${formatFileSize(pendingFile.size)}).`
      : routeArxivId
        ? 'This arXiv paper is staged for review. The PDF preview is live, but ingestion and debate will not begin until you start the panel.'
        : 'Choose a paper first, then configure the panel before running the debate.'
  )
  const sourceLabel = pendingFile
    ? `Uploaded PDF - ${pendingFile.name}`
    : routeArxivId ? `arXiv - ${routeArxivId}` : 'No paper selected'
  const sourceHref = routeArxivId ? `https://arxiv.org/abs/${encodeURIComponent(routeArxivId)}` : null
  const activeCount = teamAgents.filter((agent) => agent.enabled).length
  const canStart = Boolean(routeArxivId || pendingFile)
  const isPreparing = phase === 'ingesting'
  const showSetup = isDraftRoute && !isRestoring && !session.id && (phase === 'idle' || phase === 'error' || phase === 'ingesting')
  const costEstimate = estimateHostedReviewCost(activeCount, rounds)
  const showWorkspaceLoading = mode === 'session' && (isRestoring || (!session.id && phase !== 'error'))

  const handleModeChange = (nextMode: ReviewMode) => {
    setModeSelection(nextMode)
    setTeamAgents(buildEditableTeam(nextMode))
  }

  const handleStart = () => {
    setRestoreSource(null)
    start({
      mode: modeSelection,
      rounds,
      customSeats: buildSeatsFromEditableAgents(teamAgents),
      discussionAgents: buildDiscussionAgents(teamAgents),
    })
  }

  const handleExport = () => {
    if (!session.id || session.id === 'demo-session') return
    window.open(`/api/sessions/${session.id}/export`, '_blank')
  }

  const setShareAccess = async (nextPublic: boolean) => {
    if (!session.id || session.id === 'demo-session') return
    setShareLoading(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: nextPublic }),
      })
      if (!res.ok) return false
      setIsPublic(nextPublic)
      if (!nextPublic) setShareCopied(false)
      return true
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyShareLink = async () => {
    if (!session.id || session.id === 'demo-session') return
    let ready = isPublic
    if (!ready) ready = Boolean(await setShareAccess(true))
    if (!ready) return
    await navigator.clipboard.writeText(`${window.location.origin}/share/${session.id}`).catch(() => {})
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2500)
  }

  const handleSaveTemplate = async () => {
    const name = window.prompt('Template name', `${modeSelection === 'gap' ? 'Gap' : 'Critique'} Team`)
    if (!name?.trim()) return
    const now = new Date().toISOString()
    setSavedTemplates(await upsertSavedTeamTemplate({
      id: createTemplateId(),
      name: name.trim(),
      mode: modeSelection,
      rounds,
      agents: teamAgents,
      createdAt: now,
      updatedAt: now,
    }))
  }

  const handleLoadTemplate = (template: SavedTeamTemplate) => {
    setModeSelection(template.mode)
    setRounds(template.rounds)
    setTeamAgents(template.agents)
  }

  const handleDeleteTemplate = async (id: string) => {
    setSavedTemplates(await deleteSavedTeamTemplate(id))
  }

  const handleArxivSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const normalized = arxivDraft.trim()
    if (!normalized) return
    setPendingUpload(null)
    setLocalPendingFile(null)
    router.replace(`/review/new?arxiv=${encodeURIComponent(normalized)}`)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPendingUpload(file)
    setLocalPendingFile(file)
    router.replace('/review/new')
    event.target.value = ''
  }

  const handleResumeSavedSession = () => {
    if (!session.id) return
    resumeSession(session.id)
  }

  const handleRenameTemplate = async (template: SavedTeamTemplate) => {
    const name = window.prompt('Rename template', template.name)
    if (!name?.trim()) return
    setSavedTemplates(await upsertSavedTeamTemplate({
      ...template,
      name: name.trim(),
      updatedAt: new Date().toISOString(),
    }))
  }

  const handleDuplicateTemplate = async (template: SavedTeamTemplate) => {
    const name = window.prompt('Duplicate template as', `${template.name} Copy`)
    if (!name?.trim()) return
    const now = new Date().toISOString()
    setSavedTemplates(await upsertSavedTeamTemplate({
      ...template,
      id: createTemplateId(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    }))
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#fff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    }}>
      <SessionHeader
        surfaceMode={mode}
        paperTitle={paperTitle}
        isUpload={isUpload}
        arxivId={routeArxivId}
        phase={phase}
        sessionId={session.id}
        isPublic={isPublic}
        shareLoading={shareLoading}
        shareCopied={shareCopied}
        activeCount={activeCount}
        rounds={rounds}
        showSetup={showSetup}
        onExport={handleExport}
        onSetShareAccess={setShareAccess}
        onCopyShareLink={handleCopyShareLink}
      />

      <SessionRestoreBanner
        isVisible={!showSetup && Boolean(session.id) && restoreSource !== null}
        isResuming={isRestoring && canResume}
        canResume={canResume}
        restoredFrom={restoreSource}
        onResume={handleResumeSavedSession}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {showWorkspaceLoading ? (
          <WorkspaceLoading label="Loading review workspace..." />
        ) : showSetup ? (
          <ReviewDraftLayout
            paperTitle={paperTitle}
            paperSummary={paperSummary}
            sourceLabel={sourceLabel}
            sourceHref={sourceHref}
            pdfUrl={pdfUrl}
            sourceDraft={arxivDraft}
            onSourceDraftChange={setArxivDraft}
            onSourceSubmit={handleArxivSubmit}
            onFileChange={handleFileSelect}
            hasSource={canStart}
            mode={modeSelection}
            rounds={rounds}
            agents={teamAgents}
            busy={isPreparing}
            canStart={canStart}
            costLabel={`${formatUsd(costEstimate.minUsd)} - ${formatUsd(costEstimate.maxUsd)}`}
            error={error}
            activeCount={activeCount}
            savedTemplates={savedTemplates}
            onModeChange={handleModeChange}
            onRoundsChange={setRounds}
            onAgentsChange={setTeamAgents}
            onAddAgent={() => setTeamAgents((current) => [...current, createCustomEditableAgent(current.length)])}
            onStart={handleStart}
            onSaveTemplate={handleSaveTemplate}
            onLoadTemplate={handleLoadTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onRenameTemplate={handleRenameTemplate}
            onDuplicateTemplate={handleDuplicateTemplate}
          />
        ) : session.id ? (
          <ReviewResults
            session={session}
            activeSourceLabel={activeSourceLabel}
            sidebarTab={sidebarTab}
            onSourceClick={handleSourceClick}
            onTabChange={setSidebarTab}
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
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      }}>
        Loading...
      </div>
    }>
      <ReviewSurfaceContent {...props} />
    </Suspense>
  )
}
