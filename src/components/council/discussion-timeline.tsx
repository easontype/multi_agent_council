'use client'

import { useRef, useEffect, useState } from 'react'
import { Agent, DiscussionSession } from '@/types/council'
import { AgentMessage } from './agent-message'
import { AgentAvatar } from './agent-avatar'
import { CompareView } from './compare-view'

interface DiscussionTimelineProps {
  session: DiscussionSession
  onSourceClick?: (label: string) => void
}

function AgentRoster({ agents, activeAgentId }: { agents: Agent[]; activeAgentId?: string }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '10px 20px',
      borderBottom: '1px solid #f0f0f2',
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      flexShrink: 0, flexWrap: 'wrap', alignItems: 'center',
      boxShadow: '0 1px 0 #f0f0f2',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
        color: '#ccc', textTransform: 'uppercase', marginRight: 6,
      }}>
        Panel
      </span>
      {agents.map(agent => {
        const isActive = activeAgentId === agent.id
        return (
          <div key={agent.id} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 8px 3px 4px',
            background: isActive ? `${agent.color}12` : 'transparent',
            border: `1px solid ${isActive ? agent.color + '33' : 'transparent'}`,
            borderRadius: 20,
            transition: 'all 200ms',
          }}>
            <AgentAvatar agent={agent} size="sm" showPulse={isActive} />
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: isActive ? agent.color : '#999',
              transition: 'color 200ms',
            }}>
              {agent.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function RoundDivider({ round }: { round: number | string }) {
  const label = typeof round === 'number' ? String(round) : round
  return (
    <div style={{ padding: '24px 0 16px', display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
        color: '#ccc', textTransform: 'uppercase',
      }}>
        {typeof round === 'string' ? '' : 'Round'}
      </span>
      <span style={{
        fontSize: typeof round === 'string' ? 18 : 36,
        fontWeight: 800, color: '#f0f0f2',
        lineHeight: 1, letterSpacing: '-0.03em',
        fontFamily: "'Georgia', serif",
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: '#f0f0f2', alignSelf: 'center' }} />
    </div>
  )
}

function groupByRound(messages: import('@/types/council').AgentMessage[]) {
  const map = new Map<number, import('@/types/council').AgentMessage[]>()
  for (const m of messages) {
    const r = m.round ?? 1
    if (!map.has(r)) map.set(r, [])
    map.get(r)!.push(m)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, messages]) => ({ round, messages }))
}

function WaitingState() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12, color: '#ccc', padding: '40px 20px',
    }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#aaa', marginBottom: 4 }}>Ready to begin</div>
        <div style={{ fontSize: 13, color: '#ccc' }}>Click Start Review to convene the panel</div>
      </div>
    </div>
  )
}

function ConclusionBanner() {
  return (
    <div style={{
      margin: '16px 0 8px',
      padding: '12px 16px',
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d', marginBottom: 2 }}>Panel discussion concluded</div>
        <div style={{ fontSize: 12, color: '#166534' }}>All 5 reviewers have submitted their assessments.</div>
      </div>
    </div>
  )
}

export function DiscussionTimeline({ session, onSourceClick }: DiscussionTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<'timeline' | 'compare'>('timeline')

  const activeMessage = session.messages.find(m => !m.isComplete)
  const activeAgentId = activeMessage?.agentId
  const visibleAgents = session.agents.filter((agent) => agent.seatRole !== 'Moderator')
  const agentMap = new Map(session.agents.map((agent) => [agent.id, agent]))

  useEffect(() => {
    if (viewMode === 'timeline' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [session.messages, viewMode])

  const hasMessages = session.messages.some(m => m.isComplete)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f2',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        {viewMode === 'timeline' ? (
          <AgentRoster agents={visibleAgents} activeAgentId={activeAgentId} />
        ) : (
          <div style={{ padding: '0 20px', height: 44, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: '#ccc', textTransform: 'uppercase' }}>
              Compare View
            </span>
          </div>
        )}

        {hasMessages && (
          <div style={{
            display: 'flex', gap: 0, padding: '0 12px',
            border: '1px solid #ebebed', borderRadius: 6,
            margin: '0 16px', overflow: 'hidden', flexShrink: 0,
          }}>
            {(['timeline', 'compare'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '5px 10px', border: 'none',
                  background: viewMode === mode ? '#111827' : 'transparent',
                  color: viewMode === mode ? '#fff' : '#9ca3af',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  textTransform: 'capitalize', transition: 'all 120ms',
                  letterSpacing: '0.02em',
                }}
              >
                {mode === 'timeline' ? 'Timeline' : 'Compare'}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'compare' ? (
        <CompareView session={session} onSourceClick={onSourceClick} />
      ) : (
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>
          {session.status === 'waiting' && session.messages.length === 0 ? (
            <WaitingState />
          ) : (
            <>
              {groupByRound(session.messages).map(({ round, messages }) => (
                <div key={round}>
                  <RoundDivider round={round === 99 ? 'Synthesis' : round} />
                  {messages.map(message => {
                    const agent = agentMap.get(message.agentId)
                    if (!agent) return null
                    const agentRefs = session.sourceRefs.filter(r => r.agentId === agent.id)
                    return (
                      <AgentMessage
                        key={message.id}
                        message={message}
                        agent={agent}
                        sourceRefs={agentRefs}
                        onSourceClick={onSourceClick}
                      />
                    )
                  })}
                </div>
              ))}
              {session.status === 'concluded' && <ConclusionBanner />}
            </>
          )}
        </div>
      )}
    </div>
  )
}
