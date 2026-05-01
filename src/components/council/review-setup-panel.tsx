'use client'

import { useEffect, useState } from 'react'
import type { EditableReviewAgent, ReviewMode, TeamBuilderResult } from '@/lib/prompts/review-presets'
import { HoverHint } from '@/components/ui/hover-hint'
import { AgentCard, AgentDetailModal, TeamBuilderModal, SectionLabel } from './review-setup'
import { useReviewSetupStore } from '@/stores/review-setup-store'

interface ReviewSetupPanelProps {
  paperTitle: string
  paperSummary: string
  sourceLabel: string
  mode: ReviewMode
  rounds: 1 | 2
  agents: EditableReviewAgent[]
  busy: boolean
  canStart: boolean
  costLabel?: string
  error?: string | null
  onModeChange: (mode: ReviewMode) => void
  onRoundsChange: (rounds: 1 | 2) => void
  onAgentsChange: (agents: EditableReviewAgent[]) => void
  onAddAgent: () => void
  onStart: () => void
  showLaunchFooter?: boolean
}

export function ReviewSetupPanel({
  paperTitle,
  paperSummary,
  sourceLabel,
  mode,
  rounds,
  agents,
  busy,
  canStart,
  costLabel,
  error,
  onModeChange,
  onRoundsChange,
  onAgentsChange,
  onAddAgent,
  onStart,
  showLaunchFooter = true,
}: ReviewSetupPanelProps) {
  const enabledCount = agents.filter((agent) => agent.enabled).length
  const startDisabled = busy || !canStart || enabledCount < 2

  const { editingId, builderOpen, setEditingId, setBuilderOpen } = useReviewSetupStore()

  const editingAgent = agents.find((agent) => agent.id === editingId) ?? null

  const updateAgent = (updated: EditableReviewAgent) => {
    onAgentsChange(agents.map((agent) => agent.id === updated.id ? updated : agent))
  }

  const toggleAgent = (id: string) => {
    onAgentsChange(agents.map((agent) => agent.id === id ? { ...agent, enabled: !agent.enabled } : agent))
  }

  const deleteAgent = (id: string) => {
    onAgentsChange(agents.filter((agent) => agent.id !== id))
  }

  const handleGenerateTeam = (generated: TeamBuilderResult) => {
    onModeChange(generated.mode)
    onRoundsChange(generated.rounds)
    onAgentsChange(generated.agents)
    setBuilderOpen(false)
  }

  return (
    <>
      <div style={{ height: '100%', overflowY: 'auto', padding: '26px 20px 34px' }}>

        {/* Paper info */}
        <div style={{
          background: '#fff',
          border: '1px solid #ebebed',
          borderRadius: 16,
          padding: '18px 18px',
          marginBottom: 18,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <SectionLabel>Paper</SectionLabel>
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            color: '#18181b',
            lineHeight: 1.45,
            fontFamily: "'Georgia', 'Times New Roman', serif",
            letterSpacing: '-0.015em',
            marginBottom: 8,
          }}>
            {paperTitle}
          </div>
          <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 10 }}>
            {sourceLabel}
          </div>
          <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.7, margin: 0 }}>
            {paperSummary}
          </p>
        </div>

        {/* Mode + rounds */}
        <div style={{
          background: '#fff',
          border: '1px solid #ebebed',
          borderRadius: 16,
          padding: '18px 18px',
          marginBottom: 18,
        }}>
          <SectionLabel>Defaults</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
            {([
              { value: 'critique', label: 'Academic Critique', note: 'Balanced pre-submission review' },
              { value: 'gap', label: 'Gap Analysis', note: 'Sharper revision and gap-finding posture' },
            ] as const).map((option) => {
              const active = mode === option.value
              return (
                <HoverHint key={option.value} content={option.note}>
                  <button
                    type="button"
                    onClick={() => onModeChange(option.value)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 13px',
                      borderRadius: 12,
                      border: `1px solid ${active ? '#111827' : '#e4e4e7'}`,
                      background: active ? '#111827' : '#fcfcfb',
                      color: active ? '#fff' : '#18181b',
                      cursor: 'pointer',
                      minHeight: 54,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{option.label}</div>
                  </button>
                </HoverHint>
              )
            })}
            <HoverHint content="Answer a few questions and generate a full custom panel.">
              <button
                type="button"
                onClick={() => setBuilderOpen(true)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 13px',
                  borderRadius: 12,
                  border: '1px solid #c7d2fe',
                  background: '#f8faff',
                  color: '#18181b',
                  cursor: 'pointer',
                  minHeight: 54,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#3730a3' }}>Build Team</div>
              </button>
            </HoverHint>
          </div>

          <SectionLabel>Rounds</SectionLabel>
          <div style={{ display: 'flex', gap: 10 }}>
            {([
              { value: 1 as const, label: '1 Round', note: 'Single-pass debate' },
              { value: 2 as const, label: '2 Rounds', note: 'Adds cross-examination when needed' },
            ]).map((option) => {
              const active = rounds === option.value
              return (
                <HoverHint key={option.value} content={option.note}>
                  <button
                    type="button"
                    onClick={() => onRoundsChange(option.value)}
                    style={{
                      width: '100%',
                      padding: '12px 13px',
                      borderRadius: 12,
                      border: `1px solid ${active ? '#111827' : '#e4e4e7'}`,
                      background: active ? '#f5f5f7' : '#fcfcfb',
                      color: '#18181b',
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: 50,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{option.label}</div>
                  </button>
                </HoverHint>
              )
            })}
          </div>
        </div>

        {/* Agent list */}
        <div style={{
          background: '#fff',
          border: '1px solid #ebebed',
          borderRadius: 16,
          padding: '18px 18px',
          marginBottom: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <SectionLabel>Your Debate Team</SectionLabel>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: enabledCount >= 2 ? '#71717a' : '#dc2626',
            }}>
              {enabledCount} active
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onOpen={() => setEditingId(agent.id)}
                onToggle={() => toggleAgent(agent.id)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={onAddAgent}
              style={{
                flex: 1,
                border: '1px dashed #c7c7cf',
                background: '#fafafa',
                color: '#3f3f46',
                borderRadius: 12,
                padding: '13px 12px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Add Manual Seat
            </button>
          </div>

          {enabledCount < 2 && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626', lineHeight: 1.55 }}>
              Keep at least two active agents so the debate has meaningful disagreement.
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 18,
            borderRadius: 12,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.65,
          }}>
            {error}
          </div>
        )}

        {showLaunchFooter && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingTop: 2,
          }}>
            <button
              type="button"
              disabled={startDisabled}
              onClick={onStart}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: 12,
                padding: '13px 16px',
                background: startDisabled ? '#d4d4d8' : '#111827',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: startDisabled ? 'default' : 'pointer',
                transition: 'background 150ms',
                boxShadow: startDisabled ? 'none' : '0 8px 22px rgba(17,24,39,0.16)',
              }}
            >
              {busy ? 'Preparing...' : 'Start Review'}
            </button>
            {costLabel && (
              <div style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                border: '1px solid #ececf1',
                borderRadius: 12,
                background: '#fff',
              }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: '#a1a1aa',
                  textTransform: 'uppercase',
                }}>
                  Cost
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b', whiteSpace: 'nowrap' }}>
                  {costLabel}
                </span>
              </div>
            )}
          </div>
        )}

        {busy && <IngestProgress />}
      </div>

      {/* Modals */}
      {editingAgent && (
        <AgentDetailModal
          agent={editingAgent}
          onClose={() => setEditingId(null)}
          onSave={updateAgent}
          onDelete={deleteAgent}
        />
      )}
      {builderOpen && (
        <TeamBuilderModal
          onClose={() => setBuilderOpen(false)}
          onGenerate={handleGenerateTeam}
        />
      )}
    </>
  )
}

