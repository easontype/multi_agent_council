'use client'

import { useState } from 'react'
import { DiscussionSession, AgentMessage, Agent, SourceRef } from '@/types/council'
import { AgentAvatar } from './agent-avatar'

const ROUND1_DIMS = ['Position', 'Key Assumptions', 'Main Risks', 'Strongest Counterargument', 'Evidence']
const ROUND2_DIMS = ['Rebuttal', 'Response to Round 2', 'Position Update', 'Remaining Disagreement', 'Evidence']

function parseSections(text: string): Map<string, string> {
  const sections = new Map<string, string>()
  const chunks = text.split(/\n\n(?=\*\*[A-Z])/)
  for (const chunk of chunks) {
    const m = chunk.match(/^\*\*([^*\n]+)\*\*\s*[—\-]?\s*([\s\S]*)$/)
    if (m) sections.set(m[1].trim(), m[2].trim())
  }
  return sections
}

function getMessageText(msg: AgentMessage): string {
  return msg.blocks
    .filter(b => b.type === 'text')
    .map(b => b.type === 'text' ? b.content : '')
    .join('\n\n')
}

function parseEvidenceItems(text: string): string[] {
  return text.split(/[,\n]+/).map(s => s.trim()).filter(s => s.length > 2)
}

function findRef(sourceRefs: SourceRef[], item: string): SourceRef | null {
  const lower = item.toLowerCase()
  return sourceRefs.find(r =>
    r.label.toLowerCase() === lower ||
    r.uri?.toLowerCase() === lower ||
    (r.uri && lower.includes(r.uri.toLowerCase())) ||
    r.label.toLowerCase().includes(lower.slice(0, 40))
  ) ?? null
}

function EvidenceChip({
  item,
  agentColor,
  sourceRefs,
  onSourceClick,
}: {
  item: string
  agentColor: string
  sourceRefs: SourceRef[]
  onSourceClick?: (label: string) => void
}) {
  const isUrl = item.startsWith('http')
  const ref = findRef(sourceRefs, item)
  const display = isUrl
    ? item.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 40)
    : item.slice(0, 50)

  const handleClick = () => {
    if (ref) {
      onSourceClick?.(ref.label)
    } else if (isUrl) {
      window.open(item, '_blank', 'noopener')
    } else {
      onSourceClick?.(item)
    }
  }

  return (
    <button
      onClick={handleClick}
      title={item}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 7px',
        border: `1px solid ${agentColor}33`,
        borderRadius: 4,
        background: `${agentColor}08`,
        color: '#555',
        fontSize: 11,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 100ms',
        textDecoration: 'underline',
        textDecorationColor: `${agentColor}55`,
        textDecorationThickness: '1px',
        textUnderlineOffset: '2px',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `${agentColor}18`
        e.currentTarget.style.borderColor = `${agentColor}66`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = `${agentColor}08`
        e.currentTarget.style.borderColor = `${agentColor}33`
      }}
    >
      {display}
      {(isUrl || ref?.uri) && (
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      )}
    </button>
  )
}

