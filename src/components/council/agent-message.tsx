'use client'

import { Agent, AgentMessage as AgentMessageType, SourceRef } from '@/types/council'
import { AgentAvatar } from './agent-avatar'
import { ThinkingBlock } from './thinking-block'
import { ToolCard } from './tool-card'

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
    const m = content.match(/\*\*Evidence\*\*\s*[—\-]?\s*(.+)$/m)
    return m
      ? { main: content.slice(0, content.indexOf('**Evidence**')).trim(), evidenceText: m[1].trim() }
      : { main: content, evidenceText: null }
  }
  const after = content.slice(idx + '\n\n**Evidence**'.length)
  const m = after.match(/^\s*[—\-]?\s*(.+?)$/m)
  return { main: content.slice(0, idx).trim(), evidenceText: m ? m[1].trim() : null }
}

function parseEvidenceItems(text: string): string[] {
  return text.split(/[,\n]+/).map(s => s.trim()).filter(s => s.length > 2)
}

function findRef(refs: SourceRef[], item: string): SourceRef | null {
  const lower = item.toLowerCase()
  return refs.find(r =>
    r.label.toLowerCase() === lower ||
    r.uri?.toLowerCase() === lower ||
    (r.uri && lower.includes(r.uri.toLowerCase())) ||
    r.label.toLowerCase().includes(lower.slice(0, 40))
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
    <div style={{
      marginTop: 10, paddingTop: 10,
      borderTop: '1px solid #f0f0f2',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
        color: '#ccc', textTransform: 'uppercase', marginRight: 2,
      }}>
        Evidence
      </span>
      {items.map((item, i) => {
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
            key={i}
            onClick={handleClick}
            title={item}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 8px',
              border: `1px solid ${agent.color}33`,
              borderRadius: 4,
              background: `${agent.color}07`,
              color: '#555',
              fontSize: 11.5,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'underline',
              textDecorationColor: `${agent.color}55`,
              textDecorationThickness: '1px',
              textUnderlineOffset: '2px',
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'all 100ms',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${agent.color}15`
              e.currentTarget.style.borderColor = `${agent.color}66`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = `${agent.color}07`
              e.currentTarget.style.borderColor = `${agent.color}33`
            }}
          >
            {display}
            {(isUrl || ref?.uri) && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function AgentMessage({ message, agent, sourceRefs = [], onSourceClick }: AgentMessageProps) {
  const isStreaming = !message.isComplete

  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(message.timestamp)

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: '16px 0',
      borderBottom: '1px solid #f5f5f7',
      animation: 'msg-fadein 200ms ease both',
      ...(isStreaming ? {
        borderLeft: `2px solid ${agent.color}`,
        paddingLeft: 12,
        marginLeft: -14,
        background: `linear-gradient(90deg, ${agent.color}07 0%, transparent 60%)`,
        borderRadius: '0 6px 6px 0',
      } : {}),
    }}>
      <AgentAvatar agent={agent} size="md" showPulse={isStreaming} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1a1a1a' }}>
            {agent.name}
          </span>
          <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>
            {agent.role}
          </span>
          <span style={{ fontSize: 11, color: '#ccc', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
            {time}
          </span>
        </div>

        <div>
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
                  <div style={{
                    fontSize: 13.5, color: '#333',
                    lineHeight: 1.75, whiteSpace: 'pre-wrap',
                  }}>
                    {main}
                    {block.isStreaming && !evidenceText && (
                      <span style={{
                        display: 'inline-block', width: 2, height: 14,
                        background: agent.color, marginLeft: 2,
                        animation: 'cur-blink 0.8s infinite',
                        verticalAlign: 'text-bottom', borderRadius: 1,
                      }} />
                    )}
                  </div>
                  {evidenceText && (
                    <EvidenceSection
                      text={evidenceText}
                      agent={agent}
                      sourceRefs={sourceRefs}
                      onSourceClick={onSourceClick}
                    />
                  )}
                </div>
              )
            }
            return null
          })}
        </div>
      </div>

      <style>{`
        @keyframes msg-fadein { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes cur-blink { 0%,50% { opacity:1; } 51%,100% { opacity:0; } }
      `}</style>
    </div>
  )
}
