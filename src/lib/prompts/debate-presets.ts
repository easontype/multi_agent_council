import {
  CRITIQUE_SEAT_DEFINITIONS,
  EXPERIMENTAL_SEAT_DEFINITIONS,
  BIOMEDICAL_SEAT_DEFINITIONS,
  PHYSICS_SEAT_DEFINITIONS,
  type SeatDefinition,
} from '../core/council-academic'
import type { CouncilSeat } from '../core/council-types'
import type { ReviewDomain } from './review-presets'
import { DEFAULT_GEMMA_MODEL } from '../llm/gemma-models'

export interface AdversarialDebateConfig {
  optionA: string
  optionB: string
  context?: string
  domain: ReviewDomain
  selectedRoleIds: string[]
}

function seatsForDomain(domain: ReviewDomain): SeatDefinition[] {
  switch (domain) {
    case 'materials': return EXPERIMENTAL_SEAT_DEFINITIONS
    case 'biomedical': return BIOMEDICAL_SEAT_DEFINITIONS
    case 'physics': return PHYSICS_SEAT_DEFINITIONS
    default: return CRITIQUE_SEAT_DEFINITIONS
  }
}

function buildMirrorSeat(
  def: SeatDefinition,
  forOption: string,
  againstOption: string,
  context: string,
  team: 'option_a' | 'option_b',
): CouncilSeat {
  const systemPrompt = [
    `You are ${def.role}, and in this debate your position is to support "${forOption}".`,
    ``,
    `Context: ${context}`,
    ``,
    `Your analytical framework:`,
    def.systemPrompt,
    ``,
    `IMPORTANT: Draw on paper content and external literature to find evidence that supports "${forOption}".`,
    `When the opposing side raises objections, respond directly to their specific arguments.`,
    `Your opponent is advocating for "${againstOption}" — engage their claims with precision.`,
  ].join('\n')

  return {
    role: `${def.role} [${forOption}]`,
    model: def.modelOverride ?? DEFAULT_GEMMA_MODEL,
    systemPrompt,
    bias: `Advocate for "${forOption}". ${def.bias ?? ''}`.trim(),
    tools: def.tools,
    team,
  }
}

const ADVERSARIAL_MODERATOR: CouncilSeat = {
  role: 'Moderator',
  model: DEFAULT_GEMMA_MODEL,
  systemPrompt: [
    'You are the neutral moderator of this adversarial debate.',
    'Your task: summarise the main arguments from both sides, identify the core points of disagreement,',
    'and deliver an evidence-based final verdict on which option is better supported by the literature.',
    'Be specific about what each side proved and where each side fell short.',
  ].join(' '),
  tools: ['rag_query'],
  team: 'moderator',
}

export function buildAdversarialTeam(config: AdversarialDebateConfig): CouncilSeat[] {
  const allSeats = seatsForDomain(config.domain)
  const selected = allSeats.filter((def) => config.selectedRoleIds.includes(def.id))
  const context = config.context?.trim() || `Compare the advantages and disadvantages of ${config.optionA} vs ${config.optionB}`

  const teamA = selected.map((def) => buildMirrorSeat(def, config.optionA, config.optionB, context, 'option_a'))
  const teamB = selected.map((def) => buildMirrorSeat(def, config.optionB, config.optionA, context, 'option_b'))

  return [...teamA, ...teamB, ADVERSARIAL_MODERATOR]
}