function DimensionRow({
  dimension,
  agents,
  agentMessages,
  agentSourceRefs,
  onSourceClick,
  defaultOpen,
}: {
  dimension: string
  agents: Agent[]
  agentMessages: Map<string, Map<string, string>>
  agentSourceRefs: Map<string, SourceRef[]>
  onSourceClick?: (label: string) => void
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isEvidence = dimension === 'Evidence'

  const hasContent = agents.some(a => {
    const sections = agentMessages.get(a.id)
    const text = sections?.get(dimension) ?? ''
    return text.length > 0
  })

  return (
    <div style={{ borderBottom: '1px solid #f0f0f2' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px',
          background: open ? '#fafafa' : '#fff',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          transition: 'background 100ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f7' }}
        onMouseLeave={e => { e.currentTarget.style.background = open ? '#fafafa' : '#fff' }}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="#bbb" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms', flexShrink: 0 }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#999', textTransform: 'uppercase' }}>
          {dimension}
        </span>
        {!hasContent && (
          <span style={{ fontSize: 10, color: '#ddd', marginLeft: 4 }}>no data</span>
        )}
      </button>

      {open && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${agents.length}, minmax(0, 1fr))`,
          borderTop: '1px solid #f5f5f7',
        }}>
          {agents.map((agent, idx) => {
            const sections = agentMessages.get(agent.id)
            const cellText = sections?.get(dimension) ?? ''
            const sourceRefs = agentSourceRefs.get(agent.id) ?? []
            const items = isEvidence && cellText ? parseEvidenceItems(cellText) : []

            return (
              <div
                key={agent.id}
                style={{
                  padding: '14px 16px',
                  borderRight: idx < agents.length - 1 ? '1px solid #f0f0f2' : 'none',
                  minHeight: 60,
                }}
              >
                {isEvidence ? (
                  items.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {items.map((item, i) => (
                        <EvidenceChip
                          key={i}
                          item={item}
                          agentColor={agent.color}
                          sourceRefs={sourceRefs}
                          onSourceClick={onSourceClick}
                        />
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: '#ddd' }}>—</span>
                  )
                ) : cellText ? (
                  <p style={{
                    margin: 0, fontSize: 12.5, color: '#444',
                    lineHeight: 1.65, whiteSpace: 'pre-wrap',
                  }}>
                    {cellText}
                  </p>
                ) : (
                  <span style={{ fontSize: 12, color: '#ddd' }}>—</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface CompareViewProps {
  session: DiscussionSession
  onSourceClick?: (label: string) => void
}

export function CompareView({ session, onSourceClick }: CompareViewProps) {
  const [activeRound, setActiveRound] = useState(1)

  const nonModeratorAgents = session.agents.filter(a => a.seatRole !== 'Moderator')
  const hasRound2 = session.messages.some(m => m.round === 2 && m.isComplete)
  const dimensions = activeRound === 1 ? ROUND1_DIMS : ROUND2_DIMS

  // Build: agentId → Map<dimensionName, text>
  const agentMessages = new Map<string, Map<string, string>>()
  for (const agent of nonModeratorAgents) {
    const msg = session.messages.find(m => m.round === activeRound && m.agentId === agent.id && m.isComplete)
    if (msg) {
      agentMessages.set(agent.id, parseSections(getMessageText(msg)))
    }
  }

  // Build: agentId → SourceRef[]
  const agentSourceRefs = new Map<string, SourceRef[]>()
  for (const agent of nonModeratorAgents) {
    agentSourceRefs.set(agent.id, session.sourceRefs.filter(r => r.agentId === agent.id))
  }

  const hasMessages = session.messages.some(m => m.round === activeRound && m.isComplete)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Agent header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${nonModeratorAgents.length}, minmax(0, 1fr))`,
        borderBottom: '1px solid #ebebed',
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        {nonModeratorAgents.map((agent, idx) => (
          <div
            key={agent.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 16px',
              borderRight: idx < nonModeratorAgents.length - 1 ? '1px solid #f0f0f2' : 'none',
            }}
          >
            <AgentAvatar agent={agent} size="sm" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {agent.name}
              </div>
              <div style={{ fontSize: 10, color: '#bbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {agent.role}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Round tabs (only if round 2 exists) */}
      {hasRound2 && (
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid #f0f0f2',
          background: '#fff', padding: '0 20px', flexShrink: 0,
        }}>
          {[1, 2].map(r => (
            <button
              key={r}
              onClick={() => setActiveRound(r)}
              style={{
                border: 'none', borderBottom: `2px solid ${activeRound === r ? '#111827' : 'transparent'}`,
                background: 'transparent',
                color: activeRound === r ? '#111827' : '#9ca3af',
                padding: '10px 14px 8px',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              Round {r}
            </button>
          ))}
        </div>
      )}

      {/* Dimension rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!hasMessages ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ccc', fontSize: 13, padding: 40, textAlign: 'center',
          }}>
            Round {activeRound} messages will appear here once the debate completes.
          </div>
        ) : (
          dimensions.map((dim, i) => (
            <DimensionRow
              key={dim}
              dimension={dim}
              agents={nonModeratorAgents}
              agentMessages={agentMessages}
              agentSourceRefs={agentSourceRefs}
              onSourceClick={onSourceClick}
              defaultOpen={i === 0}
            />
          ))
        )}
      </div>
    </div>
  )
}