const INGEST_STEPS = [
  { label: 'Fetching paper', detail: 'Downloading PDF and extracting text' },
  { label: 'Building knowledge index', detail: 'Embedding paper chunks for citation retrieval' },
  { label: 'Preparing debate', detail: 'Initialising review council and seats' },
]

function IngestProgress() {
  const [step, setStep] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStep((s) => Math.min(s + 1, INGEST_STEPS.length - 1))
    }, 12000)
    const dotTimer = setInterval(() => setTick((t) => t + 1), 500)
    return () => { clearInterval(stepTimer); clearInterval(dotTimer) }
  }, [])

  const dots = '.'.repeat((tick % 3) + 1).padEnd(3, ' ')

  return (
    <div style={{
      marginTop: 14,
      padding: '14px 16px',
      background: '#f8f8fa',
      border: '1px solid #e4e4e7',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {INGEST_STEPS.map((s, i) => {
          const done = i < step
          const active = i === step
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? '#16a34a' : active ? '#111827' : '#e4e4e7',
                transition: 'background 400ms',
              }}>
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : active ? (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'ingest-pulse 1s ease-in-out infinite' }} />
                ) : (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a1a1aa' }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: done ? '#16a34a' : active ? '#111827' : '#a1a1aa', transition: 'color 400ms' }}>
                  {s.label}{active ? dots : ''}
                </div>
                {active && (
                  <div style={{ fontSize: 11, color: '#71717a', marginTop: 1 }}>{s.detail}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: '#a1a1aa', lineHeight: 1.5 }}>
        First-time ingest typically takes 30–60 s. Subsequent reviews of the same paper skip this step.
      </div>
      <style>{`@keyframes ingest-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }`}</style>
    </div>
  )
}
