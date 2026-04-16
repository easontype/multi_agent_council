'use client'

import { useRef, useEffect } from 'react'
import { DiscussionSession, AGENTS } from '@/types/council'
import { AgentMessage } from './agent-message'
import { AgentAvatar } from './agent-avatar'

interface DiscussionTimelineProps {
  session: DiscussionSession
}

function PaperHeader({ title, abstract }: { title: string; abstract?: string }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #f8f9fa 0%, #fff 100%)',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        Paper Under Review
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.4, marginBottom: abstract ? 12 : 0 }}>
        {title}
      </h2>
      {abstract && (
        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, margin: 0 }}>
          {abstract.length > 300 ? abstract.slice(0, 300) + '...' : abstract}
        </p>
      )}
    </div>
  )
}

function AgentRoster({ activeAgentId }: { activeAgentId?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '12px 16px',
        background: '#f8f9fa',
        borderRadius: 10,
        marginBottom: 20,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 12, color: '#888', fontWeight: 500, marginRight: 4 }}>
        Review Panel:
      </span>
      {AGENTS.map((agent) => (
        <div
          key={agent.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px 4px 4px',
            background: activeAgentId === agent.id ? '#fff' : 'transparent',
            border: activeAgentId === agent.id ? '1px solid #e5e5e5' : '1px solid transparent',
            borderRadius: 20,
            transition: 'all 150ms',
          }}
        >
          <AgentAvatar agent={agent} size="sm" showPulse={activeAgentId === agent.id} />
          <span style={{ fontSize: 12, color: activeAgentId === agent.id ? agent.color : '#666', fontWeight: 500 }}>
            {agent.name.split(' ')[1]}
          </span>
        </div>
      ))}
    </div>
  )
}

function WaitingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '16px 0',
        color: '#888',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>
      <span style={{ fontSize: 14, fontStyle: 'italic' }}>
        Waiting for reviewers to begin discussion...
      </span>
    </div>
  )
}

function ConclusionBadge() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: 10,
        marginTop: 20,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>
        Discussion concluded
      </span>
    </div>
  )
}

export function DiscussionTimeline({ session }: DiscussionTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 获取当前正在发言的 Agent
  const activeMessage = session.messages.find((m) => !m.isComplete)
  const activeAgentId = activeMessage?.agentId

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [session.messages])

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 32px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Paper info */}
        <PaperHeader title={session.paperTitle} abstract={session.paperAbstract} />

        {/* Agent roster */}
        <AgentRoster activeAgentId={activeAgentId} />

        {/* Messages */}
        {session.status === 'waiting' && session.messages.length === 0 && (
          <WaitingIndicator />
        )}

        {session.messages.map((message) => (
          <AgentMessage key={message.id} message={message} />
        ))}

        {/* Conclusion */}
        {session.status === 'concluded' && <ConclusionBadge />}
      </div>
    </div>
  )
}
