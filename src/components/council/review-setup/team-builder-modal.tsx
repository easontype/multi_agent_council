'use client'

import { useState } from 'react'
import { buildGeneratedTeamFromBrief, type TeamBuilderBrief, type TeamBuilderResult } from '@/lib/prompts/review-presets'
import { HoverHint } from '@/components/ui/hover-hint'
import { FieldLabel, fieldStyle, colorAlpha } from './shared'

// ─── Pure helpers ────────────────────────────────────────────────────────────

const BUILDER_CHIPS = [
  'pre-submission team',
  'harsh reviewers',
  'methods-heavy',
  'more experiments',
  'rebuttal pressure',
]

function inferBriefFromRequest(text: string, fallback: TeamBuilderBrief): TeamBuilderBrief {
  const lower = text.toLowerCase()
  const next = { ...fallback }

  if (/(literature|survey|map the field|related work)/.test(lower)) next.reviewGoal = 'literature'
  else if (/(revision|revise|fix|next draft)/.test(lower)) next.reviewGoal = 'revision'
  else if (/(rebuttal|response to reviewers|stress test)/.test(lower)) next.reviewGoal = 'rebuttal'
  else if (/(submission|submit|top conference|review team)/.test(lower)) next.reviewGoal = 'submission'

  if (/(systems|infra|latency|deployment|engineering)/.test(lower)) next.paperType = 'systems'
  else if (/(theory|proof|theorem|lemma|formal)/.test(lower)) next.paperType = 'theory'
  else if (/(applied|clinical|real world|case study|product)/.test(lower)) next.paperType = 'applied'
  else if (/(methods|benchmark|ablation|empirical|model)/.test(lower)) next.paperType = 'methods'

  if (/(harsh|skeptical|strict|aggressive|hostile)/.test(lower)) next.stance = 'skeptical'
  else if (/(supportive|constructive|friendly)/.test(lower)) next.stance = 'supportive'
  else if (/(balanced|fair)/.test(lower)) next.stance = 'balanced'

  if (/(novelty|originality|contribution)/.test(lower)) next.priority = 'novelty'
  else if (/(methods|design|assumption|rigor)/.test(lower)) next.priority = 'methods'
  else if (/(experiment|baseline|evaluation|evidence|ablation)/.test(lower)) next.priority = 'experiments'
  else if (/(writing|clarity|framing|presentation)/.test(lower)) next.priority = 'writing'
  else if (/(citation|related work|prior art|bibliography)/.test(lower)) next.priority = 'citations'

  if (/(small team|lean team|4 agents|four agents)/.test(lower)) next.teamSize = 4
  else if (/(big team|large team|6 agents|six agents)/.test(lower)) next.teamSize = 6

  return next
}

function formatBriefSummary(brief: TeamBuilderBrief) {
  const goalLabel = {
    submission: 'pre-submission',
    literature: 'literature mapping',
    revision: 'revision-focused',
    rebuttal: 'rebuttal stress-test',
  }[brief.reviewGoal]

  const typeLabel = {
    methods: 'methods-heavy',
    systems: 'systems',
    theory: 'theory',
    applied: 'applied',
  }[brief.paperType]

  return `${goalLabel} - ${typeLabel} - ${brief.stance} stance - ${brief.priority} priority`
}

// ─── BuilderOptionButton ─────────────────────────────────────────────────────

function BuilderOptionButton({
  active,
  label,
  note,
  onClick,
}: {
  active: boolean
  label: string
  note: string
  onClick: () => void
}) {
  return (
    <HoverHint content={note}>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 11px',
          borderRadius: 12,
          border: `1px solid ${active ? '#c7d2fe' : '#e4e4e7'}`,
          background: active ? '#eef2ff' : '#fff',
          color: '#18181b',
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#3730a3' : '#18181b' }}>{label}</div>
      </button>
    </HoverHint>
  )
}

// ─── TeamBuilderModal ─────────────────────────────────────────────────────────

