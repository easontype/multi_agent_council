'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DiscussionTimeline } from '@/components/council/discussion-timeline'
import { PaperPreview } from '@/components/council/paper-preview'
import { ReviewSetupPanel } from '@/components/council/review-setup-panel'
import { SourcePanel } from '@/components/council/source-panel'
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

function fileNameToTitle(fileName: string) {
  return fileName.replace(/\.pdf$/i, '').trim() || 'Uploaded PDF'
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    setTeamAgents(buildEditableTeam(mode))
  }, [mode])

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
    ? `Uploaded PDF · ${pendingFile.name}`
    : arxivId
      ? `arXiv · ${arxivId}`
      : 'No paper selected'

  const sourceHref = arxivId ? `https://arxiv.org/abs/${encodeURIComponent(arxivId)}` : null
  const activeCount = teamAgents.filter((agent) => agent.enabled).length
  const canStart = Boolean(arxivId || pendingFile)
  const isPreparing = phase === 'ingesting'
  const isRunning = phase === 'running'
  const isConcluded = phase === 'concluded'
  const showSetup = phase === 'idle' || phase === 'error' || phase === 'ingesting'

  const statusConfig = phase === 'error'
    ? { dot: '#ef4444', label: 'Error', pulse: false }
    : phase === 'ingesting'
    ? { dot: '#f59e0b', label: 'Preparing', pulse: true }
    : phase === 'running'
    ? { dot: '#f59e0b', label: 'In Progress', pulse: true }
    : phase === 'concluded'
    ? { dot: '#22c55e', label: 'Concluded', pulse: false }
    : { dot: '#9ca3af', label: 'Staged', pulse: false }

  const [isPublic, setIsPublic] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const handleStart = () => {
    const seats = buildSeatsFromEditableAgents(teamAgents)
    const discussionAgents = buildDiscussionAgents(teamAgents)
    start({
      rounds,
      customSeats: seats,
      discussionAgents,
    })
  }

  const handleExport = () => {
    if (!session.id || session.id === 'demo-session') return
    window.open(`/api/council/${session.id}/export`, '_blank')
  }

  const handleShare = async () => {
    if (!session.id || session.id === 'demo-session') return
    setShareLoading(true)
    try {
      const nextPublic = !isPublic
      const res = await fetch(`/api/council/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: nextPublic }),
      })
      if (res.ok) {
        setIsPublic(nextPublic)
        if (nextPublic) {
          const url = `${window.location.origin}/share/${session.id}`
          await navigator.clipboard.writeText(url).catch(() => {})
          setShareCopied(true)
          setTimeout(() => setShareCopied(false), 2500)
        }
      }
    } finally {
      setShareLoading(false)
    }
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
              {activeCount} agents · {rounds} round{rounds > 1 ? 's' : ''}
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
                  transition: 'all 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f7' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
              >
                Export .md
              </button>
              <button
                onClick={handleShare}
                disabled={shareLoading}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 12px',
                  border: `1px solid ${isPublic ? '#6366f1' : '#ddd'}`,
                  borderRadius: 6,
                  background: isPublic ? '#eef2ff' : '#fff',
                  color: isPublic ? '#6366f1' : '#444',
                  cursor: shareLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 120ms',
                }}
              >
                {shareCopied ? 'Link copied!' : isPublic ? 'Public — Copy link' : 'Share'}
              </button>
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
            <div style={{ flex: 2, minWidth: 360, background: '#fafafa' }}>
              <ReviewSetupPanel
                paperTitle={paperTitle}
                paperSummary={paperSummary}
                sourceLabel={sourceLabel}
                mode={mode}
                rounds={rounds}
                agents={teamAgents}
                busy={isPreparing}
                canStart={canStart}
                error={error}
                onModeChange={setMode}
                onRoundsChange={setRounds}
                onAgentsChange={setTeamAgents}
                onAddAgent={() => setTeamAgents((current) => [...current, createCustomEditableAgent(current.length)])}
                onStart={handleStart}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ flex: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRight: '1px solid #f0f0f2' }}>
              <DiscussionTimeline session={session} />
            </div>
            <div style={{ flex: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
              <SourcePanel session={session} />
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
