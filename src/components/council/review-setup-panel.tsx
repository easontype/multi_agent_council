'use client'

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

        {/* Start + cost */}
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
            {busy ? 'Preparing paper library...' : 'Start Review'}
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
