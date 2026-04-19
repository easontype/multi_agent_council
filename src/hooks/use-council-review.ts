'use client'

import { useState, useCallback } from 'react'
import { DiscussionSession, Agent, AgentMessage, ContentBlock, SourceRef, DEFAULT_AGENTS, SessionAlert } from '@/types/council'
import { takePendingUpload } from '@/lib/pending-upload'
import type { CouncilSeat } from '@/lib/council-types'

export type ReviewPhase = 'idle' | 'ingesting' | 'running' | 'concluded' | 'error'

function makeEmptySession(title = '', abstract = '', agents: Agent[] = DEFAULT_AGENTS): DiscussionSession {
  return {
    id: '',
    paperId: '',
    paperTitle: title,
    paperAbstract: abstract,
    status: 'waiting',
    agents,
    messages: [],
    sourceRefs: [],
    alerts: [],
    startedAt: new Date(),
  }
}

function findAgentByRole(agents: Agent[], role: string) {
  return agents.find((agent) => agent.seatRole === role) ?? agents.find((agent) => agent.name === role)
}

function appendAlert(existing: SessionAlert[] | undefined, next: Omit<SessionAlert, 'id'>): SessionAlert[] {
  const alerts = existing ?? []
  if (alerts.some((alert) => alert.level === next.level && alert.message === next.message)) {
    return alerts
  }
  return [...alerts, { id: `${next.level}-${alerts.length + 1}-${Date.now()}`, ...next }]
}

