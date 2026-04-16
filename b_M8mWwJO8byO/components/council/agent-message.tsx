'use client'

import { AgentMessage as AgentMessageType, AGENTS } from '@/types/council'
import { AgentAvatar } from './agent-avatar'
import { ThinkingBlock } from './thinking-block'
import { ToolCard } from './tool-card'

interface AgentMessageProps {
  message: AgentMessageType
}

export function AgentMessage({ message }: AgentMessageProps) {
  const agent = AGENTS.find((a) => a.id === message.agentId)
  if (!agent) return null

  const isStreaming = !message.isComplete

  // 格式化时间
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(message.timestamp)

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '16px 0',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      {/* Avatar */}
      <AgentAvatar agent={agent} size="md" showPulse={isStreaming} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
            {agent.name}
          </span>
          <span style={{ fontSize: 12, color: '#888' }}>
            {agent.role}
          </span>
          <span style={{ fontSize: 11, color: '#bbb', marginLeft: 'auto' }}>
            {time}
          </span>
        </div>

        {/* Content blocks */}
        <div>
          {message.blocks.map((block, index) => {
            if (block.type === 'thinking') {
              return (
                <ThinkingBlock
                  key={index}
                  content={block.content}
                  isStreaming={block.isStreaming}
                  agentColor={agent.color}
                />
              )
            }

            if (block.type === 'tool_use') {
              return (
                <ToolCard
                  key={index}
                  tool={block.tool}
                  agentColor={agent.color}
                />
              )
            }

            if (block.type === 'text') {
              return (
                <div
                  key={index}
                  style={{
                    fontSize: 14,
                    color: '#333',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {block.content}
                  {block.isStreaming && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 2,
                        height: 16,
                        background: agent.color,
                        marginLeft: 2,
                        animation: 'blink 0.8s infinite',
                        verticalAlign: 'text-bottom',
                      }}
                    />
                  )}
                  <style jsx>{`
                    @keyframes blink {
                      0%, 50% { opacity: 1; }
                      51%, 100% { opacity: 0; }
                    }
                  `}</style>
                </div>
              )
            }

            return null
          })}
        </div>
      </div>
    </div>
  )
}
