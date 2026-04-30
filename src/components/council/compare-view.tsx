'use client'

import { useState } from 'react'
import { DiscussionSession, AgentMessage, Agent, SourceRef } from '@/types/council'
import { AgentAvatar } from './agent-avatar'
import { MarkdownContent } from './markdown-content'

interface DimensionConfig {
  label: string
  aliases: string[]
}

const ROUND1_DIMS: DimensionConfig[] = [
  { label: 'Position', aliases: ['Position'] },
  { label: 'Key Assumptions', aliases: ['Key Assumptions'] },
  { label: 'Main Risks', aliases: ['Main Risks'] },
  { label: 'Strongest Counterargument', aliases: ['Strongest Counterargument'] },
  { label: 'Evidence', aliases: ['Evidence'] },
]

const ROUND2_DIMS: DimensionConfig[] = [
  { label: 'Challenge', aliases: ['Challenge', 'Rebuttal', 'Response to Round 2'] },
  { label: 'Stance', aliases: ['Stance', 'Position Update', 'Remaining Disagreement'] },
  { label: 'Evidence', aliases: ['Evidence'] },
]

function parseSections(text: string): Map<string, string> {
  const sections = new Map<string, string>()
  const chunks = text.split(/\n\n(?=\*\*[A-Z])/)
  for (const chunk of chunks) {
    const match = chunk.match(/^\*\*([^*\n]+)\*\*\s*[-]?\s*([\s\S]*)$/)
    if (match) sections.set(match[1].trim(), match[2].trim())
  }
  return sections
}

function getMessageText(message: AgentMessage): string {
  return message.blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.type === 'text' ? block.content : '')
    .join('\n\n')
}

function parseEvidenceItems(text: string): string[] {
  return text.split(/[,\n]+/).map((value) => value.trim()).filter((value) => value.length > 2)
}

function getSectionContent(sections: Map<string, string> | undefined, aliases: string[]): string {
  if (!sections) return ''
  for (const alias of aliases) {
    const value = sections.get(alias)
    if (value) return value
  }
  return ''
}