export function useCouncilReview(arxivIdParam?: string | null) {
  const [phase, setPhase] = useState<ReviewPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<DiscussionSession>(makeEmptySession())

  const start = useCallback(async (opts?: {
    mode?: 'critique' | 'gap'
    rounds?: 1 | 2
    customSeats?: CouncilSeat[]
    discussionAgents?: Agent[]
  }) => {
    setError(null)
    setPhase('ingesting')

    const mode = opts?.mode ?? 'critique'
    const rounds = opts?.rounds ?? 1
    const customSeats = opts?.customSeats ?? []
    const discussionAgents = opts?.discussionAgents?.length ? opts.discussionAgents : DEFAULT_AGENTS

    let sessionId: string
    let paperTitle: string
    let paperAbstract: string

    try {
      const pendingFile = takePendingUpload()

      let body: BodyInit
      let headers: Record<string, string> = {}

      if (pendingFile) {
        const form = new FormData()
        form.append('file', pendingFile)
        form.append('mode', mode)
        form.append('rounds', String(rounds))
        if (customSeats.length) {
          form.append('customSeats', JSON.stringify(customSeats))
        }
        body = form
      } else if (arxivIdParam) {
        body = JSON.stringify({ arxivId: arxivIdParam, mode, rounds, customSeats })
        headers = { 'Content-Type': 'application/json' }
      } else {
        throw new Error('No paper provided')
      }

      const res = await fetch('/api/analyze/web', { method: 'POST', body, headers })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      sessionId = data.sessionId
      paperTitle = data.paperTitle
      paperAbstract = data.paperAbstract ?? ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest paper')
      setPhase('error')
      return
    }

    setSession(makeEmptySession(paperTitle, paperAbstract, discussionAgents))
    setPhase('running')

    try {
      const res = await fetch(`/api/council/${sessionId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          let event: Record<string, unknown>
          try { event = JSON.parse(raw) } catch { continue }

          handleEvent(event, sessionId, paperTitle, paperAbstract, discussionAgents)
        }
      }

      setPhase('concluded')
      setSession((s) => ({ ...s, status: 'concluded', concludedAt: new Date() }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stream error')
      setPhase('error')
    }
  }, [arxivIdParam])

  function handleEvent(
    event: Record<string, unknown>,
    sessionId: string,
    paperTitle: string,
    paperAbstract: string,
    agents: Agent[],
  ) {
    const type = event.type as string

    if (type === 'session_start') {
      setSession(makeEmptySession(paperTitle, paperAbstract, agents))
      setSession((s) => ({ ...s, id: sessionId, paperId: sessionId, status: 'discussing', startedAt: new Date(), agents, currentRound: 1 }))
      return
    }

    if (type === 'round_start') {
      const round = (event.round as number) ?? 1
      setSession((s) => ({ ...s, currentRound: round, status: 'discussing' }))
      return
    }

    if (type === 'divergence_check') {
      const level = (event.level as DiscussionSession['divergenceLevel']) ?? null
      const proceed = event.proceed_to_round2 === true
      const summary = typeof event.summary === 'string' ? event.summary : ''
      const message = summary || (proceed ? `Divergence check: ${level ?? 'unknown'}; proceeding to Round 2.` : `Divergence check: ${level ?? 'unknown'}; Round 2 skipped.`)
      setSession((s) => ({
        ...s,
        divergenceLevel: level,
        alerts: appendAlert(s.alerts, { level: level === 'high' ? 'warning' : 'info', message }),
      }))
      return
    }

    if (type === 'round2_skipped') {
      const reason = typeof event.reason === 'string' ? event.reason : 'Round 2 was skipped.'
      setSession((s) => ({
        ...s,
        round2SkippedReason: reason,
        alerts: appendAlert(s.alerts, { level: 'info', message: reason }),
      }))
      return
    }

    if (type === 'high_divergence_warning') {
      const message = typeof event.message === 'string' ? event.message : 'High divergence detected.'
      setSession((s) => ({
        ...s,
        divergenceLevel: 'high',
        alerts: appendAlert(s.alerts, { level: 'warning', message }),
      }))
      return
    }

    if (type === 'session_done') {
      setPhase('concluded')
      setSession((s) => ({ ...s, status: 'concluded', concludedAt: new Date() }))
      return
    }

    if (type === 'turn_start') {
      const role = event.role as string
      const round = (event.round as number) ?? 1
      const agent = findAgentByRole(agents, role)
      if (!agent) return
      const msgId = `${sessionId}-r${round}-${agent.id}-${Date.now()}`

      const newMsg: AgentMessage = {
        id: msgId,
        agentId: agent.id,
        round,
        timestamp: new Date(),
        blocks: [],
        isComplete: false,
      }
      setSession((s) => ({ ...s, messages: [...s.messages, newMsg], status: 'discussing' }))
      return
    }

    if (type === 'turn_delta') {
      const role = event.role as string
      const delta = event.delta as string
      const agent = findAgentByRole(agents, role)
      if (!agent) return

      setSession((s) => {
        const messages = [...s.messages]
        const idx = messages.map((m, i) => ({ m, i })).reverse().find(({ m }) => m.agentId === agent.id && !m.isComplete)?.i
        if (idx == null) return s

        const msg = { ...messages[idx] }
        const blocks = [...msg.blocks]
        const textIdx = blocks.findLastIndex((b) => b.type === 'text')
        if (textIdx >= 0) {
          const tb = blocks[textIdx] as { type: 'text'; content: string; isStreaming?: boolean }
          blocks[textIdx] = { ...tb, content: tb.content + delta, isStreaming: true }
        } else {
          blocks.push({ type: 'text', content: delta, isStreaming: true })
        }

        messages[idx] = { ...msg, blocks }
        return { ...s, messages }
      })
      return
    }

    if (type === 'tool_call') {
      const role = event.role as string
      const tool = event.tool as string
      const args = event.args as Record<string, unknown>
      const agent = findAgentByRole(agents, role)
      if (!agent) return
      const toolId = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      setSession((s) => {
        const messages = [...s.messages]
        const idx = messages.map((m, i) => ({ m, i })).reverse().find(({ m }) => m.agentId === agent.id && !m.isComplete)?.i
        if (idx == null) return s

        const msg = { ...messages[idx] }
        const toolBlock: ContentBlock = {
          type: 'tool_use',
          tool: { id: toolId, name: tool, status: 'running', input: args },
        }
        messages[idx] = { ...msg, blocks: [...msg.blocks, toolBlock] }
        return { ...s, messages }
      })
      return
    }

    if (type === 'tool_result') {
      const role = event.role as string
      const result = event.result as string
      const sourceRefs = (event.sourceRefs as Array<{ label: string; uri: string | null; snippet: string | null }>) ?? []
      const agent = findAgentByRole(agents, role)
      if (!agent) return

      setSession((s) => {
        const messages = [...s.messages]
        const idx = messages.map((m, i) => ({ m, i })).reverse().find(({ m }) => m.agentId === agent.id && !m.isComplete)?.i
        if (idx != null) {
          const msg = { ...messages[idx] }
          const blocks = [...msg.blocks]
          const toolIdx = blocks.map((b, i) => ({ b, i })).reverse().find(({ b }) => b.type === 'tool_use' && (b as { type: 'tool_use'; tool: { status: string } }).tool.status === 'running')?.i
          if (toolIdx != null) {
            const tb = blocks[toolIdx] as { type: 'tool_use'; tool: { id: string; name: string; status: string; input?: Record<string, unknown>; output?: string } }
            blocks[toolIdx] = { ...tb, tool: { ...tb.tool, status: 'completed', output: result } }
          }
          messages[idx] = { ...msg, blocks }
        }

        const newRefs: SourceRef[] = sourceRefs
          .filter((r) => r.label)
          .map((r) => ({
            label: r.label,
            uri: r.uri ?? null,
            snippet: r.snippet ?? null,
            agentId: agent.id,
            agentColor: agent.color,
            agentAvatar: agent.avatar,
            agentName: agent.name,
          }))

        return { ...s, messages, sourceRefs: [...s.sourceRefs, ...newRefs] }
      })
      return
    }

    if (type === 'turn_done') {
      const turn = event.turn as { role: string }
      if (!turn?.role) return
      const agent = findAgentByRole(agents, turn.role)
      if (!agent) return

      setSession((s) => {
        const messages = [...s.messages]
        const idx = messages.map((m, i) => ({ m, i })).reverse().find(({ m }) => m.agentId === agent.id && !m.isComplete)?.i
        if (idx == null) return s

        const msg = { ...messages[idx] }
        const blocks = msg.blocks.map((b) => {
          if (b.type === 'text') return { ...b, isStreaming: false }
          return b
        })
        messages[idx] = { ...msg, blocks, isComplete: true }
        return { ...s, messages }
      })
      return
    }

    if (type === 'moderator_start') {
      const moderator = findAgentByRole(agents, 'Moderator')
      if (!moderator) return
      const msgId = `${sessionId}-moderator-${Date.now()}`
      const newMsg: AgentMessage = {
        id: msgId,
        agentId: moderator.id,
        round: 99,
        timestamp: new Date(),
        blocks: [],
        isComplete: false,
      }
      setSession((s) => ({ ...s, messages: [...s.messages, newMsg] }))
      return
    }

    if (type === 'moderator_delta') {
      const moderator = findAgentByRole(agents, 'Moderator')
      if (!moderator) return
      const delta = event.delta as string
      setSession((s) => {
        const messages = [...s.messages]
        const idx = messages.map((m, i) => ({ m, i })).reverse().find(({ m }) => m.agentId === moderator.id && !m.isComplete)?.i
        if (idx == null) return s
        const msg = { ...messages[idx] }
        const blocks = [...msg.blocks]
        const textIdx = blocks.findLastIndex((b) => b.type === 'text')
        if (textIdx >= 0) {
          const tb = blocks[textIdx] as { type: 'text'; content: string; isStreaming?: boolean }
          blocks[textIdx] = { ...tb, content: tb.content + delta, isStreaming: true }
        } else {
          blocks.push({ type: 'text', content: delta, isStreaming: true })
        }
        messages[idx] = { ...msg, blocks }
        return { ...s, messages }
      })
      return
    }

    if (type === 'conclusion') {
      setSession((s) => {
        const moderator = s.agents.find((agent) => agent.seatRole === 'Moderator')
        const messages = s.messages.map((m) =>
          m.agentId === moderator?.id && !m.isComplete
            ? { ...m, blocks: m.blocks.map((b) => b.type === 'text' ? { ...b, isStreaming: false } : b), isComplete: true }
            : m,
        )
        const conclusion = event.conclusion as { summary?: string }
        return { ...s, messages, conclusion: conclusion?.summary ?? '' }
      })
      return
    }

    if (type === 'error') {
      setError(event.message as string)
      setPhase('error')
    }
  }

  return { session, phase, error, start }
}
