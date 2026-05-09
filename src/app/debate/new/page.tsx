/* LEGACY — entry point superseded by /home flow (Phase C). Keep for backwards-compat. */
'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCouncilReview } from '@/hooks/use-council-review'
import { peekPendingUpload } from '@/lib/pending-upload'
import { buildAdversarialTeam, type AdversarialDebateConfig } from '@/lib/prompts/debate-presets'
import type { ReviewDomain } from '@/lib/prompts/review-presets'
import { DebateSetupPanel } from '@/components/debate/debate-setup/debate-setup-panel'
import { reviewTheme } from '@/components/review/review-theme'

function DebateNewContent() {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [arxivId, setArxivId] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(() => peekPendingUpload())
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [context, setContext] = useState('')
  const [domain, setDomain] = useState<ReviewDomain>('materials')
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({})

  const { start, phase, error } = useCouncilReview(arxivId)

  const handleFileSelect = (file: File) => {
    setPendingFile(file)
    setArxivId(null)
  }

  const handleArxivIdChange = (id: string | null) => {
    setArxivId(id)
    if (id) setPendingFile(null)
  }

  const handleStart = async () => {
    const config: AdversarialDebateConfig = {
      optionA: optionA.trim(),
      optionB: optionB.trim(),
      context: context.trim() || undefined,
      domain,
      selectedRoleIds,
      customSeatPrompts: Object.keys(customPrompts).length ? customPrompts : undefined,
    }

    const seats = buildAdversarialTeam(config)

    const discussionAgents = seats.map((seat, i) => ({
      id: `${seat.team ?? 'seat'}-${i}`,
      name: seat.role,
      role: seat.team === 'moderator' ? 'Synthesis' : seat.team === 'option_a' ? optionA : optionB,
      seatRole: seat.role,
      color: seat.team === 'option_a' ? '#4a6b73' : seat.team === 'option_b' ? '#7a4c54' : '#6b7280',
      avatar: seat.role.charAt(0).toUpperCase(),
    }))

    await start({
      mode: 'critique',
      rounds: 2,
      customSeats: seats,
      discussionAgents,
      topic: `${optionA} vs ${optionB}`,
      goal: context.trim() || `Compare ${optionA} and ${optionB} — which is better supported by the literature?`,
      onSessionReady: (sessionId) => {
        router.push(`/review/${sessionId}`)
      },
    })
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <DebateSetupPanel
        step={step}
        optionA={optionA}
        optionB={optionB}
        context={context}
        domain={domain}
        selectedRoleIds={selectedRoleIds}
        arxivId={arxivId}
        hasPendingFile={Boolean(pendingFile)}
        phase={phase}
        error={error}
        onStepChange={setStep}
        onOptionAChange={setOptionA}
        onOptionBChange={setOptionB}
        onContextChange={setContext}
        onDomainChange={setDomain}
        onSelectedRoleIdsChange={setSelectedRoleIds}
        customPrompts={customPrompts}
        onCustomPromptsChange={setCustomPrompts}
        onArxivIdChange={handleArxivIdChange}
        onFileSelect={handleFileSelect}
        onStart={handleStart}
      />
    </div>
  )
}

export default function DebateNewPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        height: '100dvh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        color: '#a1a1aa',
        fontSize: 14,
        fontFamily: reviewTheme.fonts.body,
      }}>
        Loading…
      </div>
    }>
      <DebateNewContent />
    </Suspense>
  )
}
