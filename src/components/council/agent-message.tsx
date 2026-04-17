'use client'

import { AgentMessage as AgentMessageType, AGENTS } from '@/types/council'
import { AgentAvatar } from './agent-avatar'
import { ThinkingBlock } from './thinking-block'
import { ToolCard } from './tool-card'

interface AgentMessageProps {
  message: AgentMessageType
}

export function AgentMessage({ message }: AgentMessageProps) {
  const agent = AGENTS.find(a => a.id === message.agentId)
  if (!agent) return null

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
              return (
                <div key={index} style={{
                  fontSize: 13.5, color: '#333',
                  lineHeight: 1.75, whiteSpace: 'pre-wrap',
                }}>
                  {block.content}
                  {block.isStreaming && (
                    <span style={{
                      display: 'inline-block', width: 2, height: 14,
                      background: agent.color, marginLeft: 2,
                      animation: 'cur-blink 0.8s infinite',
                      verticalAlign: 'text-bottom', borderRadius: 1,
                    }} />
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
