'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { SourceReaderTarget } from '@/components/council/source-reader-panel'
import type { CouncilSession } from '@/lib/core/council-types'
import { clearLastOpenedCouncilSessionId, saveLastOpenedCouncilSessionId } from '@/lib/last-opened-session'
import { buildDraftPrefillFromSession, extractArxivIdFromSource, extractSourceUrl, saveReviewDraftPrefill } from '@/lib/review-draft-prefill'
import type { DiscussionSession } from '@/types/council'
import type { ReviewPhase } from '@/hooks/use-council-review'

interface UseReviewSessionWorkspaceStateArgs {
  mode: 'draft' | 'session'
  forcedSessionId?: string | null
  router: AppRouterInstance
  session: DiscussionSession
  phase: ReviewPhase
  isRestoring: boolean
  resumeSession: (sessionId: string) => void
  loadSession: (sessionId: string) => Promise<boolean>
  rerunSession: (sessionId: string) => Promise<void>
}

export function useReviewSessionWorkspaceState({
  mode,
  forcedSessionId,
  router,
  session,
  phase,
  isRestoring,
  resumeSession,
  loadSession,
  rerunSession,
}: UseReviewSessionWorkspaceStateArgs) {
  const [sessionRecord, setSessionRecord] = useState<CouncilSession | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [rerunLoading, setRerunLoading] = useState(false)
  const [activeSourceLabel, setActiveSourceLabel] = useState<string | null>(null)
  const [activeDocumentTarget, setActiveDocumentTarget] = useState<SourceReaderTarget | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'reader' | 'citations' | 'flow' | 'chat'>('citations')
  const [workspaceView, setWorkspaceView] = useState<'timeline' | 'compare' | 'map' | 'gap-map'>('timeline')
  const [restoreSource, setRestoreSource] = useState<'url' | 'local' | null>(null)
  const requestedSessionIdRef = useRef<string | null>(null)

  const handleSourceClick = useCallback((label: string) => {
    setActiveSourceLabel(label)
    setSidebarTab('citations')
  }, [])

  const handleLocateInDocument = useCallback((docId: string, chunkIndex: number) => {
    setActiveDocumentTarget({ docId, chunkIndex })
    setSidebarTab('reader')
  }, [])

  useEffect(() => {
    if (!session.id || session.id === 'demo-session') return
    fetch(`/api/sessions/${session.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.session && typeof data.session.is_public === 'boolean') {
          setSessionRecord(data.session as CouncilSession)
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

  const setShareAccess = async (nextPublic: boolean) => {
    if (!session.id || session.id === 'demo-session') return false
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

  const handleExport = () => {
    if (!session.id || session.id === 'demo-session') return
    window.open(`/api/sessions/${session.id}/export`, '_blank')
  }

  const handleResumeSavedSession = () => {
    if (!session.id) return
    resumeSession(session.id)
  }

  const handleRerun = async () => {
    if (!session.id || session.id === 'demo-session' || rerunLoading || phase === 'running' || phase === 'ingesting') return
    setRestoreSource(null)
    setActiveSourceLabel(null)
    setActiveDocumentTarget(null)
    setSidebarTab('citations')
    setWorkspaceView('timeline')
    setRerunLoading(true)
    try {
      await rerunSession(session.id)
    } finally {
      setRerunLoading(false)
    }
  }

  const handleDuplicateAsNew = () => {
    if (!sessionRecord) return
    const prefill = buildDraftPrefillFromSession(sessionRecord)
    saveReviewDraftPrefill(prefill)
    const nextUrl = prefill.arxivId
      ? `/review/new?arxiv=${encodeURIComponent(prefill.arxivId)}`
      : '/review/new'
    router.push(nextUrl)
  }

  const workspaceActiveCount = sessionRecord?.seats.length ?? session.agents.filter((agent) => agent.seatRole !== 'Moderator').length
  const workspaceRounds: 1 | 2 = sessionRecord?.rounds === 2 ? 2 : 1
  const sessionSourceUrl = extractSourceUrl(sessionRecord?.context)
  const sessionArxivId = extractArxivIdFromSource(sessionSourceUrl)
  const sourceSummary = sessionArxivId
    ? `Source: arXiv ${sessionArxivId}`
    : sessionSourceUrl === 'upload'
      ? 'Source: uploaded PDF'
      : sessionSourceUrl
        ? 'Source: recovered external source'
        : 'Source: unavailable'
  const showWorkspaceLoading = mode === 'session' && (isRestoring || (!session.id && phase !== 'error'))

  return {
    activeSourceLabel,
    activeDocumentTarget,
    isPublic,
    rerunLoading,
    restoreSource,
    sessionRecord,
    shareCopied,
    shareLoading,
    showWorkspaceLoading,
    sidebarTab,
    sourceSummary,
    workspaceActiveCount,
    workspaceRounds,
    workspaceView,
    setSidebarTab,
    setWorkspaceView,
    setRestoreSource,
    handleCopyShareLink,
    handleDuplicateAsNew,
    handleExport,
    handleLocateInDocument,
    handleResumeSavedSession,
    handleRerun,
    handleSourceClick,
    setActiveDocumentTarget,
    setShareAccess,
  }
}