function findRef(sourceRefs: SourceRef[], item: string): SourceRef | null {
  const lower = item.toLowerCase()
  const markerMatch = item.match(/^\[(\d+)\]/)
  if (markerMatch) {
    const marker = `[${markerMatch[1]}]`
    const byMarker = sourceRefs.find((ref) => ref.marker === marker)
    if (byMarker) return byMarker
    const byIndex = sourceRefs[Number(markerMatch[1]) - 1]
    if (byIndex) return byIndex
  }
  return sourceRefs.find((ref) =>
    ref.label.toLowerCase() === lower ||
    ref.uri?.toLowerCase() === lower ||
    (ref.uri && lower.includes(ref.uri.toLowerCase())) ||
    ref.label.toLowerCase().includes(lower.slice(0, 40))
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
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 7px',
        border: `1px solid ${agentColor}33`,
        borderRadius: 4,
        background: `${agentColor}08`,
        color: '#52525b',
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
      onMouseEnter={(event) => {
        event.currentTarget.style.background = `${agentColor}18`
        event.currentTarget.style.borderColor = `${agentColor}66`
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = `${agentColor}08`
        event.currentTarget.style.borderColor = `${agentColor}33`
      }}
    >
      {display}
      {(isUrl || ref?.uri) && (
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
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
  dimension: DimensionConfig
  agents: Agent[]
  agentMessages: Map<string, Map<string, string>>
  agentSourceRefs: Map<string, SourceRef[]>
  onSourceClick?: (label: string) => void
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isEvidence = dimension.label === 'Evidence'

  const hasContent = agents.some((agent) => {
    const sections = agentMessages.get(agent.id)
    const text = getSectionContent(sections, dimension.aliases)
    return text.length > 0
  })

  return (
    <div style={{ borderBottom: '1px solid #ececf1' }}>
      <button
        onClick={() => setOpen((value) => !value)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          background: open ? '#fafafa' : '#fff',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 100ms',
        }}
        onMouseEnter={(event) => { event.currentTarget.style.background = '#f5f5f7' }}
        onMouseLeave={(event) => { event.currentTarget.style.background = open ? '#fafafa' : '#fff' }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms', flexShrink: 0, color: '#a1a1aa' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#71717a', textTransform: 'uppercase' }}>
          {dimension.label}
        </span>
        {!hasContent && (
          <span style={{ fontSize: 10, color: '#a1a1aa', marginLeft: 4 }}>No data</span>
        )}
      </button>

      {open && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${agents.length}, minmax(0, 1fr))`,
          borderTop: '1px solid #f5f5f7',
        }}>
          {agents.map((agent, index) => {
            const sections = agentMessages.get(agent.id)
            const cellText = getSectionContent(sections, dimension.aliases)
            const sourceRefs = agentSourceRefs.get(agent.id) ?? []
            const items = isEvidence && cellText ? parseEvidenceItems(cellText) : []

            return (
              <div
                key={agent.id}
                style={{
                  padding: '14px 16px',
                  borderRight: index < agents.length - 1 ? '1px solid #ececf1' : 'none',
                  minHeight: 60,
                }}
              >
                {isEvidence ? (
                  items.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {items.map((item, itemIndex) => (
                        <EvidenceChip
                          key={itemIndex}
                          item={item}
                          agentColor={agent.color}
                          sourceRefs={sourceRefs}
                          onSourceClick={onSourceClick}
                        />
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: '#a1a1aa' }}>No data</span>
                  )
                ) : cellText ? (
                  <MarkdownContent content={cellText} fontSize={13} />
                ) : (
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>No data</span>
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

  const nonModeratorAgents = session.agents.filter((agent) => agent.seatRole !== 'Moderator')
  const hasRound2 = session.messages.some((message) => message.round === 2 && message.isComplete)
  const dimensions = activeRound === 1 ? ROUND1_DIMS : ROUND2_DIMS

  const agentMessages = new Map<string, Map<string, string>>()
  for (const agent of nonModeratorAgents) {
    const message = session.messages.find((item) => item.round === activeRound && item.agentId === agent.id && item.isComplete)
    if (message) {
      agentMessages.set(agent.id, parseSections(getMessageText(message)))
    }
  }

  const agentSourceRefs = new Map<string, SourceRef[]>()
  for (const agent of nonModeratorAgents) {
    agentSourceRefs.set(agent.id, session.sourceRefs.filter((ref) => ref.agentId === agent.id && ref.round === activeRound))
  }

  const hasMessages = session.messages.some((message) => message.round === activeRound && message.isComplete)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${nonModeratorAgents.length}, minmax(0, 1fr))`,
        borderBottom: '1px solid #ebebed',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        {nonModeratorAgents.map((agent, index) => (
          <div
            key={agent.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 16px',
              borderRight: index < nonModeratorAgents.length - 1 ? '1px solid #ececf1' : 'none',
            }}
          >
            <AgentAvatar agent={agent} size="sm" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {agent.name}
              </div>
              <div style={{ fontSize: 10, color: '#a1a1aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {agent.role}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasRound2 && (
        <div style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid #ececf1',
          background: '#fff',
          padding: '0 20px',
          flexShrink: 0,
        }}>
          {[1, 2].map((round) => (
            <button
              key={round}
              onClick={() => setActiveRound(round)}
              style={{
                border: 'none',
                borderBottom: `2px solid ${activeRound === round ? '#111827' : 'transparent'}`,
                background: 'transparent',
                color: activeRound === round ? '#111827' : '#71717a',
                padding: '10px 14px 8px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Round {round}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!hasMessages ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a1a1aa',
            fontSize: 13,
            padding: 40,
            textAlign: 'center',
          }}>
            Round {activeRound} messages will appear here once the debate completes.
          </div>
        ) : (
          dimensions.map((dimension, index) => (
            <DimensionRow
              key={dimension.label}
              dimension={dimension}
              agents={nonModeratorAgents}
              agentMessages={agentMessages}
              agentSourceRefs={agentSourceRefs}
              onSourceClick={onSourceClick}
              defaultOpen={index === 0}
            />
          ))
        )}
      </div>
    </div>
  )
}
