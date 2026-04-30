import type {
  CouncilConclusion,
  CouncilEvidence,
  CouncilSession,
  CouncilTurn,
} from '@/lib/council-types'
import type { ReviewPhase } from '@/lib/council-review-phase'
import type {
  Agent,
  AgentMessage,
  ContentBlock,
  DiscussionSession,
  SessionAlert,
  SourceRef,
} from '@/types/council'
import { DEFAULT_AGENTS } from '@/types/council'

export interface CouncilSessionBundle {
  session: CouncilSession | null
  turns: CouncilTurn[]
  conclusion: CouncilConclusion | null
  evidence: CouncilEvidence[]
}

export interface HydratedCouncilSession {
  discussionSession: DiscussionSession
  phase: ReviewPhase
  isResumable: boolean
}

const MODERATOR_AGENT = DEFAULT_AGENTS.find((agent) => agent.seatRole === 'Moderator') ?? {
  id: 'moderator',
  name: 'Moderator',
  role: 'Synthesis',
  seatRole: 'Moderator',
  color: '#6b7280',
  avatar: 'M',
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildAgents(session: CouncilSession): Agent[] {
  const defaultMeta = new Map(DEFAULT_AGENTS.map((agent) => [agent.seatRole, agent]))
  const seatAgents = session.seats.map((seat, index) => {
    const meta = defaultMeta.get(seat.role)
    if (meta) return meta

    return {
      id: `${slugify(seat.role) || 'seat'}-${index + 1}`,
      name: seat.role,
      role: seat.role,
      seatRole: seat.role,
      color: '#5f6672',
      avatar: seat.role.trim().charAt(0).toUpperCase() || 'A',
    }
  })

  if (seatAgents.some((agent) => agent.seatRole === 'Moderator')) {
    return seatAgents
  }

  return [...seatAgents, MODERATOR_AGENT]
}

function findAgent(agents: Agent[], role: string): Agent | undefined {
  return agents.find((agent) => agent.seatRole === role) ?? agents.find((agent) => agent.name === role)
}

function buildEvidenceMap(evidence: CouncilEvidence[]) {
  const map = new Map<string, CouncilEvidence[]>()
  for (const item of evidence) {
    const key = `${item.round}:${item.role}`
    const entries = map.get(key) ?? []
    entries.push(item)
    map.set(key, entries)
  }
  return map
}

function buildMessageBlocks(turn: CouncilTurn, evidence: CouncilEvidence[]): ContentBlock[] {
  const toolBlocks: ContentBlock[] = evidence.map((item) => ({
    type: 'tool_use',
    tool: {
      id: item.id,
      name: item.tool,
      status: item.status === 'failed' ? 'error' : item.status === 'completed' ? 'completed' : 'running',
      input: item.args,
      output: item.result || undefined,
    },
  }))

  const text = turn.content.trim()
  if (!text) return toolBlocks

  return [...toolBlocks, { type: 'text', content: text, isStreaming: false }]
}

function buildMessages(
  turns: CouncilTurn[],
  evidence: CouncilEvidence[],
  agents: Agent[],
): AgentMessage[] {
  const evidenceMap = buildEvidenceMap(evidence)
  return turns.map((turn) => {
    const agent = findAgent(agents, turn.role) ?? MODERATOR_AGENT
    const key = turn.role === 'Moderator' ? '' : `${turn.round}:${turn.role}`
    const blocks = buildMessageBlocks(turn, key ? evidenceMap.get(key) ?? [] : [])

    return {
      id: turn.id,
      agentId: agent.id,
      round: turn.role === 'Moderator' ? 99 : turn.round,
      timestamp: new Date(turn.created_at),
      blocks,
      isComplete: true,
    }
  })
}

function buildSourceRefs(evidence: CouncilEvidence[], agents: Agent[]): SourceRef[] {
  return evidence.flatMap((item) => {
    const agent = findAgent(agents, item.role)
    if (!agent) return []

    return item.source_refs.map((ref) => ({
      label: ref.label,
      uri: ref.uri,
      snippet: ref.snippet,
      round: item.round,
      agentId: agent.id,
      agentColor: agent.color,
      agentAvatar: agent.avatar,
      agentName: agent.name,
    }))
  })
}

function buildAlerts(session: CouncilSession): SessionAlert[] {
  const alerts: SessionAlert[] = []
  if (session.divergence_level && session.divergence_level !== 'none') {
    alerts.push({
      id: `divergence-${session.id}`,
      level: session.divergence_level === 'high' ? 'warning' : 'info',
      message: `Divergence level recorded as ${session.divergence_level}.`,
    })
  }
  return alerts
}

function getDiscussionStatus(session: CouncilSession, hasMessages: boolean): DiscussionSession['status'] {
  if (session.status === 'concluded') return 'concluded'
  if (session.status === 'pending' && !hasMessages) return 'waiting'
  return 'discussing'
}

export function mapStoredStatusToReviewPhase(session: CouncilSession, hasMessages: boolean): ReviewPhase {
  if (session.status === 'failed') return 'error'
  if (session.status === 'concluded') return 'concluded'
  if (session.status === 'running') return 'running'
  if (session.status === 'pending' && hasMessages) return 'running'
  return 'idle'
}

function getCurrentRound(turns: CouncilTurn[]): number | undefined {
  const rounds = turns
    .filter((turn) => turn.role !== 'Moderator')
    .map((turn) => turn.round)
  if (!rounds.length) return undefined
  return Math.max(...rounds)
}

export function hydrateCouncilSessionBundle(bundle: CouncilSessionBundle): HydratedCouncilSession {
  if (!bundle.session) {
    throw new Error('Council session not found')
  }

  const agents = buildAgents(bundle.session)
  const messages = buildMessages(bundle.turns, bundle.evidence, agents)
  const hasMessages = messages.length > 0

  const discussionSession: DiscussionSession = {
    id: bundle.session.id,
    paperId: bundle.session.id,
    paperTitle: bundle.session.title,
    paperAbstract: bundle.session.context ?? '',
    status: getDiscussionStatus(bundle.session, hasMessages),
    agents,
    messages,
    sourceRefs: buildSourceRefs(bundle.evidence, agents),
    conclusion: bundle.conclusion?.summary ?? undefined,
    currentRound: getCurrentRound(bundle.turns),
    divergenceLevel: bundle.session.divergence_level as DiscussionSession['divergenceLevel'],
    alerts: buildAlerts(bundle.session),
    startedAt: new Date(bundle.session.started_at ?? bundle.session.created_at),
    concludedAt: bundle.session.concluded_at ? new Date(bundle.session.concluded_at) : undefined,
  }

  return {
    discussionSession,
    phase: mapStoredStatusToReviewPhase(bundle.session, hasMessages),
    isResumable: bundle.session.status === 'running' || bundle.session.status === 'pending',
  }
}
