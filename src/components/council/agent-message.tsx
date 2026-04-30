'use client'

import { useState } from 'react'
import { Agent, AgentMessage as AgentMessageType, SourceRef } from '@/types/council'
import { AgentAvatar } from './agent-avatar'
import { ThinkingBlock } from './thinking-block'
import { ToolCard } from './tool-card'
import { EvidenceAnnotatedMarkdown } from './evidence-annotated-markdown'

const TEXT_COLLAPSE_THRESHOLD = 900

interface AgentMessageProps {
  message: AgentMessageType
  agent: Agent
  sourceRefs?: SourceRef[]
  onSourceClick?: (label: string) => void
}

function splitEvidence(content: string): { main: string; evidenceText: string | null } {
  const idx = content.lastIndexOf('\n\n**Evidence**')
  if (idx === -1) {
    const alt = content.indexOf('**Evidence**')
    if (alt === -1 || alt > 20) return { main: content, evidenceText: null }
    const match = content.match(/\*\*Evidence\*\*\s*[-]?\s*(.+)$/m)
    return match
      ? { main: content.slice(0, content.indexOf('**Evidence**')).trim(), evidenceText: match[1].trim() }
      : { main: content, evidenceText: null }
  }
  const after = content.slice(idx + '\n\n**Evidence**'.length)
  const match = after.match(/^\s*[-]?\s*(.+?)$/m)
  return { main: content.slice(0, idx).trim(), evidenceText: match ? match[1].trim() : null }
}

function parseEvidenceItems(text: string): string[] {
  return text.split(/[,\n]+/).map((item) => item.trim()).filter((item) => item.length > 2)
}

function findRef(refs: SourceRef[], item: string): SourceRef | null {
  const lower = item.toLowerCase()
  return refs.find((ref) =>
    ref.label.toLowerCase() === lower ||
    ref.uri?.toLowerCase() === lower ||
    (ref.uri && lower.includes(ref.uri.toLowerCase())) ||
    ref.label.toLowerCase().includes(lower.slice(0, 40))
  ) ?? null
}

function EvidenceSection({
  text,
  agent,
  sourceRefs,
  onSourceClick,
}: {
  text: string
  agent: Agent
  sourceRefs: SourceRef[]
  onSourceClick?: (label: string) => void
}) {
  const items = parseEvidenceItems(text)
  if (!items.length) return null

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: '1px solid #ececf1',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginRight: 2 }}>
        Evidence
      </span>
      {items.map((item, index) => {
        const isUrl = item.startsWith('http')
        const ref = findRef(sourceRefs, item)
        const display = isUrl
          ? item.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 45)
          : item.slice(0, 55)

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
            key={index}
            onClick={handleClick}
            title={item}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 9px',
              border: `1px solid ${agent.color}33`,
              borderRadius: 999,
              background: `${agent.color}07`,
              color: '#52525b',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'all 100ms',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = `${agent.color}15`
              event.currentTarget.style.borderColor = `${agent.color}66`
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = `${agent.color}07`
              event.currentTarget.style.borderColor = `${agent.color}33`
            }}
          >
            {display}
            {(isUrl || ref?.uri) && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}

function CollapsibleText({
  content,
  agentColor,
  isStreaming,
  sourceRefs,
}: {
  content: string
  agentColor: string
  isStreaming: boolean
  sourceRefs: SourceRef[]
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = content.length > TEXT_COLLAPSE_THRESHOLD
  const visible = isLong && !expanded ? content.slice(0, TEXT_COLLAPSE_THRESHOLD) : content
  const preview = visible
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s*/gm, '- ')

  return (
    <div>
      <div style={{ fontSize: 14, color: '#3f3f46', lineHeight: 1.75 }}>
        {isLong && !expanded ? preview : (
          <EvidenceAnnotatedMarkdown content={visible} sourceRefs={sourceRefs} />
        )}
        {isLong && !expanded && '...'}
        {isStreaming && !isLong && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: 14,
              background: agentColor,
              marginLeft: 2,
              animation: 'cur-blink 0.8s infinite',
              verticalAlign: 'text-bottom',
              borderRadius: 1,
            }}
          />
        )}
      </div>
      {isLong && !isStreaming && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 6,
            background: 'none',
            border: '1px solid #e4e4e7',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: '#71717a',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {expanded ? 'Collapse' : `Show full (${Math.round(content.length / 100) * 100}+ chars)`}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
          </svg>
        </button>
      )}
    </div>
  )
}

export function AgentMessage({ message, agent, sourceRefs = [], onSourceClick }: AgentMessageProps) {
  const isStreaming = !message.isComplete
  const roundLabel = message.round === 99 ? 'Synthesis' : `Round ${message.round ?? 1}`
  const hasTextBlock = message.blocks.some((block) => block.type === 'text' && block.content.trim().length > 0)
  const hasRunningTool = message.blocks.some((block) => block.type === 'tool_use' && block.tool.status === 'running')

  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(message.timestamp)

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', animation: 'msg-fadein 220ms ease both' }}>
      <div style={{ paddingTop: 4 }}>
        <AgentAvatar agent={agent} size="sm" showPulse={isStreaming} />
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: `linear-gradient(180deg, ${agent.color}08 0%, #ffffff 60%)`,
          borderTop: '1px solid #ececf1',
          borderRight: '1px solid #ececf1',
          borderBottom: '1px solid #ececf1',
          borderLeft: `2px solid ${agent.color}`,
          borderRadius: '0 12px 12px 0',
          padding: '14px 18px',
          boxShadow: isStreaming ? `0 2px 8px ${agent.color}14` : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{agent.name}</span>
              <span style={{ fontSize: 11, color: '#71717a' }}>{agent.role}</span>
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase' }}>
            {roundLabel}
          </span>
          <span style={{ fontSize: 11, color: '#a1a1aa', fontVariantNumeric: 'tabular-nums' }}>{time}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {message.blocks.map((block, index) => {
            if (block.type === 'thinking') {
              return <ThinkingBlock key={index} content={block.content} isStreaming={block.isStreaming} agentColor={agent.color} />
            }
            if (block.type === 'tool_use') {
              return <ToolCard key={index} tool={block.tool} agentColor={agent.color} />
            }
            if (block.type === 'text') {
              const { main, evidenceText } = splitEvidence(block.content)
              return (
                <div key={index}>
                  <CollapsibleText
                    content={main}
                    agentColor={agent.color}
                    isStreaming={block.isStreaming === true && !evidenceText}
                    sourceRefs={sourceRefs}
                  />
                  {evidenceText && (
                    <EvidenceSection text={evidenceText} agent={agent} sourceRefs={sourceRefs} onSourceClick={onSourceClick} />
                  )}
                </div>
              )
            }
            return null
          })}
          {!hasTextBlock && hasRunningTool && (
            <div
              style={{
                fontSize: 13,
                color: '#71717a',
                lineHeight: 1.7,
                fontStyle: 'italic',
              }}
            >
              Gathering evidence...
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes msg-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes cur-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
