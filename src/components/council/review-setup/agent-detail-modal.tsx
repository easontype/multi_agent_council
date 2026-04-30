'use client'

import { useEffect, useState } from 'react'
import type { EditableReviewAgent } from '@/lib/prompts/review-presets'
import { FieldLabel, fieldStyle } from './shared'

export function AgentDetailModal({
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
      model: draft.model.trim() || 'gemini-3.1-flash-lite-preview',
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
          background: '#fcfcfb',
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
          background: 'rgba(255,255,255,0.92)',
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
                  fontSize: 13,
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
                fontSize: 13,
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
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 8px 22px rgba(17,24,39,0.16)',
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
