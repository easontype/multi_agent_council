'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Agent, DiscussionSession } from '@/types/council'
import { AgentMessage } from './agent-message'
import { CompareView } from './compare-view'
import { DebateMap } from './debate-map'

interface DiscussionTimelineProps {
  session: DiscussionSession
  onSourceClick?: (label: string) => void
  onLocateInDocument?: (docId: string, chunkIndex: number) => void
}

function RosterAvatar({ agent, active }: { agent: Agent; active: boolean }) {
  return (
    <span
      title={agent.name}
      style={{
        width: 24,
        height: 24,
        borderRadius: '999px',
        border: `2px solid ${active ? agent.color : '#fff'}`,
        background: agent.color,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        marginLeft: '-6px',
        boxShadow: active ? `0 0 0 2px ${agent.color}22` : 'none',
        position: 'relative',
        zIndex: active ? 2 : 1,
      }}
    >
      {agent.avatar}
    </span>
  )
}

const ROSTER_ROLE_PHRASES: Record<string, string[]> = {
  'Methods Critic': ['scrutinising methodology', 'reviewing statistical approach', 'examining experimental design'],
  'Literature Auditor': ['cross-referencing literature', 'verifying citations', 'tracing research lineage'],
  'Replication Skeptic': ['assessing reproducibility', 'questioning sample characteristics', 'probing confounds'],
  'Contribution Evaluator': ['gauging novelty', 'comparing with prior work', 'assessing impact'],
  'Constructive Advocate': ['building case for acceptance', 'identifying strengths', 'recognising impact'],
  'Moderator': ['synthesising positions', 'drafting verdict', 'weighing arguments'],
}

function getRosterPhrase(agentName: string, tick: number): string {
  const key = Object.keys(ROSTER_ROLE_PHRASES).find((k) => agentName.toLowerCase().includes(k.toLowerCase()))
  const phrases = key ? ROSTER_ROLE_PHRASES[key] : ['formulating response', 'reviewing evidence', 'preparing critique']
  return phrases[tick % phrases.length]
}

function AgentRoster({ agents, activeAgentId }: { agents: Agent[]; activeAgentId?: string }) {
  const activeAgent = agents.find((agent) => agent.id === activeAgentId)
  const [phraseTick, setPhraseTick] = useState(0)

  useEffect(() => {
    if (!activeAgent) return
    setPhraseTick(0)
    const timer = setInterval(() => setPhraseTick((t) => t + 1), 2800)
    return () => clearInterval(timer)
  }, [activeAgent?.id])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '10px 20px',
        borderBottom: '1px solid #ececf1',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase' }}>
          Panel
        </span>
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
          {agents.map((agent) => (
            <RosterAvatar key={agent.id} agent={agent} active={activeAgentId === agent.id} />
          ))}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#18181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agents.map((agent) => agent.name).join(' · ')}
          </div>
          <div style={{ fontSize: 11, color: '#71717a' }}>
            {agents.length} seats in debate
          </div>
        </div>
      </div>

      {activeAgent && (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: '999px',
              border: `1px solid ${activeAgent.color}33`,
              background: `${activeAgent.color}08`,
              color: activeAgent.color,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '999px',
                background: '#16a34a',
                animation: 'timeline-pulse 1.2s ease-in-out infinite',
              }}
            />
            {activeAgent.name}
          </span>
          <span
            key={phraseTick}
            style={{
              fontSize: 10,
              color: '#a1a1aa',
              fontStyle: 'italic',
              animation: 'roster-phrase-in 350ms ease both',
            }}
          >
            {getRosterPhrase(activeAgent.name, phraseTick)}…
          </span>
        </div>
      )}
    </div>
  )
}

function RoundDivider({ round }: { round: number | string }) {
  const numeral = typeof round === 'number' ? String(round) : round
  const label = typeof round === 'number' ? 'Round' : 'Synthesis'

  return (
    <div style={{ padding: '28px 0 18px', display: 'flex', alignItems: 'flex-end', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#a1a1aa', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span
          style={{
            fontSize: typeof round === 'string' ? 24 : 32,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            color: '#d4d4d8',
            fontFamily: "'Georgia', 'Times New Roman', serif",
          }}
        >
          {numeral}
        </span>
      </div>
      <div style={{ flex: 1, height: 1, background: '#ececf1' }} />
    </div>
  )
}

function groupByRound(messages: import('@/types/council').AgentMessage[]) {
  const map = new Map<number, import('@/types/council').AgentMessage[]>()
  for (const message of messages) {
    const round = message.round ?? 1
    if (!map.has(round)) map.set(round, [])
    map.get(round)!.push(message)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, roundMessages]) => ({ round, messages: roundMessages }))
}

