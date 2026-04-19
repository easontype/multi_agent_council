'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PaperPreview } from '@/components/council/paper-preview'
import { useCouncilReview } from '@/hooks/use-council-review'
import { peekPendingUpload } from '@/lib/pending-upload'
import {
  buildDiscussionAgents,
  buildEditableTeam,
  buildSeatsFromEditableAgents,
  createCustomEditableAgent,
  type EditableReviewAgent,
  type ReviewMode,
} from '@/lib/review-presets'
import {
  deleteSavedTeamTemplate,
  loadSavedTeamTemplates,
  upsertSavedTeamTemplate,
  type SavedTeamTemplate,
} from '@/lib/team-template-store'
import { estimateHostedReviewCost } from '@/lib/review-cost'
import { SessionHeader } from './_components/session-header'
import { SetupSidebar } from './_components/setup-sidebar'
import { ReviewResults } from './_components/review-results'

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

function AnalyzeContent() {
  const searchParams = useSearchParams()
  const arxivId = searchParams.get('arxiv')
  const [pendingFile] = useState<File | null>(() => peekPendingUpload())
  const isUpload = Boolean(pendingFile)

  const { session, phase, error, start } = useCouncilReview(arxivId)
  const [mode, setMode] = useState<ReviewMode>('critique')
  const [rounds, setRounds] = useState<1 | 2>(1)
  const [teamAgents, setTeamAgents] = useState<EditableReviewAgent[]>(() => buildEditableTeam('critique'))
  const [savedTemplates, setSavedTemplates] = useState<SavedTeamTemplate[]>([])
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [setupSidebarOpen, setSetupSidebarOpen] = useState(true)
  const [activeSourceLabel, setActiveSourceLabel] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'sources' | 'chat'>('sources')

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
    if (pendingFile) {
      const objectUrl = URL.createObjectURL(pendingFile)
      setPdfUrl(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    }
    if (arxivId) {
      setPdfUrl(`https://arxiv.org/pdf/${encodeURIComponent(arxivId)}.pdf`)
      return
    }
    setPdfUrl(null)
  }, [arxivId, pendingFile])

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

  // ── Derived values ──────────────────────────────────────────────────────────
  const paperTitle = session.paperTitle || (
    pendingFile ? fileNameToTitle(pendingFile.name) : arxivId ? `arXiv:${arxivId}` : 'Paper Preview'
  )
  const paperSummary = session.paperAbstract || (
    pendingFile
      ? `This PDF is staged locally and will only be parsed once you start the review. Current file: ${pendingFile.name} (${formatFileSize(pendingFile.size)}).`
      : arxivId
        ? 'This arXiv paper is staged for review. The PDF preview is live, but ingestion and debate will not begin until you start the panel.'
        : 'Choose a paper first, then configure the panel before running the debate.'
  )
  const sourceLabel = pendingFile
    ? `Uploaded PDF - ${pendingFile.name}`
    : arxivId ? `arXiv - ${arxivId}` : 'No paper selected'
  const sourceHref = arxivId ? `https://arxiv.org/abs/${encodeURIComponent(arxivId)}` : null
  const activeCount = teamAgents.filter((a) => a.enabled).length
  const canStart = Boolean(arxivId || pendingFile)
  const isPreparing = phase === 'ingesting'
  const showSetup = phase === 'idle' || phase === 'error' || phase === 'ingesting'
  const costEstimate = estimateHostedReviewCost(activeCount, rounds)

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleModeChange = (nextMode: ReviewMode) => {
    setMode(nextMode)
    setTeamAgents(buildEditableTeam(nextMode))
  }

  const handleStart = () => {
    start({
      mode,
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
    const name = window.prompt('Template name', `${mode === 'gap' ? 'Gap' : 'Critique'} Team`)
    if (!name?.trim()) return
    const now = new Date().toISOString()
    setSavedTemplates(await upsertSavedTeamTemplate({ id: createTemplateId(), name: name.trim(), mode, rounds, agents: teamAgents, createdAt: now, updatedAt: now }))
  }

  const handleLoadTemplate = (template: SavedTeamTemplate) => {
    setMode(template.mode)
    setRounds(template.rounds)
    setTeamAgents(template.agents)
  }

  const handleDeleteTemplate = async (id: string) => { setSavedTemplates(await deleteSavedTeamTemplate(id)) }

  const handleRenameTemplate = async (template: SavedTeamTemplate) => {
    const name = window.prompt('Rename template', template.name)
    if (!name?.trim()) return
    setSavedTemplates(await upsertSavedTeamTemplate({ ...template, name: name.trim(), updatedAt: new Date().toISOString() }))
  }

  const handleDuplicateTemplate = async (template: SavedTeamTemplate) => {
    const name = window.prompt('Duplicate template as', `${template.name} Copy`)
    if (!name?.trim()) return
    const now = new Date().toISOString()
    setSavedTemplates(await upsertSavedTeamTemplate({ ...template, id: createTemplateId(), name: name.trim(), createdAt: now, updatedAt: now }))
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#fff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    }}>
      <SessionHeader
        paperTitle={paperTitle}
        isUpload={isUpload}
        arxivId={arxivId}
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

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {showSetup ? (
          <>
            <div style={{ flex: 3, minWidth: 0, borderRight: '1px solid #ececf1' }}>
              <PaperPreview
                title={paperTitle}
                sourceLabel={sourceLabel}
                pdfUrl={pdfUrl}
                sourceHref={sourceHref}
                helperText="The PDF is visible now, but nothing is parsed or debated until you start the review."
              />
            </div>
            <SetupSidebar
              isOpen={setupSidebarOpen}
              onToggle={() => setSetupSidebarOpen((v) => !v)}
              paperTitle={paperTitle}
              paperSummary={paperSummary}
              sourceLabel={sourceLabel}
              mode={mode}
              rounds={rounds}
              agents={teamAgents}
              isPreparing={isPreparing}
              canStart={canStart}
              costLabel={`${formatUsd(costEstimate.minUsd)} - ${formatUsd(costEstimate.maxUsd)}`}
              error={error}
              activeCount={activeCount}
              costEstimateMin={costEstimate.minUsd}
              costEstimateMax={costEstimate.maxUsd}
              savedTemplates={savedTemplates}
              onModeChange={handleModeChange}
              onRoundsChange={setRounds}
              onAgentsChange={setTeamAgents}
              onAddAgent={() => setTeamAgents((cur) => [...cur, createCustomEditableAgent(cur.length)])}
              onStart={handleStart}
              onSaveTemplate={handleSaveTemplate}
              onLoadTemplate={handleLoadTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onRenameTemplate={handleRenameTemplate}
              onDuplicateTemplate={handleDuplicateTemplate}
            />
          </>
        ) : (
          <ReviewResults
            session={session}
            activeSourceLabel={activeSourceLabel}
            sidebarTab={sidebarTab}
            onSourceClick={handleSourceClick}
            onTabChange={setSidebarTab}
          />
        )}
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
        background: '#fff', color: '#a1a1aa', fontSize: 14,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      }}>
        Loading...
      </div>
    }>
      <AnalyzeContent />
    </Suspense>
  )
}
