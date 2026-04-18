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

export interface TeamBuilderBrief {
  reviewGoal: 'submission' | 'literature' | 'revision' | 'rebuttal'
  paperType: 'methods' | 'systems' | 'theory' | 'applied'
  stance: 'skeptical' | 'balanced' | 'supportive'
  priority: 'novelty' | 'methods' | 'experiments' | 'writing' | 'citations'
  teamSize: 4 | 5 | 6
}

export interface TeamBuilderResult {
  mode: ReviewMode
  rounds: 1 | 2
  agents: EditableReviewAgent[]
}

interface RoleMeta {
  id: string
  focus: string
  avatar: string
  color: string
  description: string
}

interface BuilderRoleTemplate {
  id: string
  name: string
  focus: string
  avatar: string
  color: string
  description: string
  tags: TeamBuilderBrief['priority'][]
  tools?: string[]
  promptAngle: string
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

const GOAL_LABELS: Record<TeamBuilderBrief['reviewGoal'], string> = {
  submission: 'pre-submission review',
  literature: 'literature review',
  revision: 'revision planning',
  rebuttal: 'rebuttal stress test',
}

const PAPER_TYPE_LABELS: Record<TeamBuilderBrief['paperType'], string> = {
  methods: 'methods-heavy empirical paper',
  systems: 'systems paper with engineering tradeoffs',
  theory: 'theory-forward paper where assumptions and derivations matter',
  applied: 'applied paper where practical validity and evidence matter',
}

const STANCE_LABELS: Record<TeamBuilderBrief['stance'], string> = {
  skeptical: 'push hard on weaknesses, unsupported claims, and hidden assumptions',
  balanced: 'balance strengths against weaknesses and keep the critique fair',
  supportive: 'be constructive first while still surfacing concrete issues that must be fixed',
}

const PRIORITY_LABELS: Record<TeamBuilderBrief['priority'], string> = {
  novelty: 'novelty and contribution',
  methods: 'methodology and design',
  experiments: 'experiments and evidence',
  writing: 'clarity and writing quality',
  citations: 'related work and citations',
}

const SUBMISSION_ROLE_POOL: BuilderRoleTemplate[] = [
  {
    id: 'methods-critic',
    name: 'Methods Critic',
    focus: 'Methodology',
    avatar: 'M',
    color: '#43506b',
    description: 'Tests whether the paper design, assumptions, and analysis actually support the claims.',
    tags: ['methods'],
    tools: ['rag_query'],
    promptAngle: 'Pressure-test research design, confounds, ablations, and whether the stated method is defensible.',
  },
  {
    id: 'novelty-judge',
    name: 'Novelty Judge',
    focus: 'Contribution',
    avatar: 'N',
    color: '#78614a',
    description: 'Checks whether the contribution is genuinely new enough to matter.',
    tags: ['novelty'],
    tools: ['rag_query', 'search_papers'],
    promptAngle: 'Evaluate whether the claimed contribution is incremental, derivative, or substantial.',
  },
  {
    id: 'experimental-auditor',
    name: 'Experimental Auditor',
    focus: 'Evidence',
    avatar: 'E',
    color: '#496973',
    description: 'Looks for weak experimental support, missing baselines, and evaluation gaps.',
    tags: ['experiments'],
    tools: ['rag_query'],
    promptAngle: 'Inspect evaluation design, robustness checks, baselines, and whether evidence is sufficient.',
  },
  {
    id: 'literature-auditor',
    name: 'Literature Auditor',
    focus: 'Related Work',
    avatar: 'L',
    color: '#65505f',
    description: 'Looks for citation gaps, weak framing, and missing prior art.',
    tags: ['citations'],
    tools: ['rag_query', 'search_papers'],
    promptAngle: 'Check whether the framing overstates novelty or omits relevant prior work.',
  },
  {
    id: 'writing-examiner',
    name: 'Writing Examiner',
    focus: 'Clarity',
    avatar: 'W',
    color: '#5f6672',
    description: 'Inspects structure, clarity, ambiguity, and whether the paper is legible to reviewers.',
    tags: ['writing'],
    tools: ['rag_query'],
    promptAngle: 'Identify clarity issues, confusing sections, missing definitions, and claims that are hard to verify.',
  },
  {
    id: 'constructive-advocate',
    name: 'Constructive Advocate',
    focus: 'Best Case',
    avatar: 'A',
    color: '#59674b',
    description: 'Makes sure the team does not miss the strongest defensible reading of the work.',
    tags: ['novelty', 'writing'],
    tools: ['rag_query'],
    promptAngle: 'Argue for the strongest fair interpretation of the paper and protect against lazy dismissal.',
  },
]

const LITERATURE_ROLE_POOL: BuilderRoleTemplate[] = [
  {
    id: 'claim-mapper',
    name: 'Claim Mapper',
    focus: 'Claim Structure',
    avatar: 'C',
    color: '#46536f',
    description: 'Maps the paper into claims, evidence, limitations, and open questions.',
    tags: ['writing', 'methods'],
    tools: ['rag_query'],
    promptAngle: 'Turn the paper into a claim-evidence structure with clear caveats.',
  },
  {
    id: 'comparative-synthesist',
    name: 'Comparative Synthesist',
    focus: 'Landscape',
    avatar: 'S',
    color: '#78614a',
    description: 'Places the work against adjacent literature and competing approaches.',
    tags: ['novelty', 'citations'],
    tools: ['rag_query', 'search_papers'],
    promptAngle: 'Situate the paper among adjacent approaches and explain what actually differentiates it.',
  },
  {
    id: 'methods-distiller',
    name: 'Methods Distiller',
    focus: 'Method Distillation',
    avatar: 'D',
    color: '#496973',
    description: 'Extracts the method cleanly and checks which parts are actually essential.',
    tags: ['methods'],
    tools: ['rag_query'],
    promptAngle: 'Clarify the method and separate the essential mechanism from peripheral detail.',
  },
  {
    id: 'evidence-auditor',
    name: 'Evidence Auditor',
    focus: 'Evidence Quality',
    avatar: 'E',
    color: '#5f6672',
    description: 'Asks whether the results actually justify the interpretation users might make.',
    tags: ['experiments'],
    tools: ['rag_query'],
    promptAngle: 'Judge how strong the evidence is, where it is thin, and where conclusions outrun data.',
  },
  {
    id: 'citation-cartographer',
    name: 'Citation Cartographer',
    focus: 'Citation Map',
    avatar: 'L',
    color: '#65505f',
    description: 'Surfaces which papers this work belongs with and what it may have missed.',
    tags: ['citations'],
    tools: ['rag_query', 'search_papers'],
    promptAngle: 'Audit citation completeness and identify the most relevant missing neighbors.',
  },
  {
    id: 'takeaway-editor',
    name: 'Takeaway Editor',
    focus: 'Takeaways',
    avatar: 'T',
    color: '#59674b',
    description: 'Translates the paper into the crisp takeaways a researcher would actually keep.',
    tags: ['writing', 'novelty'],
    tools: ['rag_query'],
    promptAngle: 'Rewrite the paper into durable takeaways, caveats, and what a reader should remember.',
  },
]

const REVISION_ROLE_POOL: BuilderRoleTemplate[] = [
  {
    id: 'hostile-reviewer',
    name: 'Hostile Reviewer',
    focus: 'Reject Case',
    avatar: 'H',
    color: '#7a4c54',
    description: 'Builds the sharpest plausible reject case so the revision can harden against it.',
    tags: ['novelty', 'experiments'],
    tools: ['rag_query', 'search_papers'],
    promptAngle: 'Write the strongest plausible reject case grounded in concrete weaknesses.',
  },
  {
    id: 'methods-auditor',
    name: 'Methods Auditor',
    focus: 'Methods Audit',
    avatar: 'M',
    color: '#4a6b73',
    description: 'Finds missing procedural detail, under-specified methods, and weak controls.',
    tags: ['methods'],
    tools: ['rag_query'],
    promptAngle: 'Focus on what must be specified, controlled, or justified before reviewers will trust the work.',
  },
  {
    id: 'missing-experiment-scout',
    name: 'Missing Experiment Scout',
    focus: 'Experiment Gaps',
    avatar: 'X',
    color: '#6f5c48',
    description: 'Names the experiments and analyses most likely to change the verdict.',
    tags: ['experiments'],
    tools: ['rag_query'],
    promptAngle: 'List the highest-leverage missing experiments, baselines, or sanity checks.',
  },
  {
    id: 'citation-scout',
    name: 'Citation Scout',
    focus: 'Prior Art Gaps',
    avatar: 'C',
    color: '#65505f',
    description: 'Searches for citation debt and novelty overclaims that need revision.',
    tags: ['citations'],
    tools: ['rag_query', 'search_papers'],
    promptAngle: 'Identify which claims need better citation support or more cautious novelty framing.',
  },
  {
    id: 'writing-surgeon',
    name: 'Writing Surgeon',
    focus: 'Clarity Repair',
    avatar: 'W',
    color: '#5f6672',
    description: 'Targets wording, organization, and sections that currently confuse reviewers.',
    tags: ['writing'],
    tools: ['rag_query'],
    promptAngle: 'Pinpoint the parts that are hardest to follow and explain how to make them review-proof.',
  },
  {
    id: 'revision-strategist',
    name: 'Revision Strategist',
    focus: 'Revision Plan',
    avatar: 'R',
    color: '#59674b',
    description: 'Turns the critique into a prioritized revision plan with realistic sequencing.',
    tags: ['writing', 'methods'],
    tools: ['rag_query'],
    promptAngle: 'Synthesize the critique into a prioritized revision roadmap with clear tradeoffs.',
  },
]

const REBUTTAL_ROLE_POOL: BuilderRoleTemplate[] = [
  {
    id: 'reject-oriented-reviewer',
    name: 'Reject-Oriented Reviewer',
    focus: 'Reject Pressure',
    avatar: 'R',
    color: '#7a4c54',
    description: 'Tests whether the rebuttal meaningfully changes a skeptical reviewer’s verdict.',
    tags: ['novelty', 'experiments'],
    tools: ['rag_query'],
    promptAngle: 'Assume a skeptical reviewer and judge whether the rebuttal really resolves the biggest issues.',
  },
  {
    id: 'fairness-referee',
    name: 'Fairness Referee',
    focus: 'Fairness Check',
    avatar: 'F',
    color: '#5f6672',
    description: 'Checks whether the rebuttal is fair, direct, and responsive instead of evasive.',
    tags: ['writing'],
    tools: ['rag_query'],
    promptAngle: 'Judge whether the response is direct, credible, and appropriately scoped.',
  },
  {
    id: 'evidence-checker',
    name: 'Evidence Checker',
    focus: 'Evidence Check',
    avatar: 'E',
    color: '#496973',
    description: 'Asks whether the rebuttal introduces enough evidence to fix the original doubt.',
    tags: ['experiments'],
    tools: ['rag_query'],
    promptAngle: 'Check whether the response adds evidence, clarifies evidence, or merely rephrases prior claims.',
  },
  {
    id: 'scope-defender',
    name: 'Scope Defender',
    focus: 'Claim Scope',
    avatar: 'S',
    color: '#6f5c48',
    description: 'Pushes the authors to narrow or reframe claims where the paper cannot fully support them.',
    tags: ['novelty', 'writing'],
    tools: ['rag_query'],
    promptAngle: 'Identify where the rebuttal should narrow, qualify, or reframe claims instead of defending too much.',
  },
  {
    id: 'citation-cross-examiner',
    name: 'Citation Cross-Examiner',
    focus: 'Prior Art',
    avatar: 'L',
    color: '#65505f',
    description: 'Checks whether the rebuttal handles related-work objections honestly.',
    tags: ['citations'],
    tools: ['rag_query', 'search_papers'],
    promptAngle: 'Evaluate whether the response handles prior-art objections with enough specificity and humility.',
  },
  {
    id: 'rebuttal-coach',
    name: 'Rebuttal Coach',
    focus: 'Recovery Plan',
    avatar: 'C',
    color: '#59674b',
    description: 'Turns the analysis into the clearest possible response strategy.',
    tags: ['writing', 'methods'],
    tools: ['rag_query'],
    promptAngle: 'Offer the clearest structure for a rebuttal that maximizes reviewer movement.',
  },
]

function builderPoolForGoal(goal: TeamBuilderBrief['reviewGoal']) {
  if (goal === 'literature') return LITERATURE_ROLE_POOL
  if (goal === 'revision') return REVISION_ROLE_POOL
  if (goal === 'rebuttal') return REBUTTAL_ROLE_POOL
  return SUBMISSION_ROLE_POOL
}

function buildGeneratedAgent(
  template: BuilderRoleTemplate,
  brief: TeamBuilderBrief,
  index: number,
): EditableReviewAgent {
  const prioritySentence = `The user most cares about ${PRIORITY_LABELS[brief.priority]}.`
  const systemPrompt = [
    `You are ${template.name}, a specialist reviewer in a multi-agent paper debate.`,
    `The user wants ${GOAL_LABELS[brief.reviewGoal]} for a ${PAPER_TYPE_LABELS[brief.paperType]}.`,
    `Adopt this review stance: ${STANCE_LABELS[brief.stance]}.`,
    prioritySentence,
    template.promptAngle,
    `Ground every important point in the paper text, cite concrete evidence, and distinguish fatal issues from fixable ones.`,
    `Write with a strong point of view, but stay specific and useful.`,
  ].join(' ')

  return {
    id: `${template.id}-${index + 1}`,
    seatRole: template.name,
    name: template.name,
    focus: template.focus,
    avatar: template.avatar,
    color: template.color,
    description: `${template.description} Tuned for ${GOAL_LABELS[brief.reviewGoal]}.`,
    systemPrompt,
    bias: `${STANCE_LABELS[brief.stance]}. Prioritize ${PRIORITY_LABELS[brief.priority]}.`,
    tools: template.tools ?? ['rag_query'],
    model: 'claude-sonnet-4-6',
    enabled: true,
    isCustom: true,
  }
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

export function buildGeneratedTeamFromBrief(brief: TeamBuilderBrief): TeamBuilderResult {
  const pool = builderPoolForGoal(brief.reviewGoal)
  const preferredRole = pool.find((role) => role.tags.includes(brief.priority))

  const selected = pool.slice(0, brief.teamSize)
  if (preferredRole && !selected.some((role) => role.id === preferredRole.id)) {
    selected[selected.length - 1] = preferredRole
  }

  const deduped = selected.filter((role, index, arr) => arr.findIndex((item) => item.id === role.id) === index)
  const agents = deduped.map((role, index) => buildGeneratedAgent(role, brief, index))

  const mode: ReviewMode = brief.reviewGoal === 'revision' || brief.reviewGoal === 'rebuttal' ? 'gap' : 'critique'
  const rounds: 1 | 2 = brief.reviewGoal === 'literature'
    ? 1
    : brief.reviewGoal === 'submission' && brief.stance === 'supportive'
      ? 1
      : 2

  return { mode, rounds, agents }
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
