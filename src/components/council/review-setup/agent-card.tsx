'use client'

import type { EditableReviewAgent } from '@/lib/prompts/review-presets'
import { HoverHint } from '@/components/ui/hover-hint'
import { colorAlpha } from './shared'

export function AgentCard({
  agent,
  onOpen,
  onToggle,
}: {
  agent: EditableReviewAgent
  onOpen: () => void
  onToggle: () => void
}) {
  const summary = agent.description.trim()

  return (
    <div style={{
      position: 'relative',
      borderRadius: 14,
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
          padding: '14px 15px 12px',
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: agent.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11.5,
            fontWeight: 700,
            boxShadow: `0 6px 16px ${colorAlpha(agent.color, '2c')}`,
          }}>
            {agent.avatar}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#111827', lineHeight: 1.25, marginBottom: 2 }}>
                  {agent.name}
                </div>
                <div style={{ fontSize: 11.5, color: '#71717a', lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {agent.seatRole}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {agent.isCustom && (
                  <span style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#3730a3',
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    borderRadius: 999,
                    padding: '3px 6px',
                  }}>
                    Custom
                  </span>
                )}
                <span style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: agent.enabled ? '#111827' : '#9ca3af',
                }}>
                  {agent.enabled ? 'Active' : 'Off'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 8px',
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
            </div>

            <div style={{
              fontSize: 12,
              color: '#71717a',
              lineHeight: 1.55,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {summary}
            </div>
          </div>
        </div>
      </button>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '0 15px 14px',
        borderTop: '1px solid #ececf1',
      }}>
        <HoverHint content={summary}>
          <span style={{
            fontSize: 11.5,
            color: '#71717a',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 300,
          }}>
            Hover to preview review angle
          </span>
        </HoverHint>
        <button
          type="button"
          onClick={onToggle}
          style={{
            border: '1px solid #e4e4e7',
            background: agent.enabled ? '#fafafa' : '#fff',
            color: agent.enabled ? '#111827' : '#9ca3af',
            borderRadius: 999,
            padding: '7px 11px',
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {agent.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  )
}
