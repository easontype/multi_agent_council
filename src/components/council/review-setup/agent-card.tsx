'use client'

import type { EditableReviewAgent } from '@/lib/review-presets'
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
                  color: '#3730a3',
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
                fontSize: 11,
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
          background: '#f8f8fa',
          borderRadius: 12,
          padding: '12px 12px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 7 }}>
            Review Angle
          </div>
          <div style={{ fontSize: 13, color: '#52525b', lineHeight: 1.72, minHeight: 44 }}>
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
        borderTop: '1px solid #ececf1',
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
            fontSize: 12,
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
            fontSize: 12,
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
