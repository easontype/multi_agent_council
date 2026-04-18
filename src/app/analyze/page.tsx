'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DiscussionTimeline } from '@/components/council/discussion-timeline'
import { PaperPreview } from '@/components/council/paper-preview'
import { ReviewSetupPanel } from '@/components/council/review-setup-panel'
import { ReviewSidebar } from '@/components/council/review-sidebar'
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
import { deleteSavedTeamTemplate, loadSavedTeamTemplates, upsertSavedTeamTemplate, type SavedTeamTemplate } from '@/lib/team-template-store'
import { estimateHostedReviewCost } from '@/lib/review-cost'

function BackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'hdr-spin 0.8s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {direction === 'left'
        ? <polyline points="15 18 9 12 15 6" />
        : <polyline points="9 18 15 12 9 6" />}
    </svg>
  )
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
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `tmpl-${Date.now()}`
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
    setSavedTemplates(loadSavedTeamTemplates())
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
    fetch(`/api/council/${session.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.session && typeof data.session.is_public === 'boolean') {
          setIsPublic(Boolean(data.session.is_public))
        }
      })
      .catch(() => {})
  }, [session.id])

  const paperTitle = session.paperTitle || (
    pendingFile
      ? fileNameToTitle(pendingFile.name)
      : arxivId
        ? `arXiv:${arxivId}`
        : 'Paper Preview'
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
    : arxivId
      ? `arXiv - ${arxivId}`
      : 'No paper selected'

  const sourceHref = arxivId ? `https://arxiv.org/abs/${encodeURIComponent(arxivId)}` : null
  const activeCount = teamAgents.filter((agent) => agent.enabled).length
  const canStart = Boolean(arxivId || pendingFile)
  const isPreparing = phase === 'ingesting'
  const isRunning = phase === 'running'
  const isConcluded = phase === 'concluded'
  const showSetup = phase === 'idle' || phase === 'error' || phase === 'ingesting'
  const costEstimate = estimateHostedReviewCost(activeCount, rounds)

  const statusConfig = phase === 'error'
    ? { dot: '#ef4444', label: 'Error', pulse: false }
    : phase === 'ingesting'
    ? { dot: '#f59e0b', label: 'Preparing', pulse: true }
    : phase === 'running'
    ? { dot: '#f59e0b', label: 'In Progress', pulse: true }
    : phase === 'concluded'
    ? { dot: '#22c55e', label: 'Concluded', pulse: false }
    : { dot: '#9ca3af', label: 'Staged', pulse: false }

  const handleModeChange = (nextMode: ReviewMode) => {
    setMode(nextMode)
    setTeamAgents(buildEditableTeam(nextMode))
  }

  const handleStart = () => {
    const seats = buildSeatsFromEditableAgents(teamAgents)
    const discussionAgents = buildDiscussionAgents(teamAgents)
    start({
      mode,
      rounds,
      customSeats: seats,
      discussionAgents,
    })
  }

  const handleExport = () => {
    if (!session.id || session.id === 'demo-session') return
    window.open(`/api/council/${session.id}/export`, '_blank')
  }

  const setShareAccess = async (nextPublic: boolean) => {
    if (!session.id || session.id === 'demo-session') return
    setShareLoading(true)
    try {
      const res = await fetch(`/api/council/${session.id}`, {
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
    if (!ready) {
      ready = Boolean(await setShareAccess(true))
    }
    if (!ready) return

    const url = `${window.location.origin}/share/${session.id}`
    await navigator.clipboard.writeText(url).catch(() => {})
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2500)
  }

  const handleSaveTemplate = () => {
    const name = window.prompt('Template name', `${mode === 'gap' ? 'Gap' : 'Critique'} Team`)
    if (!name?.trim()) return

    const now = new Date().toISOString()
    const nextTemplates = upsertSavedTeamTemplate({
      id: createTemplateId(),
      name: name.trim(),
      mode,
      rounds,
      agents: teamAgents,
      createdAt: now,
      updatedAt: now,
    })
    setSavedTemplates(nextTemplates)
  }

  const handleLoadTemplate = (template: SavedTeamTemplate) => {
    setMode(template.mode)
    setRounds(template.rounds)
    setTeamAgents(template.agents)
  }

  const handleDeleteTemplate = (id: string) => {
    setSavedTemplates(deleteSavedTeamTemplate(id))
  }

  const handleRenameTemplate = (template: SavedTeamTemplate) => {
    const name = window.prompt('Rename template', template.name)
    if (!name?.trim()) return

    const nextTemplates = upsertSavedTeamTemplate({
      ...template,
      name: name.trim(),
      updatedAt: new Date().toISOString(),
    })
    setSavedTemplates(nextTemplates)
  }

  const handleDuplicateTemplate = (template: SavedTeamTemplate) => {
    const name = window.prompt('Duplicate template as', `${template.name} Copy`)
    if (!name?.trim()) return

    const now = new Date().toISOString()
    const nextTemplates = upsertSavedTeamTemplate({
      ...template,
      id: createTemplateId(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    })
    setSavedTemplates(nextTemplates)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#fff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 54, flexShrink: 0,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid #f0f0f2',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 0 #f0f0f2',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <a href="/home" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            color: '#888', textDecoration: 'none',
            fontSize: 13, fontWeight: 500, padding: '5px 8px', borderRadius: 6,
            transition: 'color 150ms, background 150ms',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#333'; e.currentTarget.style.background = '#f5f5f7' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.background = 'transparent' }}
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
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: '#bbb', textTransform: 'uppercase', marginBottom: 1 }}>
              {isUpload ? 'PDF' : arxivId ? 'arXiv' : 'Paper'}
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#444',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 420,
            }}>
              {paperTitle}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {showSetup && (
            <span style={{ fontSize: 12, color: '#999' }}>
              {activeCount} agents - {rounds} round{rounds > 1 ? 's' : ''}
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: statusConfig.dot,
              ...(statusConfig.pulse ? { animation: 'hdr-pulse 1.2s ease-in-out infinite' } : {}),
            }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#888' }}>{statusConfig.label}</span>
          </div>

          {(isPreparing || isRunning) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#555' }}>
              <SpinnerIcon />
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                {isPreparing ? 'Ingesting paper...' : 'Running panel...'}
              </span>
            </div>
          )}

          {isConcluded && session.id && session.id !== 'demo-session' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleExport}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 12px',
                  border: '1px solid #ddd', borderRadius: 6,
                  background: '#fff', color: '#444', cursor: 'pointer',
                }}
              >
                Export .md
              </button>
              <button
                onClick={() => setShareAccess(!isPublic)}
                disabled={shareLoading}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 12px',
                  border: `1px solid ${isPublic ? '#d6d3d1' : '#ddd'}`,
                  borderRadius: 6,
                  background: isPublic ? '#fafaf9' : '#fff',
                  color: isPublic ? '#57534e' : '#444',
                  cursor: shareLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {isPublic ? 'Make Private' : 'Publish Link'}
              </button>
              <button
                onClick={handleCopyShareLink}
                disabled={shareLoading}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 12px',
                  border: `1px solid ${isPublic ? '#111827' : '#ddd'}`,
                  borderRadius: 6,
                  background: isPublic ? '#111827' : '#fff',
                  color: isPublic ? '#fff' : '#444',
                  cursor: shareLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {shareCopied ? 'Link copied!' : 'Copy Share URL'}
              </button>
              {isPublic && (
                <a
                  href={`/share/${session.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '5px 12px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    background: '#fff',
                    color: '#444',
                    textDecoration: 'none',
                  }}
                >
                  Open Shared Page
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {showSetup ? (
          <>
            <div style={{ flex: 3, minWidth: 0, borderRight: '1px solid #f0f0f2' }}>
              <PaperPreview
                title={paperTitle}
                sourceLabel={sourceLabel}
                pdfUrl={pdfUrl}
                sourceHref={sourceHref}
                helperText="The PDF is visible now, but nothing is parsed or debated until you start the review."
              />
            </div>
            <div style={{
              width: setupSidebarOpen ? 460 : 76,
              minWidth: setupSidebarOpen ? 360 : 76,
              background: '#fafafa',
              borderLeft: '1px solid #f0f0f2',
              transition: 'width 180ms ease, min-width 180ms ease',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <button
                type="button"
                onClick={() => setSetupSidebarOpen((current) => !current)}
                aria-label={setupSidebarOpen ? 'Collapse review setup sidebar' : 'Expand review setup sidebar'}
                style={{
                  position: 'absolute',
                  top: 18,
                  left: 14,
                  zIndex: 2,
                  width: 34,
                  height: 34,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #e4e4e7',
                  borderRadius: 999,
                  background: '#fff',
                  color: '#52525b',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
                }}
              >
                <ChevronIcon direction={setupSidebarOpen ? 'right' : 'left'} />
              </button>

              {setupSidebarOpen ? (
                <div style={{ height: '100%', overflowY: 'auto', padding: '18px 18px 28px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 14,
                    paddingLeft: 44,
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 4 }}>
                        Review Setup
                      </div>
                      <div style={{ fontSize: 12.5, color: '#71717a' }}>
                        Configure the panel before starting the debate.
                      </div>
                    </div>
                  </div>

                  <ReviewSetupPanel
                    paperTitle={paperTitle}
                    paperSummary={paperSummary}
                    sourceLabel={sourceLabel}
                    mode={mode}
                    rounds={rounds}
                    agents={teamAgents}
                    busy={isPreparing}
                    canStart={canStart}
                    costLabel={`${formatUsd(costEstimate.minUsd)} - ${formatUsd(costEstimate.maxUsd)}`}
                    error={error}
                    onModeChange={handleModeChange}
                    onRoundsChange={setRounds}
                    onAgentsChange={setTeamAgents}
                    onAddAgent={() => setTeamAgents((current) => [...current, createCustomEditableAgent(current.length)])}
                    onStart={handleStart}
                  />

                  <div style={{
                    background: '#fff',
                    border: '1px solid #ebebed',
                    borderRadius: 14,
                    padding: '15px 16px',
                    marginTop: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase' }}>
                        Saved Teams
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveTemplate}
                        style={{
                          border: '1px solid #e4e4e7',
                          background: '#fafafa',
                          color: '#3f3f46',
                          borderRadius: 999,
                          padding: '6px 10px',
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Save Current
                      </button>
                    </div>
                    {savedTemplates.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: '#71717a', lineHeight: 1.6 }}>
                        Save custom reviewer teams locally so you can reuse them on the next paper.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {savedTemplates.slice(0, 4).map((template) => (
                          <div
                            key={template.id}
                            style={{
                              border: '1px solid #ececf1',
                              borderRadius: 12,
                              padding: '10px 12px',
                              background: '#fafafa',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b' }}>{template.name}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                                {template.agents.filter((agent) => agent.enabled).length} agents
                              </div>
                            </div>
                            <div style={{ fontSize: 11.5, color: '#71717a', marginBottom: 8 }}>
                              {template.mode === 'gap' ? 'Gap Analysis' : 'Academic Critique'} - {template.rounds} round{template.rounds > 1 ? 's' : ''}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => handleLoadTemplate(template)}
                                style={{
                                  border: '1px solid #d4d4d8',
                                  background: '#fff',
                                  color: '#3f3f46',
                                  borderRadius: 999,
                                  padding: '6px 10px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Load
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateTemplate(template)}
                                style={{
                                  border: '1px solid #d4d4d8',
                                  background: '#fff',
                                  color: '#3f3f46',
                                  borderRadius: 999,
                                  padding: '6px 10px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRenameTemplate(template)}
                                style={{
                                  border: '1px solid #d4d4d8',
                                  background: '#fff',
                                  color: '#3f3f46',
                                  borderRadius: 999,
                                  padding: '6px 10px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTemplate(template.id)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#a1a1aa',
                                  borderRadius: 999,
                                  padding: '6px 2px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '64px 10px 20px',
                  gap: 14,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#a1a1aa', textTransform: 'uppercase', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    Review Setup
                  </div>
                  <div style={{
                    width: '100%',
                    border: '1px solid #ececf1',
                    borderRadius: 16,
                    background: '#fff',
                    padding: '12px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <div style={{ fontSize: 10, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Agents
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#18181b' }}>
                      {activeCount}
                    </div>
                    <div style={{ width: '100%', height: 1, background: '#f0f0f2' }} />
                    <div style={{ fontSize: 10, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Cost
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#18181b', textAlign: 'center', lineHeight: 1.45 }}>
                      {formatUsd(costEstimate.minUsd)}
                      <br />
                      {formatUsd(costEstimate.maxUsd)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ flex: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRight: '1px solid #f0f0f2' }}>
              <DiscussionTimeline session={session} onSourceClick={handleSourceClick} />
            </div>
            <div style={{ flex: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
              <ReviewSidebar
                session={session}
                activeSourceLabel={activeSourceLabel}
                tab={sidebarTab}
                onTabChange={setSidebarTab}
              />
            </div>
          </>
        )}
      </div>

      {isConcluded && session.messages.length === 0 && (
        <div style={{ padding: 16, color: '#888', fontSize: 12 }}>
          Review concluded, but no discussion messages were rendered.
        </div>
      )}

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
        background: '#fff', color: '#bbb', fontSize: 14,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      }}>
        Loading...
      </div>
    }>
      <AnalyzeContent />
    </Suspense>
  )
}
