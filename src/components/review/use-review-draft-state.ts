'use client'

import { useEffect, useState } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { peekPendingUpload, setPendingUpload } from '@/lib/pending-upload'
import {
  PAPER_TOPIC_PRESETS,
  resolvePaperTopicSelection,
} from '@/lib/paper-topics'
import {
  buildEditableTeam,
  createCustomEditableAgent,
  type EditableReviewAgent,
  type ReviewMode,
} from '@/lib/prompts/review-presets'
import { estimateHostedReviewCost } from '@/lib/review-cost'
import {
  consumeReviewDraftPrefill,
} from '@/lib/review-draft-prefill'
import {
  deleteSavedTeamTemplate,
  loadSavedTeamTemplates,
  upsertSavedTeamTemplate,
  type SavedTeamTemplate,
} from '@/lib/team-template-store'

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function createTemplateId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tmpl-${Date.now()}`
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
  const [modeSelection, setModeSelection] = useState<ReviewMode>('critique')
  const [rounds, setRounds] = useState<1 | 2>(1)
  const [teamAgents, setTeamAgents] = useState<EditableReviewAgent[]>(() => buildEditableTeam('critique'))
  const [savedTemplates, setSavedTemplates] = useState<SavedTeamTemplate[]>([])
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [draftNotice, setDraftNotice] = useState<string | null>(null)
  const [topicPresetId, setTopicPresetId] = useState<string>('methodology')
  const [customTopic, setCustomTopic] = useState('')
  const [customGoal, setCustomGoal] = useState('')
  const [cacheStatus, setCacheStatus] = useState<'ready' | 'processing' | 'failed' | 'unknown' | null>(null)
  const [cacheTitle, setCacheTitle] = useState<string | null>(null)

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
    if (!isDraftRoute) return
    const prefill = consumeReviewDraftPrefill()
    if (!prefill) return
    setModeSelection(prefill.mode)
    setRounds(prefill.rounds)
    setTeamAgents(prefill.agents)
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

  const handleModeChange = (nextMode: ReviewMode) => {
    setModeSelection(nextMode)
    setTeamAgents(buildEditableTeam(nextMode))
  }

  const handleLoadTemplate = (template: SavedTeamTemplate) => {
    setModeSelection(template.mode)
    setRounds(template.rounds)
    setTeamAgents(template.agents)
  }

  const handleDeleteTemplate = async (id: string) => {
    setSavedTemplates(await deleteSavedTeamTemplate(id))
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

  const isUpload = Boolean(pendingFile)
  const canStart = Boolean(routeArxivId || pendingFile)
  const activeCount = teamAgents.filter((agent) => agent.enabled).length
  const costEstimate = estimateHostedReviewCost(activeCount, rounds)
  const topicSelection = resolvePaperTopicSelection({
    topicPresetId,
    topic: customTopic,
    goal: customGoal,
  })
  const selectedPreset = PAPER_TOPIC_PRESETS.find((item) => item.id === topicPresetId) ?? PAPER_TOPIC_PRESETS[0]
  const topicError = topicPresetId === 'custom' && !customTopic.trim()
    ? 'Add a custom review topic before launch.'
    : null
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
      ? 'This arXiv paper is staged for review. The PDF preview is live, but ingestion and debate will not begin until you start the panel.'
      : 'Choose a paper first, then configure the panel before running the debate.'
  const sourceLabel = pendingFile
    ? `Uploaded PDF - ${pendingFile.name}`
    : routeArxivId
      ? `arXiv - ${routeArxivId}`
      : 'No paper selected'
  const sourceHref = routeArxivId ? `https://arxiv.org/abs/${encodeURIComponent(routeArxivId)}` : null

  return {
    activeCount,
    arxivDraft,
    canStart,
    cacheStatus,
    costEstimate,
    customGoal,
    customTopic,
    draftNotice,
    isUpload,
    modeSelection,
    paperSummary,
    paperTitle,
    pdfUrl,
    selectedPreset,
    rounds,
    savedTemplates,
    sourceHref,
    sourceLabel,
    teamAgents,
    topicError,
    topicPresetId,
    topicSelection,
    setArxivDraft,
    setCustomGoal,
    setCustomTopic,
    setRounds,
    setTeamAgents,
    setTopicPresetId,
    handleArxivSubmit,
    handleDeleteTemplate,
    handleDuplicateTemplate,
    handleFileSelect,
    handleLoadTemplate,
    handleModeChange,
    handleRenameTemplate,
    handleSaveTemplate,
    createCustomEditableAgent,
  }
}
