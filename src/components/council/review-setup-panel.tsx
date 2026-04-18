'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { buildGeneratedTeamFromBrief, type EditableReviewAgent, type ReviewMode, type TeamBuilderBrief } from '@/lib/review-presets'

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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: '#a1a1aa',
      textTransform: 'uppercase',
      marginBottom: 14,
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
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '10px 11px',
        borderRadius: 12,
        border: `1px solid ${active ? '#c7d2fe' : '#e4e4e7'}`,
        background: active ? '#eef2ff' : '#fff',
        color: '#18181b',
        cursor: 'pointer',
        minHeight: 72,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: active ? '#3730a3' : '#18181b' }}>{label}</div>
      <div style={{ fontSize: 11, color: active ? '#5b67b7' : '#71717a', lineHeight: 1.55 }}>
        {note}
      </div>
    </button>
  )
}

function TeamBuilderModal({
  onClose,
  onGenerate,
}: {
  onClose: () => void
  onGenerate: (brief: TeamBuilderBrief) => void
}) {
  const [brief, setBrief] = useState<TeamBuilderBrief>({
    reviewGoal: 'submission',
    paperType: 'methods',
    stance: 'balanced',
    priority: 'methods',
    teamSize: 5,
  })

  const update = <K extends keyof TeamBuilderBrief>(key: K, value: TeamBuilderBrief[K]) => {
    setBrief((current) => ({ ...current, [key]: value }))
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
              <div style={{ fontSize: 12.5, color: '#6b7280' }}>
                Answer a few questions and generate a full reviewer team.
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
            x
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{
            marginBottom: 24,
            fontSize: 13,
            color: '#5f5f68',
            lineHeight: 1.7,
            padding: '12px 14px',
            borderRadius: 14,
            border: '1px solid #e0e7ff',
            background: '#f8faff',
          }}>
            This builder creates a whole debate team, not just one custom seat. You can still edit every generated agent afterward.
          </div>

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
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 20px 20px',
          borderTop: '1px solid #ececf1',
        }}>
          <div style={{ fontSize: 12.5, color: '#71717a', lineHeight: 1.55 }}>
            Generated teams remain fully editable after creation.
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
              onClick={() => onGenerate(brief)}
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
              Generate Team
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
          padding: '18px 18px 14px',
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 12 }}>
          <span style={{
            width: 36,
            height: 36,
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
                {agent.name}
              </span>
              {agent.isCustom && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#4f46e5',
                  background: '#eef2ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: 999,
                  padding: '4px 7px',
                  flexShrink: 0,
                }}>
                  Custom
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 999,
                background: `${agent.color}12`,
                border: `1px solid ${colorAlpha(agent.color, '35')}`,
                color: agent.color,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                {agent.focus}
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 999,
                background: '#f8f8fa',
                border: '1px solid #ececf1',
                color: '#71717a',
                fontSize: 11,
                fontWeight: 500,
                maxWidth: '100%',
              }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {agent.seatRole}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div style={{
          border: '1px solid #f0f0f2',
          background: '#fbfbfc',
          borderRadius: 12,
          padding: '12px 12px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 7 }}>
            Review Angle
          </div>
          <div style={{ fontSize: 12.5, color: '#5f5f68', lineHeight: 1.72, minHeight: 44 }}>
            {agent.description}
          </div>
        </div>
      </button>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '0 18px 18px',
        borderTop: '1px solid #f3f4f6',
      }}>
        <button
          type="button"
          onClick={onOpen}
          style={{
            border: '1px solid #e4e4e7',
            background: '#fafafa',
            color: '#52525b',
            borderRadius: 999,
            padding: '8px 12px',
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
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

  const handleGenerateTeam = (brief: TeamBuilderBrief) => {
    const generated = buildGeneratedTeamFromBrief(brief)
    onModeChange(generated.mode)
    onRoundsChange(generated.rounds)
    onAgentsChange(generated.agents)
    setBuilderOpen(false)
  }

  return (
    <>
      <div style={{ height: '100%', overflowY: 'auto', padding: '26px 20px 34px' }}>
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
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onModeChange(option.value)}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    padding: '14px 13px',
                    borderRadius: 12,
                    border: `1px solid ${active ? '#111827' : '#e4e4e7'}`,
                    background: active ? '#111827' : '#fcfcfd',
                    color: active ? '#fff' : '#18181b',
                    cursor: 'pointer',
                    minHeight: 82,
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>{option.label}</div>
                  <div style={{ fontSize: 11.5, color: active ? 'rgba(255,255,255,0.74)' : '#71717a', lineHeight: 1.55 }}>
                    {option.note}
                  </div>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setBuilderOpen(true)}
              style={{
                textAlign: 'left',
                padding: '14px 13px',
                borderRadius: 12,
                border: '1px solid #c7d2fe',
                background: '#f8faff',
                color: '#18181b',
                cursor: 'pointer',
                minHeight: 82,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: '#3730a3' }}>Build Team</div>
              <div style={{ fontSize: 11.5, color: '#6673bf', lineHeight: 1.55 }}>
                Answer a few questions and generate a full custom panel
              </div>
            </button>
          </div>

          <SectionLabel>Rounds</SectionLabel>
          <div style={{ display: 'flex', gap: 10 }}>
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
                    padding: '12px 13px',
                    borderRadius: 12,
                    border: `1px solid ${active ? '#111827' : '#e4e4e7'}`,
                    background: active ? '#f5f5f6' : '#fcfcfd',
                    color: '#18181b',
                    cursor: 'pointer',
                    textAlign: 'left',
                    minHeight: 76,
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>{option.label}</div>
                  <div style={{ fontSize: 11.5, color: '#71717a', lineHeight: 1.55 }}>{option.note}</div>
                </button>
              )
            })}
          </div>
        </div>

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
                fontSize: 12.5,
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

        {error && (
          <div style={{
            marginBottom: 18,
            borderRadius: 12,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
            padding: '12px 14px',
            fontSize: 12.5,
            lineHeight: 1.65,
          }}>
            {error}
          </div>
        )}

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
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b', whiteSpace: 'nowrap' }}>
                {costLabel}
              </span>
            </div>
          )}
        </div>
      </div>

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