function BetweenTurnStatus({ agents, messages }: { agents: Agent[]; messages: import('@/types/council').AgentMessage[] }) {
  const [dotTick, setDotTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setDotTick((d) => d + 1), 500)
    return () => clearInterval(t)
  }, [])

  const lastSpeaker = messages.length > 0 ? agents.find((a) => a.id === messages[messages.length - 1].agentId) : null
  const completedIds = new Set(messages.filter((m) => m.isComplete).map((m) => m.agentId))
  const nextAgent = agents.find((a) => !completedIds.has(a.id))
  const dots = '•'.repeat((dotTick % 3) + 1)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '16px 4px 8px',
        animation: 'between-turn-in 500ms ease both',
      }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: nextAgent?.color ?? lastSpeaker?.color ?? '#a1a1aa',
              opacity: (dotTick % 3) === i ? 0.9 : 0.2,
              transition: 'opacity 200ms ease',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 12, color: '#a1a1aa', fontStyle: 'italic' }}>
        {nextAgent ? `${nextAgent.name} is preparing their response${dots}` : `Preparing next stage${dots}`}
      </span>
    </div>
  )
}

function WaitingState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        color: '#a1a1aa',
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#71717a', marginBottom: 4 }}>Ready to begin</div>
      </div>
    </div>
  )
}

function ConclusionBanner() {
  return (
    <div
      style={{
        margin: '20px 0 8px',
        padding: '14px 16px',
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: '#16a34a' }}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d', marginBottom: 2 }}>Panel discussion concluded</div>
        <div style={{ fontSize: 12, color: '#166534' }}>All reviewer seats have submitted their assessments.</div>
      </div>
    </div>
  )
}

function SessionAlerts({ alerts }: { alerts: import('@/types/council').SessionAlert[] }) {
  if (!alerts.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0 0' }}>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          style={{
            borderRadius: 16,
            border: alert.level === 'warning' ? '1px solid #facc15' : '1px solid #d6d3d1',
            background: alert.level === 'warning' ? '#fefce8' : '#fafaf9',
            padding: '10px 14px',
            color: alert.level === 'warning' ? '#854d0e' : '#44403c',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {alert.message}
        </div>
      ))}
    </div>
  )
}

export function DiscussionTimeline({ session, onSourceClick, onLocateInDocument }: DiscussionTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<'timeline' | 'compare' | 'map'>('timeline')

  const activeMessage = session.messages.find((message) => !message.isComplete)
  const activeAgentId = activeMessage?.agentId
  const visibleAgents = session.agents.filter((agent) => agent.seatRole !== 'Moderator')
  const agentMap = new Map(session.agents.map((agent) => [agent.id, agent]))
  const hasRound2 = session.messages.some((m) => m.round === 2 && m.isComplete)

  useEffect(() => {
    if (viewMode === 'timeline' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [session.messages, viewMode])

  const hasMessages = session.messages.some((message) => message.isComplete)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fcfcfb' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          borderBottom: '1px solid #ececf1',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}
      >
        {viewMode === 'timeline' ? (
          <AgentRoster agents={visibleAgents} activeAgentId={activeAgentId} />
        ) : viewMode === 'map' ? (
          <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase' }}>
              Debate Map
            </span>
            <span style={{ fontSize: 11, color: '#71717a', marginTop: 3 }}>
              Who challenged whom in Round 2.
            </span>
          </div>
        ) : (
          <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase' }}>
              Compare View
            </span>
            <span style={{ fontSize: 11, color: '#71717a', marginTop: 3 }}>
              Compare seat positions side by side.
            </span>
          </div>
        )}

        {hasMessages && (
          <div
            style={{
              display: 'flex',
              gap: 0,
              padding: '10px 16px',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'inline-flex', border: '1px solid #ebebed', borderRadius: 999, overflow: 'hidden', background: '#fff' }}>
              {(['timeline', 'compare', 'map'] as const).filter((m) => m !== 'map' || hasRound2).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '6px 11px',
                    border: 'none',
                    background: viewMode === mode ? '#111827' : 'transparent',
                    color: viewMode === mode ? '#fff' : '#71717a',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {mode === 'timeline' ? 'Timeline' : mode === 'compare' ? 'Compare' : 'Map'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {viewMode === 'map' ? (
        <DebateMap session={session} />
      ) : viewMode === 'compare' ? (
        <CompareView session={session} onSourceClick={onSourceClick} />
      ) : (
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>
          {session.status === 'waiting' && session.messages.length === 0 ? (
            <WaitingState />
          ) : (
            <>
              <SessionAlerts alerts={session.alerts ?? []} />
              {groupByRound(session.messages).map(({ round, messages }) => (
                <div key={round}>
                  <RoundDivider round={round === 99 ? 'Synthesis' : round} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {messages.map((message) => {
                      const agent = agentMap.get(message.agentId)
                      if (!agent) return null
                      const agentRefs = session.sourceRefs.filter((ref) => ref.agentId === agent.id && ref.round === message.round)
                      return (
                        <AgentMessage
                          key={message.id}
                          message={message}
                          agent={agent}
                          sourceRefs={agentRefs}
                          onSourceClick={onSourceClick}
                          onLocateInDocument={onLocateInDocument}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
              {session.status === 'discussing' && !activeMessage && session.messages.length > 0 && (
                <BetweenTurnStatus agents={visibleAgents} messages={session.messages} />
              )}
              {session.status === 'concluded' && <ConclusionBanner />}
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes timeline-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes roster-phrase-in {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes between-turn-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
