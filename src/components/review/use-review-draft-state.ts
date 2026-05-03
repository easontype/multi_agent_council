'use client'

import { useEffect, useState } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { peekPendingUpload, setPendingUpload } from '@/lib/pending-upload'
import {
  PAPER_TOPIC_PRESETS,
  resolvePaperTopicSelection,
} from '@/lib/paper-topics'
import {
  consumeReviewDraftPrefill,
} from '@/lib/review-draft-prefill'

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function fileNameToTitle(fileName: string) {
  return fileName.replace(/\.pdf$/i, '').trim() || 'Uploaded PDF'
}

interface UseReviewDraftStateArgs {
  isDraftRoute: boolean
  routeArxivId: string | null
  router: AppRouterInstance
}

export function useReviewDraftState({
  isDraftRoute,
  routeArxivId,
  router,
}: UseReviewDraftStateArgs) {
  const [pendingFile, setLocalPendingFile] = useState<File | null>(() => peekPendingUpload())
  const [arxivDraft, setArxivDraft] = useState(routeArxivId ?? '')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [draftNotice, setDraftNotice] = useState<string | null>(null)
  const [topicPresetId, setTopicPresetId] = useState<string>('methodology')
  const [customTopic, setCustomTopic] = useState('')
  const [customGoal, setCustomGoal] = useState('')
  const [cacheStatus, setCacheStatus] = useState<'ready' | 'processing' | 'failed' | 'unknown' | null>(null)
  const [cacheTitle, setCacheTitle] = useState<string | null>(null)

  useEffect(() => {
    setArxivDraft(routeArxivId ?? '')
  }, [routeArxivId])

  useEffect(() => {
    if (!isDraftRoute) return
    const prefill = consumeReviewDraftPrefill()
    if (!prefill) return
    setTopicPresetId(prefill.topicPresetId ?? 'custom')
    setCustomTopic(prefill.topic ?? '')
    setCustomGoal(prefill.goal ?? '')
    setDraftNotice(prefill.notice ?? null)
    if (prefill.arxivId && !routeArxivId) {
      router.replace(`/review/new?arxiv=${encodeURIComponent(prefill.arxivId)}`)
    }
  }, [isDraftRoute, routeArxivId, router])

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
    if (!routeArxivId) {
      setCacheStatus(null)
      setCacheTitle(null)
      return
    }
    let cancelled = false
    fetch(`/api/papers/lookup?arxivId=${encodeURIComponent(routeArxivId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const nextStatus = data?.status
        setCacheStatus(
          nextStatus === 'ready' || nextStatus === 'processing' || nextStatus === 'failed' || nextStatus === 'unknown'
            ? nextStatus
            : 'unknown',
        )
        setCacheTitle(typeof data?.title === 'string' ? data.title : null)
      })
      .catch(() => {
        if (!cancelled) {
          setCacheStatus('unknown')
          setCacheTitle(null)
        }
      })
    return () => { cancelled = true }
  }, [routeArxivId])

  const handleArxivSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const normalized = arxivDraft.trim()
    if (!normalized) return
    setPendingUpload(null)
    setLocalPendingFile(null)
    setDraftNotice(null)
    router.replace(`/review/new?arxiv=${encodeURIComponent(normalized)}`)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPendingUpload(file)
    setLocalPendingFile(file)
    setDraftNotice(null)
    router.replace('/review/new')
    event.target.value = ''
  }

  const handleContinue = () => {
    const params = new URLSearchParams()
    if (routeArxivId) params.set('arxivId', routeArxivId)
    params.set('topicPresetId', topicPresetId)
    if (topicPresetId === 'custom') {
      if (customTopic) params.set('customTopic', customTopic)
      if (customGoal) params.set('customGoal', customGoal)
    }
    const title = cacheTitle || (pendingFile ? fileNameToTitle(pendingFile.name) : null)
    if (title) params.set('paperTitle', title)
    router.push(`/review/new/team?${params.toString()}`)
  }

  const isUpload = Boolean(pendingFile)
  const canStart = Boolean(routeArxivId || pendingFile)
  const topicSelection = resolvePaperTopicSelection({
    topicPresetId,
    topic: customTopic,
    goal: customGoal,
  })
  const selectedPreset = PAPER_TOPIC_PRESETS.find((item) => item.id === topicPresetId) ?? PAPER_TOPIC_PRESETS[0]
  const topicError = topicPresetId === 'custom' && !customTopic.trim()
    ? 'Add a custom review topic before continuing.'
    : null
  const canContinue = canStart && !topicError
  const paperTitle = pendingFile
    ? fileNameToTitle(pendingFile.name)
    : cacheTitle
      ? cacheTitle
    : routeArxivId
      ? `arXiv:${routeArxivId}`
      : 'Paper Preview'
  const paperSummary = pendingFile
    ? `This PDF is staged locally and will only be parsed once you start the review. Current file: ${pendingFile.name} (${formatFileSize(pendingFile.size)}).`
    : routeArxivId
      ? 'This arXiv paper is staged for review. Ingestion and debate will not begin until you start the panel in the next step.'
      : 'Choose a paper first, then configure the panel before running the debate.'
  const sourceLabel = pendingFile
    ? `Uploaded PDF - ${pendingFile.name}`
    : routeArxivId
      ? `arXiv - ${routeArxivId}`
      : 'No paper selected'
  const sourceHref = routeArxivId ? `https://arxiv.org/abs/${encodeURIComponent(routeArxivId)}` : null

  return {
    arxivDraft,
    canContinue,
    canStart,
    cacheStatus,
    customGoal,
    customTopic,
    draftNotice,
    isUpload,
    paperSummary,
    paperTitle,
    pdfUrl,
    selectedPreset,
    sourceHref,
    sourceLabel,
    topicError,
    topicPresetId,
    topicSelection,
    setArxivDraft,
    setCustomGoal,
    setCustomTopic,
    setTopicPresetId,
    handleArxivSubmit,
    handleContinue,
    handleFileSelect,
  }
}
