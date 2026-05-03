/**
 * council-event-reducer.ts
 *
 * Pure reducer for Council server-sent events → DiscussionSession transitions.
 * Contains NO React dependencies — fully testable without a component tree.
 */

import type { AgentUI } from '@/types/agent'
import type { DiscussionSession, AgentMessage, ContentBlock, SourceRef, SessionAlert } from '@/types/council'
import { sanitizeToolTextForDisplay } from '@/lib/tools/display'
import { makeEmptySession } from '@/lib/council-session-factory'

// ─── Internal helpers ────────────────────────────────────────────────────────

function findAgentByRole(agents: AgentUI[], role: string): AgentUI | undefined {
  return agents.find((a) => a.seatRole === role) ?? agents.find((a) => a.name === role)
}

function appendAlert(
  existing: SessionAlert[] | undefined,
  next: Omit<SessionAlert, 'id'>,
): SessionAlert[] {
  const alerts = existing ?? []
  if (alerts.some((a) => a.level === next.level && a.message === next.message)) {
    return alerts
  }
  return [...alerts, { id: `${next.level}-${alerts.length + 1}-${Date.now()}`, ...next }]
}

function appendSanitizedDelta(content: string, delta: string): string {
  return sanitizeToolTextForDisplay(`${content}${delta}`)
}

