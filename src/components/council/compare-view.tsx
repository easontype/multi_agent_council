'use client'

import { useMemo, useState } from 'react'
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

function refKey(ref: SourceRef): string[] {
  const keys: string[] = [ref.label.toLowerCase().trim()]
  if (ref.uri) keys.push(ref.uri.toLowerCase().trim())
  return keys
}

function buildSharedKeys(agentSourceRefs: Map<string, SourceRef[]>, agentIds: string[]): Set<string> {
  if (agentIds.length !== 2) return new Set()
  const [idA, idB] = agentIds
  const keysA = new Set((agentSourceRefs.get(idA) ?? []).flatMap(refKey))
  const shared = new Set<string>()
  for (const ref of (agentSourceRefs.get(idB) ?? [])) {
    for (const k of refKey(ref)) {
      if (keysA.has(k)) shared.add(k)
    }
  }
  return shared
}

function isItemShared(item: string, sourceRefs: SourceRef[], sharedKeys: Set<string>): boolean {
  if (!sharedKeys.size) return false
  const ref = findRef(sourceRefs, item)
  if (ref && refKey(ref).some((k) => sharedKeys.has(k))) return true
  return sharedKeys.has(item.toLowerCase().trim())
}

function EvidenceChip({
  item,
  agentColor,
  sourceRefs,
  isShared,
  onSourceClick,
}: {
  item: string
  agentColor: string
  sourceRefs: SourceRef[]
  isShared: boolean
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
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
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
      {isShared && (
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: '#92400e',
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: 3,
          padding: '1px 4px',
          flexShrink: 0,
          textTransform: 'uppercase',
        }}>
          shared
        </span>
      )}
    </div>
  )
}

function DimensionRow({
  dimension,
  agents,
  agentMessages,
  agentSourceRefs,
  sharedKeys,
  onSourceClick,
  defaultOpen,
}: {
  dimension: DimensionConfig
  agents: Agent[]
  agentMessages: Map<string, Map<string, string>>
  agentSourceRefs: Map<string, SourceRef[]>
  sharedKeys: Set<string>
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
                          isShared={isItemShared(item, sourceRefs, sharedKeys)}
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
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])

  const nonModeratorAgents = session.agents.filter((agent) => agent.seatRole !== 'Moderator')
  const hasRound2 = session.messages.some((message) => message.round === 2 && message.isComplete)
  const needsSelector = nonModeratorAgents.length > 2

  // When >2 agents and exactly 2 selected, compare those two; else show all
  const displayedAgents = useMemo(() => {
    if (needsSelector && selectedAgentIds.length === 2) {
      return nonModeratorAgents.filter((a) => selectedAgentIds.includes(a.id))
    }
    return nonModeratorAgents
  }, [needsSelector, selectedAgentIds, nonModeratorAgents])

  const dimensions = activeRound === 1 ? ROUND1_DIMS : ROUND2_DIMS

  const agentMessages = useMemo(() => {
    const map = new Map<string, Map<string, string>>()
    for (const agent of displayedAgents) {
      const message = session.messages.find((item) => item.round === activeRound && item.agentId === agent.id && item.isComplete)
      if (message) map.set(agent.id, parseSections(getMessageText(message)))
    }
    return map
  }, [displayedAgents, activeRound, session.messages])

  const agentSourceRefs = useMemo(() => {
    const map = new Map<string, SourceRef[]>()
    for (const agent of displayedAgents) {
      map.set(agent.id, session.sourceRefs.filter((ref) => ref.agentId === agent.id && ref.round === activeRound))
    }
    return map
  }, [displayedAgents, activeRound, session.sourceRefs])

  const sharedKeys = useMemo(
    () => buildSharedKeys(agentSourceRefs, displayedAgents.map((a) => a.id)),
    [agentSourceRefs, displayedAgents],
  )

  const hasMessages = session.messages.some((message) => message.round === activeRound && message.isComplete)

  function toggleAgentSelect(agentId: string) {
    setSelectedAgentIds((prev) => {
      if (prev.includes(agentId)) return prev.filter((id) => id !== agentId)
      if (prev.length >= 2) return [prev[1]!, agentId]
      return [...prev, agentId]
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Agent selector — shown only when >2 agents */}
      {needsSelector && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid #ebebed',
          background: '#fafaf9',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: '#a1a1aa', textTransform: 'uppercase', flexShrink: 0 }}>
            Compare
          </span>
          {nonModeratorAgents.map((agent) => {
            const selected = selectedAgentIds.includes(agent.id)
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => toggleAgentSelect(agent.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 9px 4px 5px',
                  borderRadius: 999,
                  border: `1.5px solid ${selected ? agent.color : '#e4e4e7'}`,
                  background: selected ? `${agent.color}14` : '#fff',
                  color: selected ? '#18181b' : '#71717a',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 100ms',
                }}
              >
                <AgentAvatar agent={agent} size="sm" />
                {agent.name}
              </button>
            )
          })}
          {selectedAgentIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedAgentIds([])}
              style={{ fontSize: 10, color: '#a1a1aa', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
            >
              Reset
            </button>
          )}
          {selectedAgentIds.length === 1 && (
            <span style={{ fontSize: 10, color: '#a1a1aa', fontStyle: 'italic' }}>Pick one more agent</span>
          )}
          {sharedKeys.size > 0 && (
            <span style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
              {sharedKeys.size} shared source{sharedKeys.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Agent header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${displayedAgents.length}, minmax(0, 1fr))`,
        borderBottom: '1px solid #ebebed',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        {displayedAgents.map((agent, index) => (
          <div
            key={agent.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 16px',
              borderRight: index < displayedAgents.length - 1 ? '1px solid #ececf1' : 'none',
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

      {/* Round toggle */}
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

      {/* Dimension rows */}
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
              agents={displayedAgents}
              agentMessages={agentMessages}
              agentSourceRefs={agentSourceRefs}
              sharedKeys={sharedKeys}
              onSourceClick={onSourceClick}
              defaultOpen={index === 0}
            />
          ))
        )}
      </div>
    </div>
  )
}
