'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCouncilReview } from '@/hooks/use-council-review'
import { peekPendingUpload } from '@/lib/pending-upload'
import {
  buildDiscussionAgents,
  buildEditableTeam,
  buildSeatsFromEditableAgents,
  createCustomEditableAgent,
  type EditableReviewAgent,
  type ReviewMode,
} from '@/lib/prompts/review-presets'
import { consumeTeamDraftPrefill } from '@/lib/review-draft-prefill'
import {
  loadSavedTeamTemplates,
  upsertSavedTeamTemplate,
  type SavedTeamTemplate,
} from '@/lib/team-template-store'
import { resolvePaperTopicSelection, PAPER_TOPIC_PRESETS } from '@/lib/paper-topics'
import { estimateHostedReviewCost } from '@/lib/review-cost'
import { ReviewSetupPanel } from '@/components/council/review-setup-panel'
import {
  ReviewActionButton,
  ReviewPageBody,
  ReviewRailCard,
  ReviewSectionFrame,
  ReviewSummaryItem,
} from '@/components/review/review-primitives'
import { reviewTheme, sectionEyebrowStyle, softCard } from '@/components/review/review-theme'

function makeTemplateId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tmpl-${Date.now()}`
}

function TeamSetupSurfaceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const arxivId = searchParams.get('arxivId')
  const topicPresetId = searchParams.get('topicPresetId') ?? 'methodology'
  const customTopic = searchParams.get('customTopic') ?? ''
  const customGoal = searchParams.get('customGoal') ?? ''
  const paperTitleParam = searchParams.get('paperTitle')

  const [pendingFile] = useState(() => peekPendingUpload())

  // Guard: no paper source → redirect to step 1
  useEffect(() => {
    if (!arxivId && !pendingFile) {
      router.replace('/review/new')
    }
  }, [arxivId, pendingFile, router])

  const [modeSelection, setModeSelection] = useState<ReviewMode>('critique')
  const [rounds, setRounds] = useState<1 | 2>(1)
  const [teamAgents, setTeamAgents] = useState<EditableReviewAgent[]>(() => buildEditableTeam('critique'))
  const [savedTemplates, setSavedTemplates] = useState<SavedTeamTemplate[]>([])
  const [saveChecked, setSaveChecked] = useState(false)
  const [templateName, setTemplateName] = useState('')

  const prefillConsumedRef = useRef(false)

  useEffect(() => {
    if (prefillConsumedRef.current) return
    prefillConsumedRef.current = true
    const prefill = consumeTeamDraftPrefill()
    if (prefill) {
      setModeSelection(prefill.mode)
      setRounds(prefill.rounds)
      setTeamAgents(prefill.agents)
    }
  }, [])

  useEffect(() => {
    loadSavedTeamTemplates().then(setSavedTemplates).catch(() => {})
  }, [])

  const { start, phase, error } = useCouncilReview(arxivId)

  const busy = phase === 'ingesting'

  const handleModeChange = (nextMode: ReviewMode) => {
    setModeSelection(nextMode)
    setTeamAgents(buildEditableTeam(nextMode))
  }

  const handleLoadTemplate = (template: SavedTeamTemplate) => {
    setModeSelection(template.mode)
    setRounds(template.rounds)
    setTeamAgents(template.agents)
  }

  const handleSaveTemplate = useCallback(async (name: string) => {
    const now = new Date().toISOString()
    const updated = await upsertSavedTeamTemplate({
      id: makeTemplateId(),
      name: name.trim(),
      mode: modeSelection,
      rounds,
      agents: teamAgents,
      createdAt: now,
      updatedAt: now,
    })
    setSavedTemplates(updated)
  }, [modeSelection, rounds, teamAgents])

  const activeCount = teamAgents.filter((a) => a.enabled).length
  const costEstimate = estimateHostedReviewCost(activeCount, rounds)

  const topicSelection = resolvePaperTopicSelection({ topicPresetId, topic: customTopic, goal: customGoal })
  const topicPreset = PAPER_TOPIC_PRESETS.find((p) => p.id === topicPresetId) ?? PAPER_TOPIC_PRESETS[0]
  const topicDisplayLabel = topicPresetId === 'custom' && customTopic.trim()
    ? customTopic.trim()
    : topicPreset.label

  const canStart = Boolean(arxivId || pendingFile)
  const startDisabled = busy || !canStart || activeCount < 2

  const paperLabel = paperTitleParam
    ?? (arxivId ? `arXiv: ${arxivId}` : pendingFile ? pendingFile.name : 'Paper')

  const backHref = arxivId
    ? `/review/new?arxiv=${encodeURIComponent(arxivId)}`
    : '/review/new'

  const handleStart = async () => {
    if (saveChecked && templateName.trim()) {
      await handleSaveTemplate(templateName)
    }
    start({
      mode: modeSelection,
      rounds,
      customSeats: buildSeatsFromEditableAgents(teamAgents),
      discussionAgents: buildDiscussionAgents(teamAgents),
      topic: topicSelection.topic,
      goal: topicSelection.goal,
      topicPresetId: topicSelection.topicPresetId,
      onSessionReady: (sessionId) => {
        router.push(`/review/${sessionId}`)
      },
    })
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#fff',
      fontFamily: reviewTheme.fonts.body,
    }}>
      {/* Step header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 24px',
        height: 54,
        flexShrink: 0,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid #ececf1',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
      }}>
        <a
          href={backHref}
          onClick={(e) => { e.preventDefault(); router.push(backHref) }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#52525b',
            textDecoration: 'none',
            border: '1px solid #e4e4e7',
            borderRadius: 8,
            padding: '5px 10px',
            background: '#fff',
          }}
        >
          ← Back
        </a>

        <div style={{ width: 1, height: 28, background: '#ebebed' }} />

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 1 }}>
            Step 2 of 2
          </div>
          <div style={{
            fontSize: 12.5,
            color: '#52525b',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 520,
          }}>
            <span style={{ fontWeight: 600, color: '#18181b' }}>{paperLabel}</span>
            <span style={{ color: '#a1a1aa', margin: '0 6px' }}>·</span>
            <span>{topicDisplayLabel}</span>
          </div>
        </div>
      </header>

      {/* Hero title */}
      <div style={{
        padding: '28px 36px 20px',
        borderBottom: `1px solid ${reviewTheme.colors.border}`,
        background: `linear-gradient(180deg, #fbfaf6 0%, #f3efe7 100%)`,
        flexShrink: 0,
      }}>
        <div style={sectionEyebrowStyle({ marginBottom: 6 })}>Configure the Team</div>
        <h1 style={{
          margin: 0,
          fontSize: 30,
          lineHeight: 1.1,
          letterSpacing: '-0.04em',
          color: reviewTheme.colors.ink,
          fontFamily: reviewTheme.fonts.display,
        }}>
          Choose the debate agents and launch the council.
        </h1>
      </div>

      <ReviewPageBody>
        <div className="team-setup-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(240px, 0.5fr)',
          gap: 20,
          alignItems: 'start',
        }}>
          {/* Main column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>

            {/* Agent setup panel */}
            <ReviewSectionFrame
              eyebrow="Step 2a"
              title="Review setup"
              description="Choose the review mode, set the debate depth, and configure the seats that will participate."
            >
              <ReviewSetupPanel
                paperTitle={paperLabel}
                paperSummary=""
                sourceLabel={arxivId ? `arXiv ${arxivId}` : (pendingFile?.name ?? 'Upload')}
                mode={modeSelection}
                rounds={rounds}
                agents={teamAgents}
                busy={busy}
                canStart={canStart}
                costLabel={`$${costEstimate.minUsd.toFixed(2)}–$${costEstimate.maxUsd.toFixed(2)}`}
                error={error}
                onModeChange={handleModeChange}
                onRoundsChange={setRounds}
                onAgentsChange={setTeamAgents}
                onAddAgent={() => setTeamAgents((current) => [...current, createCustomEditableAgent(current.length)])}
                onStart={handleStart}
                showLaunchFooter={false}
              />
            </ReviewSectionFrame>

            {/* Templates */}
            {savedTemplates.length > 0 && (
              <ReviewSectionFrame
                eyebrow="Step 2b"
                title="Load a saved team"
                description="Apply a previously saved team configuration before launch."
              >
                <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {savedTemplates.slice(0, 5).map((template) => (
                    <div
                      key={template.id}
                      style={{
                        ...softCard({ padding: '11px 13px' }),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 2 }}>
                          {template.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#71717a' }}>
                          {template.mode === 'gap' ? 'Gap Analysis' : 'Academic Critique'} · {template.rounds} round{template.rounds > 1 ? 's' : ''} · {template.agents.filter((a) => a.enabled).length} agents
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLoadTemplate(template)}
                        style={{
                          border: '1px solid #d4d4d8',
                          background: '#fff',
                          color: '#3f3f46',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        Load
                      </button>
                    </div>
                  ))}
                </div>
              </ReviewSectionFrame>
            )}

            {/* Save as template + start */}
            <section style={{
              ...softCard({ padding: '18px 20px 20px' }),
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={saveChecked}
                  onChange={(e) => setSaveChecked(e.target.checked)}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#111827' }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>
                  Save this team as a template
                </span>
              </label>

              {saveChecked && (
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                  autoFocus
                  style={{
                    border: `1px solid ${reviewTheme.colors.borderStrong}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13,
                    color: reviewTheme.colors.ink,
                    background: '#fffdfa',
                    outline: 'none',
                  }}
                />
              )}

              {error && (
                <div style={{
                  border: `1px solid ${reviewTheme.colors.errorBorder}`,
                  background: reviewTheme.colors.errorBg,
                  color: reviewTheme.colors.errorText,
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12.5,
                  lineHeight: 1.6,
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <ReviewActionButton
                  variant="primary"
                  disabled={startDisabled}
                  onClick={handleStart}
                  style={{
                    padding: '12px 24px',
                    fontSize: 14,
                    fontWeight: 700,
                    background: startDisabled ? '#d4d4d8' : '#111827',
                    color: startDisabled ? '#fff' : '#fff',
                    borderRadius: 12,
                  }}
                >
                  {busy ? 'Preparing…' : 'Start Review →'}
                </ReviewActionButton>
              </div>
            </section>
          </div>

          {/* Sticky rail */}
          <div style={{ minWidth: 0 }}>
            <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ReviewRailCard eyebrow="Launch Review" accent>
                <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2, marginBottom: 8, fontFamily: reviewTheme.fonts.display }}>
                  Review is ready to launch.
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.72)', marginBottom: 16 }}>
                  {startDisabled && !busy
                    ? activeCount < 2
                      ? 'Keep at least two active agents before launch.'
                      : 'Select a paper to continue.'
                    : busy
                      ? 'Ingesting paper and starting the council…'
                      : 'Panel is configured and ready.'}
                </div>
                <ReviewActionButton
                  variant="primary"
                  disabled={startDisabled}
                  onClick={handleStart}
                  style={{
                    width: '100%',
                    background: startDisabled ? 'rgba(255,255,255,0.22)' : '#fff',
                    color: startDisabled ? 'rgba(255,255,255,0.7)' : '#111827',
                  }}
                >
                  {busy ? 'Preparing…' : 'Start Review →'}
                </ReviewActionButton>
              </ReviewRailCard>

              <ReviewRailCard eyebrow="Team Summary">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <ReviewSummaryItem label="Paper" value={paperLabel} />
                  <ReviewSummaryItem label="Focus" value={topicDisplayLabel} />
                  <ReviewSummaryItem
                    label="Mode"
                    value={modeSelection === 'gap' ? 'Gap Analysis' : 'Academic Critique'}
                  />
                  <ReviewSummaryItem label="Rounds" value={`${rounds} round${rounds > 1 ? 's' : ''}`} />
                  <ReviewSummaryItem
                    label="Active Seats"
                    value={`${activeCount} active`}
                    tone={activeCount >= 2 ? '#18181b' : '#b91c1c'}
                  />
                  <ReviewSummaryItem
                    label="Estimated Cost"
                    value={`$${costEstimate.minUsd.toFixed(2)}–$${costEstimate.maxUsd.toFixed(2)}`}
                  />
                </div>
              </ReviewRailCard>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .team-setup-grid {
              grid-template-columns: 1fr !important;
              gap: 14px !important;
            }
          }
        `}</style>
      </ReviewPageBody>
    </div>
  )
}

export function TeamSetupSurface() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        height: '100vh',
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
      <TeamSetupSurfaceContent />
    </Suspense>
  )
}