function finalizeTurnBlocks(
  blocks: ContentBlock[],
  finalContent: string,
): ContentBlock[] {
  const nonTextBlocks = blocks.filter((b) => b.type !== 'text')
  const trimmed = finalContent.trim()
  if (!trimmed) return nonTextBlocks
  return [...nonTextBlocks, { type: 'text', content: trimmed, isStreaming: false }]
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

/**
 * Apply a single Council server-sent event to the current session state,
 * returning a new session. This function is pure — no side effects, no React.
 *
 * Special action `@@RESET` reinitialises the session before a new stream:
 *   { type: '@@RESET', title: string, abstract: string, agents: AgentUI[] }
 */
export function applyCouncilServerEvent(
  session: DiscussionSession,
  event: Record<string, unknown>,
): DiscussionSession {
  const type = event.type as string

  // ── Internal actions (dispatched by the hook, not server events) ──

  if (type === '@@RESET') {
    // Reinitialise the session before a new stream
    return makeEmptySession(
      event.title as string | undefined,
      event.abstract as string | undefined,
      event.agents as AgentUI[] | undefined,
    )
  }

  if (type === '@@LOAD') {
    // Replace session with a fully-loaded one from the server
    return event.session as DiscussionSession
  }

  if (type === '@@COMPLETE_MESSAGES') {
    // Mark all in-progress messages as complete (used on stream error/abort)
    return {
      ...session,
      messages: session.messages.map((m) => (m.isComplete ? m : { ...m, isComplete: true })),
    }
  }

  if (type === '@@STREAM_DONE') {
    // Stream finished cleanly — conclude the session and complete all messages
    return {
      ...session,
      status: 'concluded',
      concludedAt: new Date(),
      messages: session.messages.map((m) => (m.isComplete ? m : { ...m, isComplete: true })),
    }
  }

  const agents = session.agents
  const sessionId = session.id

  if (type === 'session_start') {
    return {
      ...session,
      id: event.sessionId as string,
      paperId: event.sessionId as string,
      status: 'discussing',
      startedAt: new Date(),
      currentRound: 1,
    }
  }

  if (type === 'round_start') {
    const round = (event.round as number) ?? 1
    return { ...session, currentRound: round, status: 'discussing' }
  }

  if (type === 'divergence_check') {
    const level = (event.level as DiscussionSession['divergenceLevel']) ?? null
    const proceed = event.proceed_to_round2 === true
    const summary = typeof event.summary === 'string' ? event.summary : ''
    const message =
      summary ||
      (proceed
        ? `Divergence check: ${level ?? 'unknown'}; proceeding to Round 2.`
        : `Divergence check: ${level ?? 'unknown'}; Round 2 skipped.`)
    return {
      ...session,
      divergenceLevel: level,
      alerts: appendAlert(session.alerts, { level: level === 'high' ? 'warning' : 'info', message }),
    }
  }

  if (type === 'round2_skipped') {
    const reason = typeof event.reason === 'string' ? event.reason : 'Round 2 was skipped.'
    return {
      ...session,
      round2SkippedReason: reason,
      alerts: appendAlert(session.alerts, { level: 'info', message: reason }),
    }
  }

  if (type === 'high_divergence_warning') {
    const message =
      typeof event.message === 'string' ? event.message : 'High divergence detected.'
    return {
      ...session,
      divergenceLevel: 'high',
      alerts: appendAlert(session.alerts, { level: 'warning', message }),
    }
  }

  if (type === 'session_done') {
    return { ...session, status: 'concluded', concludedAt: new Date() }
  }

  if (type === 'turn_start') {
    const role = event.role as string
    const round = (event.round as number) ?? 1
    const agent = findAgentByRole(agents, role)
    if (!agent) return session
    const msgId = `${sessionId}-r${round}-${agent.id}-${Date.now()}`

    const newMsg: AgentMessage = {
      id: msgId,
      agentId: agent.id,
      round,
      timestamp: new Date(),
      blocks: [],
      isComplete: false,
    }
    return { ...session, messages: [...session.messages, newMsg], status: 'discussing' }
  }

  if (type === 'turn_delta') {
    const role = event.role as string
    const delta = event.delta as string
    const agent = findAgentByRole(agents, role)
    if (!agent) return session

    const messages = [...session.messages]
    const idx = messages
      .map((m, i) => ({ m, i }))
      .reverse()
      .find(({ m }) => m.agentId === agent.id && !m.isComplete)?.i
    if (idx == null) return session

    const msg = { ...messages[idx] }
    const blocks = [...msg.blocks]
    const textIdx = blocks.findLastIndex((b) => b.type === 'text')
    if (textIdx >= 0) {
      const tb = blocks[textIdx] as { type: 'text'; content: string; isStreaming?: boolean }
      blocks[textIdx] = {
        ...tb,
        content: appendSanitizedDelta(tb.content, delta),
        isStreaming: true,
      }
    } else {
      blocks.push({
        type: 'text',
        content: sanitizeToolTextForDisplay(delta),
        isStreaming: true,
      })
    }
    messages[idx] = { ...msg, blocks }
    return { ...session, messages }
  }

  if (type === 'tool_call') {
    const role = event.role as string
    const tool = event.tool as string
    const args = event.args as Record<string, unknown>
    const agent = findAgentByRole(agents, role)
    if (!agent) return session
    const toolId = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const messages = [...session.messages]
    const idx = messages
      .map((m, i) => ({ m, i }))
      .reverse()
      .find(({ m }) => m.agentId === agent.id && !m.isComplete)?.i
    if (idx == null) return session

    const msg = { ...messages[idx] }
    const toolBlock: ContentBlock = {
      type: 'tool_use',
      tool: { id: toolId, name: tool, status: 'running', input: args },
    }
    messages[idx] = { ...msg, blocks: [...msg.blocks, toolBlock] }
    return { ...session, messages }
  }

  if (type === 'tool_result') {
    const role = event.role as string
    const result = event.result as string
    const sourceRefs = (
      event.sourceRefs as Array<{
        label: string
        uri: string | null
        snippet: string | null
        marker?: string | null
        chunk_index?: number | null
        doc_id?: string | null
        source_type?: 'local_doc' | 'academic' | 'web' | null
        similarity_score?: number | null
        is_heuristic?: boolean
        authors?: string[] | null
        year?: number | null
      }>
    ) ?? []
    const agent = findAgentByRole(agents, role)
    if (!agent) return session

    const messages = [...session.messages]
    const idx = messages
      .map((m, i) => ({ m, i }))
      .reverse()
      .find(({ m }) => m.agentId === agent.id && !m.isComplete)?.i

    if (idx != null) {
      const msg = { ...messages[idx] }
      const blocks = [...msg.blocks]
      const toolIdx = blocks
        .map((b, i) => ({ b, i }))
        .reverse()
        .find(
          ({ b }) =>
            b.type === 'tool_use' &&
            (b as { type: 'tool_use'; tool: { status: string } }).tool.status === 'running',
        )?.i
      if (toolIdx != null) {
        const tb = blocks[toolIdx] as {
          type: 'tool_use'
          tool: { id: string; name: string; status: string; input?: Record<string, unknown>; output?: string }
        }
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
        marker: r.marker ?? null,
        chunk_index: r.chunk_index ?? null,
        doc_id: r.doc_id ?? null,
        source_type: r.source_type ?? null,
        similarity_score: r.similarity_score ?? null,
        is_heuristic: r.is_heuristic,
        authors: r.authors ?? null,
        year: r.year ?? null,
        round: Number(event.round ?? 1),
        agentId: agent.id,
        agentColor: agent.color,
        agentAvatar: agent.avatar,
        agentName: agent.name,
      }))

    return { ...session, messages, sourceRefs: [...session.sourceRefs, ...newRefs] }
  }

  if (type === 'turn_done') {
    const turn = event.turn as { id?: string; role: string; content?: string; responds_to_turn_id?: string | null }
    if (!turn?.role) return session
    const agent = findAgentByRole(agents, turn.role)
    if (!agent) return session

    const messages = [...session.messages]
    const idx = messages
      .map((m, i) => ({ m, i }))
      .reverse()
      .find(({ m }) => m.agentId === agent.id && !m.isComplete)?.i
    if (idx == null) return session

    const msg = { ...messages[idx] }
    const blocks = finalizeTurnBlocks(
      msg.blocks,
      typeof turn.content === 'string' ? turn.content : '',
    )
    messages[idx] = {
      ...msg,
      ...(turn.id ? { id: turn.id } : {}),
      blocks,
      isComplete: true,
      responds_to_turn_id: turn.responds_to_turn_id ?? null,
    }
    return { ...session, messages }
  }

  if (type === 'moderator_start') {
    const moderator = findAgentByRole(agents, 'Moderator')
    if (!moderator) return session
    const msgId = `${sessionId}-moderator-${Date.now()}`
    const newMsg: AgentMessage = {
      id: msgId,
      agentId: moderator.id,
      round: 99,
      timestamp: new Date(),
      blocks: [],
      isComplete: false,
    }
    return { ...session, messages: [...session.messages, newMsg] }
  }

  if (type === 'moderator_delta') {
    const moderator = findAgentByRole(agents, 'Moderator')
    if (!moderator) return session
    const delta = event.delta as string

    const messages = [...session.messages]
    const idx = messages
      .map((m, i) => ({ m, i }))
      .reverse()
      .find(({ m }) => m.agentId === moderator.id && !m.isComplete)?.i
    if (idx == null) return session

    const msg = { ...messages[idx] }
    const blocks = [...msg.blocks]
    const textIdx = blocks.findLastIndex((b) => b.type === 'text')
    if (textIdx >= 0) {
      const tb = blocks[textIdx] as { type: 'text'; content: string; isStreaming?: boolean }
      blocks[textIdx] = {
        ...tb,
        content: appendSanitizedDelta(tb.content, delta),
        isStreaming: true,
      }
    } else {
      blocks.push({
        type: 'text',
        content: sanitizeToolTextForDisplay(delta),
        isStreaming: true,
      })
    }
    messages[idx] = { ...msg, blocks }
    return { ...session, messages }
  }

  if (type === 'conclusion') {
    const moderator = session.agents.find((a) => a.seatRole === 'Moderator')
    const messages = session.messages.map((m) =>
      m.agentId === moderator?.id && !m.isComplete
        ? {
            ...m,
            blocks: m.blocks.map((b) =>
              b.type === 'text' ? { ...b, isStreaming: false } : b,
            ),
            isComplete: true,
          }
        : m,
    )
    const conclusion = event.conclusion as { summary?: string }
    return { ...session, messages, conclusion: conclusion?.summary ?? '' }
  }

  // 'error' and unknown events — return session unchanged
  // (phase/error/canResume are handled directly in the hook)
  return session
}
