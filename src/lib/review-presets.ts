import { buildAcademicCritiqueSeats, buildGapAnalysisSeats } from './council-academic'
import type { CouncilSeat } from './council-types'
import type { Agent } from '@/types/council'

export type ReviewMode = 'critique' | 'gap'

export interface EditableReviewAgent {
  id: string
  seatRole: string
  name: string
  focus: string
  avatar: string
  color: string
  description: string
  systemPrompt: string
  bias?: string
  tools: string[]
  model: string
  enabled: boolean
  isCustom?: boolean
}

interface RoleMeta {
  id: string
  focus: string
  avatar: string
  color: string
  description: string
}

const MODERATOR_AGENT: Agent = {
  id: 'moderator',
  name: 'Moderator',
  role: 'Synthesis',
  seatRole: 'Moderator',
  color: '#6b7280',
  avatar: 'M',
}

const CRITIQUE_META: Record<string, RoleMeta> = {
  'Methods Critic': {
    id: 'methods',
    focus: 'Methodology',
    avatar: 'M',
    color: '#43506b',
    description: 'Pushes on research design, analytical rigor, and hidden confounds.',
  },
  'Literature Auditor': {
    id: 'literature',
    focus: 'Related Work',
    avatar: 'L',
    color: '#65505f',
    description: 'Checks whether the framing and citations are complete and fair.',
  },
  'Replication Skeptic': {
    id: 'replication',
    focus: 'Reproducibility',
    avatar: 'R',
    color: '#466671',
    description: 'Looks for weak replication detail, overreach, and fragile claims.',
  },
  'Contribution Evaluator': {
    id: 'contribution',
    focus: 'Novelty',
    avatar: 'C',
    color: '#8a5f3b',
    description: 'Asks whether the paper is genuinely new and worth publishing.',
  },
  'Constructive Advocate': {
    id: 'advocate',
    focus: 'Best Case',
    avatar: 'A',
    color: '#59674b',
    description: 'Defends the strongest reading of the work while staying honest.',
  },
}

const GAP_META: Record<string, RoleMeta> = {
  'Gap Finder': {
    id: 'gap',
    focus: 'Missing Pieces',
    avatar: 'G',
    color: '#46536f',
    description: 'Surfaces thin sections, missing controls, and unstated assumptions.',
  },
  'Hostile Reviewer': {
    id: 'hostile',
    focus: 'Reject Case',
    avatar: 'H',
    color: '#7a4c54',
    description: 'Simulates the sharpest reviewer who is actively looking to reject.',
  },
  'Methods Auditor': {
    id: 'methods2',
    focus: 'Methods Audit',
    avatar: 'A',
    color: '#4a6b73',
    description: 'Checks whether the method section is detailed enough to replicate.',
  },
  'Related Work Scout': {
    id: 'scout',
    focus: 'Search Sweep',
    avatar: 'S',
    color: '#8b6740',
    description: 'Searches for the papers the draft should already be citing.',
  },
  'Supportive Mentor': {
    id: 'mentor',
    focus: 'Revision Plan',
    avatar: 'M',
    color: '#5f7154',
    description: 'Turns critique into a practical revision plan.',
  },
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'agent'
}

function buildAgentFromSeat(
  seat: CouncilSeat,
  meta: RoleMeta | undefined,
  index: number,
): EditableReviewAgent {
  const name = seat.role
  return {
    id: meta?.id ?? `${slugify(name)}-${index + 1}`,
    seatRole: seat.role,
    name,
    focus: meta?.focus ?? 'Custom Role',
    avatar: meta?.avatar ?? (name.charAt(0).toUpperCase() || 'A'),
    color: meta?.color ?? '#5f6672',
    description: meta?.description ?? 'A custom reviewer persona in the debate lineup.',
    systemPrompt: seat.systemPrompt,
    bias: seat.bias,
    tools: seat.tools ?? ['rag_query'],
    model: seat.model,
    enabled: true,
  }
}

export function buildEditableTeam(mode: ReviewMode): EditableReviewAgent[] {
  const seats = mode === 'gap'
    ? buildGapAnalysisSeats('claude-sonnet-4-6')
    : buildAcademicCritiqueSeats('claude-sonnet-4-6')
  const metaTable = mode === 'gap' ? GAP_META : CRITIQUE_META

  return seats.map((seat, index) => buildAgentFromSeat(seat, metaTable[seat.role], index))
}

export function createCustomEditableAgent(existingCount: number): EditableReviewAgent {
  const seq = existingCount + 1
  return {
    id: `custom-${seq}`,
    seatRole: `Custom Reviewer ${seq}`,
    name: `Custom Reviewer ${seq}`,
    focus: 'Custom',
    avatar: 'C',
    color: '#5f6672',
    description: 'A custom debate seat you can tune for a specific review angle.',
    systemPrompt: 'You are a specialized reviewer. State what perspective you represent, what evidence you prioritize, and how you want your critique structured.',
    bias: 'Bias toward specific, text-grounded critique.',
    tools: ['rag_query', 'search_papers'],
    model: 'claude-sonnet-4-6',
    enabled: true,
    isCustom: true,
  }
}

export function buildSeatsFromEditableAgents(agents: EditableReviewAgent[]): CouncilSeat[] {
  return agents
    .filter((agent) => agent.enabled)
    .map((agent) => ({
      role: agent.seatRole.trim() || agent.name.trim() || 'Custom Reviewer',
      model: agent.model.trim() || 'claude-sonnet-4-6',
      systemPrompt: agent.systemPrompt.trim() || 'You are a specialized reviewer. Provide a structured critique.',
      bias: agent.bias?.trim() || undefined,
      tools: agent.tools.map((tool) => tool.trim()).filter(Boolean),
    }))
}

export function buildDiscussionAgents(agents: EditableReviewAgent[]): Agent[] {
  const active = agents
    .filter((agent) => agent.enabled)
    .map((agent) => ({
      id: agent.id,
      name: agent.name.trim() || agent.seatRole.trim() || 'Custom Reviewer',
      role: agent.focus.trim() || 'Custom Role',
      seatRole: agent.seatRole.trim() || agent.name.trim() || 'Custom Reviewer',
      color: agent.color,
      avatar: agent.avatar.trim().slice(0, 2) || 'A',
    }))

  return [...active, MODERATOR_AGENT]
}

export function getModeratorAgent(): Agent {
  return MODERATOR_AGENT
}
