'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { EditableReviewAgent, ReviewMode } from '@/lib/review-presets'

interface ReviewSetupPanelProps {
  paperTitle: string
  paperSummary: string
  sourceLabel: string
  mode: ReviewMode
  rounds: 1 | 2
  agents: EditableReviewAgent[]
  busy: boolean
  canStart: boolean
  error?: string | null
  onModeChange: (mode: ReviewMode) => void
  onRoundsChange: (rounds: 1 | 2) => void
  onAgentsChange: (agents: EditableReviewAgent[]) => void
  onAddAgent: () => void
  onStart: () => void
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: '#a1a1aa',
      textTransform: 'uppercase',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function colorAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label style={{
      display: 'block',
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.06em',
      color: '#9ca3af',
      textTransform: 'uppercase',
      marginBottom: 7,
    }}>
      {children}
    </label>
  )
}

const fieldStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #e4e4e7',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 13,
  color: '#18181b',
  background: '#fff',
  outline: 'none',
}

function AgentDetailModal({
  agent,
  onClose,
  onSave,
  onDelete,
}: {
  agent: EditableReviewAgent
  onClose: () => void
  onSave: (agent: EditableReviewAgent) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState<EditableReviewAgent>(agent)

  useEffect(() => {
    setDraft(agent)
  }, [agent])

  const update = <K extends keyof EditableReviewAgent>(key: K, value: EditableReviewAgent[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handleSave = () => {
    onSave({
      ...draft,
      name: draft.name.trim() || 'Custom Reviewer',
      seatRole: draft.seatRole.trim() || draft.name.trim() || 'Custom Reviewer',
      focus: draft.focus.trim() || 'Custom Role',
      avatar: (draft.avatar.trim().slice(0, 2) || 'A').toUpperCase(),
      color: draft.color || '#5f6672',
      description: draft.description.trim() || 'A custom debate seat in the review team.',
      systemPrompt: draft.systemPrompt.trim(),
      bias: draft.bias?.trim() || undefined,
      model: draft.model.trim() || 'claude-sonnet-4-6',
      tools: draft.tools.map((tool) => tool.trim()).filter(Boolean),
    })
    onClose()
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
        zIndex: 300,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          background: '#fbfbfb',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(15,23,42,0.16)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 20px',
          borderBottom: '1px solid #ececf1',
          position: 'sticky',
          top: 0,
          background: 'rgba(251,251,251,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: draft.color,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
            }}>
              {draft.avatar}
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{draft.name}</div>
              <div style={{ fontSize: 12.5, color: '#6b7280' }}>
                Fine-tune this reviewer before the debate starts.
              </div>
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
            ×
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginBottom: 16 }}>
            <div>
              <FieldLabel>Display Name</FieldLabel>
              <input value={draft.name} onChange={(e) => update('name', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <FieldLabel>Seat Role</FieldLabel>
              <input value={draft.seatRole} onChange={(e) => update('seatRole', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <FieldLabel>Focus Label</FieldLabel>
              <input value={draft.focus} onChange={(e) => update('focus', e.target.value)} style={fieldStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 10 }}>
              <div>
                <FieldLabel>Avatar</FieldLabel>
                <input value={draft.avatar} onChange={(e) => update('avatar', e.target.value.toUpperCase())} style={fieldStyle} maxLength={2} />
              </div>
              <div>
                <FieldLabel>Accent</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={draft.color} onChange={(e) => update('color', e.target.value)} style={{ width: 44, height: 42, border: '1px solid #e4e4e7', borderRadius: 10, background: '#fff' }} />
                  <input value={draft.color} onChange={(e) => update('color', e.target.value)} style={fieldStyle} />
                </div>
              </div>
            </div>
            <div>
              <FieldLabel>Model</FieldLabel>
              <input value={draft.model} onChange={(e) => update('model', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <FieldLabel>Enabled</FieldLabel>
              <button
                type="button"
                onClick={() => update('enabled', !draft.enabled)}
                style={{
                  ...fieldStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span>{draft.enabled ? 'Included in the panel' : 'Excluded from the panel'}</span>
                <span style={{
                  width: 34,
                  height: 20,
                  borderRadius: 999,
                  background: draft.enabled ? draft.color : '#d4d4d8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: 2,
                  justifyContent: draft.enabled ? 'flex-end' : 'flex-start',
                }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff' }} />
                </span>
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Card Summary</FieldLabel>
            <textarea
              value={draft.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              style={{ ...fieldStyle, resize: 'vertical', minHeight: 88 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <FieldLabel>System Prompt</FieldLabel>
            <textarea
              value={draft.systemPrompt}
              onChange={(e) => update('systemPrompt', e.target.value)}
              rows={10}
              style={{ ...fieldStyle, resize: 'vertical', minHeight: 220, fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace", lineHeight: 1.6 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            <div>
              <FieldLabel>Bias / Review Stance</FieldLabel>
              <textarea
                value={draft.bias ?? ''}
                onChange={(e) => update('bias', e.target.value)}
                rows={4}
                style={{ ...fieldStyle, resize: 'vertical', minHeight: 110 }}
              />
            </div>
            <div>
              <FieldLabel>Tools</FieldLabel>
              <textarea
                value={draft.tools.join(', ')}
                onChange={(e) => update('tools', e.target.value.split(','))}
                rows={4}
                style={{ ...fieldStyle, resize: 'vertical', minHeight: 110 }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#71717a', lineHeight: 1.55 }}>
                Comma-separated tool names, for example: <code>rag_query, search_papers, fetch_paper</code>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 20px 20px',
          borderTop: '1px solid #ececf1',
        }}>
          <div>
            {agent.isCustom && (
              <button
                type="button"
                onClick={() => {
                  onDelete(agent.id)
                  onClose()
                }}
                style={{
                  border: '1px solid #fecaca',
                  background: '#fff5f5',
                  color: '#b91c1c',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Remove Agent
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: '1px solid #e4e4e7',
                background: '#fff',
                color: '#52525b',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                border: 'none',
                background: '#111827',
                color: '#fff',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 12px 28px rgba(17,24,39,0.18)',
              }}
            >
              Save Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AgentCard({
  agent,
  onOpen,
  onToggle,
}: {
  agent: EditableReviewAgent
  onOpen: () => void
  onToggle: () => void
}) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 16,
      background: '#fff',
      border: '1px solid #ececf1',
      boxShadow: '0 1px 4px rgba(15,23,42,0.03)',
      overflow: 'hidden',
      opacity: agent.enabled ? 1 : 0.72,
    }}>
      <div style={{
        height: 4,
        background: `linear-gradient(90deg, ${agent.color}, ${colorAlpha(agent.color, '66')})`,
      }} />
      <button
        type="button"
        onClick={onOpen}
        style={{
          width: '100%',
          padding: '15px 15px 13px',
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: agent.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            boxShadow: `0 8px 18px ${colorAlpha(agent.color, '2c')}`,
          }}>
            {agent.avatar}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#111827' }}>
                {agent.name}
              </span>
              <span style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: agent.color,
              }}>
                {agent.focus}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {agent.seatRole}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: '#5f5f68', lineHeight: 1.65, minHeight: 60 }}>
          {agent.description}
        </div>
      </button>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '0 15px 14px',
      }}>
        <button
          type="button"
          onClick={onOpen}
          style={{
            border: '1px solid #e4e4e7',
            background: '#fafafa',
            color: '#52525b',
            borderRadius: 999,
            padding: '7px 11px',
            fontSize: 11.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Edit Prompt
        </button>
        <button
          type="button"
          onClick={onToggle}
          style={{
            border: 'none',
            background: 'transparent',
            color: agent.enabled ? '#111827' : '#9ca3af',
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {agent.enabled ? 'Active' : 'Disabled'}
        </button>
      </div>
    </div>
  )
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
  error,
  onModeChange,
  onRoundsChange,
  onAgentsChange,
  onAddAgent,
  onStart,
}: ReviewSetupPanelProps) {
  const enabledCount = agents.filter((agent) => agent.enabled).length
  const startDisabled = busy || !canStart || enabledCount < 2
  const [editingId, setEditingId] = useState<string | null>(null)
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

  return (
    <>
      <div style={{ height: '100%', overflowY: 'auto', padding: '22px 18px 28px' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.09em',
            color: '#aaa',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Review Setup
          </div>
          <h2 style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#1a1a1a',
            lineHeight: 1.15,
            letterSpacing: '-0.035em',
            margin: '0 0 8px',
            fontFamily: "'Georgia', 'Times New Roman', serif",
          }}>
            Shape the debate team before it runs.
          </h2>
          <p style={{ fontSize: 13, color: '#777', lineHeight: 1.7, margin: 0 }}>
            Open any reviewer to inspect or rewrite the system prompt, then add your own seats if the default panel is too generic.
          </p>
        </div>

        <div style={{
          background: '#fff',
          border: '1px solid #ebebed',
          borderRadius: 14,
          padding: '15px 16px',
          marginBottom: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <SectionLabel>Paper</SectionLabel>
          <div style={{
            fontSize: 15,
            fontWeight: 600,
            color: '#1a1a1a',
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
          <p style={{ fontSize: 12.5, color: '#666', lineHeight: 1.7, margin: 0 }}>
            {paperSummary}
          </p>
        </div>

        <div style={{
          background: '#fff',
          border: '1px solid #ebebed',
          borderRadius: 14,
          padding: '15px 16px',
          marginBottom: 16,
        }}>
          <SectionLabel>Defaults</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {([
              { value: 'critique', label: 'Academic Critique', note: 'Balanced pre-submission review' },
              { value: 'gap', label: 'Gap Analysis', note: 'Sharper revision and gap-finding posture' },
            ] as const).map((option) => {
              const active = mode === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onModeChange(option.value)}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    padding: '12px 12px',
                    borderRadius: 12,
                    border: `1px solid ${active ? '#111827' : '#e4e4e7'}`,
                    background: active ? '#111827' : '#fff',
                    color: active ? '#fff' : '#18181b',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>{option.label}</div>
                  <div style={{ fontSize: 11.5, color: active ? 'rgba(255,255,255,0.74)' : '#71717a', lineHeight: 1.45 }}>
                    {option.note}
                  </div>
                </button>
              )
            })}
          </div>

          <SectionLabel>Rounds</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { value: 1 as const, label: '1 Round', note: 'Single-pass debate' },
              { value: 2 as const, label: '2 Rounds', note: 'Adds cross-examination when needed' },
            ]).map((option) => {
              const active = rounds === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onRoundsChange(option.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: `1px solid ${active ? '#111827' : '#e4e4e7'}`,
                    background: active ? '#f5f5f6' : '#fff',
                    color: '#18181b',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>{option.label}</div>
                  <div style={{ fontSize: 11.5, color: '#71717a', lineHeight: 1.45 }}>{option.note}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{
          background: '#fff',
          border: '1px solid #ebebed',
          borderRadius: 14,
          padding: '15px 16px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <SectionLabel>Your Debate Team</SectionLabel>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: enabledCount >= 2 ? '#71717a' : '#dc2626',
            }}>
              {enabledCount} active
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onOpen={() => setEditingId(agent.id)}
                onToggle={() => toggleAgent(agent.id)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={onAddAgent}
              style={{
                flex: 1,
                border: '1px dashed #c7c7cf',
                background: '#fafafa',
                color: '#3f3f46',
                borderRadius: 12,
                padding: '11px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Add Custom Agent
            </button>
          </div>

          {enabledCount < 2 && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626', lineHeight: 1.55 }}>
              Keep at least two active agents so the debate has meaningful disagreement.
            </div>
          )}
        </div>

        {error && (
          <div style={{
            marginBottom: 16,
            borderRadius: 12,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            padding: '11px 13px',
            fontSize: 12.5,
            lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={startDisabled}
          onClick={onStart}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 12,
            padding: '13px 16px',
            background: startDisabled ? '#d6d6db' : '#111827',
            color: '#fff',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: startDisabled ? 'default' : 'pointer',
            transition: 'background 150ms',
            boxShadow: startDisabled ? 'none' : '0 8px 22px rgba(17,24,39,0.16)',
          }}
        >
          {busy ? 'Preparing paper library...' : 'Start Review'}
        </button>
      </div>

      {editingAgent && (
        <AgentDetailModal
          agent={editingAgent}
          onClose={() => setEditingId(null)}
          onSave={updateAgent}
          onDelete={deleteAgent}
        />
      )}
    </>
  )
}