export function TeamBuilderModal({
  onClose,
  onGenerate,
}: {
  onClose: () => void
  onGenerate: (result: TeamBuilderResult) => void
}) {
  const [builderMode, setBuilderMode] = useState<'ai' | 'quick'>('ai')
  const [step, setStep] = useState<'intent' | 'questions' | 'preview'>('intent')
  const [brief, setBrief] = useState<TeamBuilderBrief>({
    reviewGoal: 'submission',
    paperType: 'methods',
    stance: 'balanced',
    priority: 'methods',
    teamSize: 5,
  })
  const [requestText, setRequestText] = useState('')
  const [preview, setPreview] = useState<TeamBuilderResult | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [builderError, setBuilderError] = useState<string | null>(null)

  const update = <K extends keyof TeamBuilderBrief>(key: K, value: TeamBuilderBrief[K]) => {
    setBrief((current) => ({ ...current, [key]: value }))
  }

  const continueAiFlow = () => {
    setBuilderError(null)
    setBrief((current) => inferBriefFromRequest(requestText, current))
    setStep('questions')
  }

  const generatePreview = async () => {
    setLoadingPreview(true)
    setBuilderError(null)

    try {
      const res = await fetch('/api/teams/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: requestText, brief }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBuilderError(typeof data.error === 'string' ? data.error : 'Failed to generate team preview')
        return
      }

      const result = data as TeamBuilderResult
      setPreview(result.agents?.length ? result : buildGeneratedTeamFromBrief(brief))
      setStep('preview')
    } catch {
      setBuilderError('Failed to generate team preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.28)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 320,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(820px, 100%)',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          background: '#fcfcfb',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(15,23,42,0.16)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 20px',
          borderBottom: '1px solid #ececf1',
          position: 'sticky',
          top: 0,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#111827',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
            }}>
              CA
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Council Architect</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid #e4e4e7',
              background: '#fff',
              borderRadius: 999,
              width: 34,
              height: 34,
              cursor: 'pointer',
              color: '#71717a',
              fontSize: 16,
            }}
          >
            x
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {/* Mode switcher */}
          <div style={{
            marginBottom: 20,
            padding: '14px 15px',
            borderRadius: 16,
            border: '1px solid #c7d2fe',
            background: '#f8faff',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#6673bf', textTransform: 'uppercase', marginBottom: 6 }}>
              Recommended
            </div>
            <HoverHint content="Describe the team you want, then let Council Architect propose a full lineup before you apply it.">
              <button
                type="button"
                onClick={() => {
                  setBuilderMode('ai')
                  setStep('intent')
                }}
                style={{
                  width: '100%',
                  border: '1px solid #c7d2fe',
                  background: '#eef2ff',
                  color: '#18181b',
                  borderRadius: 14,
                  padding: '14px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#3730a3' }}>AI-Assisted Builder</div>
              </button>
            </HoverHint>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <HoverHint content="Use direct controls instead.">
                <button
                  type="button"
                  onClick={() => setBuilderMode('quick')}
                  style={{
                    border: '1px solid #e4e4e7',
                    background: '#fff',
                    color: '#52525b',
                    borderRadius: 999,
                    padding: '7px 11px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Open Quick Build
                </button>
              </HoverHint>
            </div>
          </div>

          {/* Error */}
          {builderError && (
            <div style={{
              marginBottom: 18,
              borderRadius: 12,
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#b91c1c',
              padding: '11px 13px',
              fontSize: 13,
              lineHeight: 1.6,
            }}>
              {builderError}
            </div>
          )}

          {/* AI flow */}
          {builderMode === 'ai' ? (
            <>
              {step === 'intent' && (
                <>
                  <div style={{ marginBottom: 18 }}>
                    <FieldLabel>Describe The Team You Want</FieldLabel>
                    <textarea
                      value={requestText}
                      onChange={(e) => setRequestText(e.target.value)}
                      placeholder="I want something like a harsh top-conference reviewer team, heavy on methods and experiments, but with one person focused on related work."
                      rows={5}
                      style={{ ...fieldStyle, resize: 'vertical', minHeight: 132, lineHeight: 1.7 }}
                    />
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <FieldLabel>Suggested Starters</FieldLabel>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {BUILDER_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setRequestText((current) => current ? `${current.trim()} ${chip}` : chip)}
                          style={{
                            border: '1px solid #c7d2fe',
                            background: '#f8faff',
                            color: '#3730a3',
                            borderRadius: 999,
                            padding: '7px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 'questions' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, marginBottom: 24 }}>
                    <div>
                      <FieldLabel>Review Goal</FieldLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                        {([
                          ['submission', 'Submission Review', 'Balanced paper review before submission'],
                          ['literature', 'Literature Review', 'Map claims, landscape, and takeaways'],
                          ['revision', 'Revision Planning', 'Find what to fix before the next draft'],
                          ['rebuttal', 'Rebuttal Stress Test', 'See whether a skeptical reviewer would move'],
                        ] as const).map(([value, label, note]) => (
                          <BuilderOptionButton
                            key={value}
                            active={brief.reviewGoal === value}
                            label={label}
                            note={note}
                            onClick={() => update('reviewGoal', value)}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Paper Type</FieldLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                        {([
                          ['methods', 'Methods', 'Empirical method or model-centric paper'],
                          ['systems', 'Systems', 'Engineering or systems tradeoff paper'],
                          ['theory', 'Theory', 'Assumptions, proofs, and formal claims matter most'],
                          ['applied', 'Applied', 'Real-world validity and practical evidence matter'],
                        ] as const).map(([value, label, note]) => (
                          <BuilderOptionButton
                            key={value}
                            active={brief.paperType === value}
                            label={label}
                            note={note}
                            onClick={() => update('paperType', value)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, marginBottom: 24 }}>
                    <div>
                      <FieldLabel>Reviewer Posture</FieldLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                        {([
                          ['skeptical', 'Skeptical', 'Push hard on weaknesses and fragile claims'],
                          ['balanced', 'Balanced', 'Fair but still demanding'],
                          ['supportive', 'Supportive', 'Constructive first, still concrete'],
                        ] as const).map(([value, label, note]) => (
                          <BuilderOptionButton
                            key={value}
                            active={brief.stance === value}
                            label={label}
                            note={note}
                            onClick={() => update('stance', value)}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Main Priority</FieldLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                        {([
                          ['novelty', 'Novelty', 'Focus on contribution and distinctiveness'],
                          ['methods', 'Methods', 'Focus on design, assumptions, and rigor'],
                          ['experiments', 'Experiments', 'Focus on evidence, baselines, and evaluation'],
                          ['writing', 'Writing', 'Focus on clarity, structure, and readability'],
                          ['citations', 'Citations', 'Focus on related work and prior-art framing'],
                        ] as const).map(([value, label, note]) => (
                          <BuilderOptionButton
                            key={value}
                            active={brief.priority === value}
                            label={label}
                            note={note}
                            onClick={() => update('priority', value)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <FieldLabel>Team Size</FieldLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                      {([4, 5, 6] as const).map((size) => (
                        <BuilderOptionButton
                          key={size}
                          active={brief.teamSize === size}
                          label={`${size} Agents`}
                          note={size === 4 ? 'Tighter and faster' : size === 5 ? 'Balanced coverage' : 'Wider specialist coverage'}
                          onClick={() => update('teamSize', size)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 'preview' && preview && (
                <>
                  <div style={{
                    marginBottom: 18,
                    padding: '14px 16px',
                    borderRadius: 16,
                    border: '1px solid #c7d2fe',
                    background: '#f8faff',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#6673bf', textTransform: 'uppercase', marginBottom: 6 }}>
                      Proposed Team
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#18181b', marginBottom: 6 }}>
                      {preview.agents.length} agents · {preview.rounds} round{preview.rounds > 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: 13, color: '#52525b', lineHeight: 1.7 }}>
                      {formatBriefSummary(brief)}
                    </div>
                  </div>

                  {preview.rationale && (
                    <div style={{
                      marginBottom: 16,
                      border: '1px solid #ececf1',
                      background: '#fff',
                      borderRadius: 14,
                      padding: '14px 15px',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
                        Why This Team
                      </div>
                      <div style={{ fontSize: 13, color: '#52525b', lineHeight: 1.68 }}>
                        {preview.rationale}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    {preview.agents.map((agent) => (
                      <div
                        key={agent.id}
                        style={{
                          border: '1px solid #ececf1',
                          borderRadius: 14,
                          background: '#fff',
                          padding: '14px 15px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: agent.color,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                          }}>
                            {agent.avatar}
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#18181b', marginBottom: 3 }}>{agent.name}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                color: agent.color,
                                background: `${agent.color}12`,
                                border: `1px solid ${colorAlpha(agent.color, '35')}`,
                                borderRadius: 999,
                                padding: '4px 7px',
                              }}>
                                {agent.focus}
                              </span>
                              <span style={{
                                fontSize: 11,
                                color: '#71717a',
                                background: '#f8f8fa',
                                border: '1px solid #ececf1',
                                borderRadius: 999,
                                padding: '4px 7px',
                              }}>
                                {agent.seatRole}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: '#52525b', lineHeight: 1.68 }}>
                          {agent.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            /* Quick build mode */
            <>
              <div style={{ marginBottom: 24 }}>
                <FieldLabel>What do you need this team to do?</FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  {([
                    ['submission', 'Submission Review', 'Balanced paper review before submission'],
                    ['literature', 'Literature Review', 'Map claims, landscape, and takeaways'],
                    ['revision', 'Revision Planning', 'Find what to fix before the next draft'],
                    ['rebuttal', 'Rebuttal Stress Test', 'See whether a skeptical reviewer would move'],
                  ] as const).map(([value, label, note]) => (
                    <BuilderOptionButton
                      key={value}
                      active={brief.reviewGoal === value}
                      label={label}
                      note={note}
                      onClick={() => update('reviewGoal', value)}
                    />
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <FieldLabel>What kind of paper is this?</FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  {([
                    ['methods', 'Methods', 'Empirical method or model-centric paper'],
                    ['systems', 'Systems', 'Engineering or systems tradeoff paper'],
                    ['theory', 'Theory', 'Assumptions, proofs, and formal claims matter most'],
                    ['applied', 'Applied', 'Real-world validity and practical evidence matter'],
                  ] as const).map(([value, label, note]) => (
                    <BuilderOptionButton
                      key={value}
                      active={brief.paperType === value}
                      label={label}
                      note={note}
                      onClick={() => update('paperType', value)}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, marginBottom: 24 }}>
                <div>
                  <FieldLabel>What reviewer posture do you want?</FieldLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                    {([
                      ['skeptical', 'Skeptical', 'Push hard on weaknesses and fragile claims'],
                      ['balanced', 'Balanced', 'Fair but still demanding'],
                      ['supportive', 'Supportive', 'Constructive first, still concrete'],
                    ] as const).map(([value, label, note]) => (
                      <BuilderOptionButton
                        key={value}
                        active={brief.stance === value}
                        label={label}
                        note={note}
                        onClick={() => update('stance', value)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel>What should the team prioritize?</FieldLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                    {([
                      ['novelty', 'Novelty', 'Focus on contribution and distinctiveness'],
                      ['methods', 'Methods', 'Focus on design, assumptions, and rigor'],
                      ['experiments', 'Experiments', 'Focus on evidence, baselines, and evaluation'],
                      ['writing', 'Writing', 'Focus on clarity, structure, and readability'],
                      ['citations', 'Citations', 'Focus on related work and prior-art framing'],
                    ] as const).map(([value, label, note]) => (
                      <BuilderOptionButton
                        key={value}
                        active={brief.priority === value}
                        label={label}
                        note={note}
                        onClick={() => update('priority', value)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <FieldLabel>How large should the team be?</FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                  {([4, 5, 6] as const).map((size) => (
                    <BuilderOptionButton
                      key={size}
                      active={brief.teamSize === size}
                      label={`${size} Agents`}
                      note={size === 4 ? 'Tighter and faster' : size === 5 ? 'Balanced coverage' : 'Wider specialist coverage'}
                      onClick={() => update('teamSize', size)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 20px 20px',
          borderTop: '1px solid #ececf1',
        }}>
          <div style={{ fontSize: 13, color: '#71717a', lineHeight: 1.55 }}>
            {builderMode === 'ai'
              ? step === 'preview'
                ? 'Use the preview as-is, or go back and refine the builder inputs.'
                : 'This flow is only a prototype of the AI builder interaction. Generated teams remain editable.'
              : 'Generated teams remain fully editable after creation.'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={builderMode === 'ai' && step !== 'intent'
                ? () => {
                    setBuilderError(null)
                    setStep(step === 'preview' ? 'questions' : 'intent')
                  }
                : onClose}
              style={{
                border: '1px solid #e4e4e7',
                background: '#fff',
                color: '#52525b',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {builderMode === 'ai' && step !== 'intent' ? 'Back' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (builderMode === 'quick') {
                  onGenerate(buildGeneratedTeamFromBrief(brief))
                  return
                }

                if (step === 'intent') {
                  continueAiFlow()
                  return
                }

                if (step === 'questions') {
                  void generatePreview()
                  return
                }

                if (preview) onGenerate(preview)
              }}
              style={{
                border: 'none',
                background: '#111827',
                color: '#fff',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 12px 28px rgba(17,24,39,0.18)',
                opacity: loadingPreview ? 0.7 : 1,
              }}
              disabled={loadingPreview}
            >
              {builderMode === 'quick'
                ? 'Generate Team'
                : step === 'intent'
                  ? 'Continue'
                  : step === 'questions'
                    ? (loadingPreview ? 'Generating Preview...' : 'Generate Preview')
                    : 'Use This Team'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
