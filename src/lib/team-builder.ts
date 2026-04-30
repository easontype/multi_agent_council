import { runLLM } from '@/lib/llm/claude'
import { extractFirstJsonObject } from '@/lib/prompts/council-prompts'
import { DEFAULT_GEMMA_MODEL } from '@/lib/llm/gemma-models'
import {
  buildGeneratedTeamFromBrief,
  type EditableReviewAgent,
  type ReviewMode,
  type TeamBuilderBrief,
  type TeamBuilderResult,
} from '@/lib/prompts/review-presets'

function sanitizeText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() || fallback : fallback
}

function sanitizeMode(value: unknown, fallback: ReviewMode): ReviewMode {
  return value === 'gap' || value === 'critique' ? value : fallback
}

function sanitizeRounds(value: unknown, fallback: 1 | 2): 1 | 2 {
  return value === 2 ? 2 : fallback
}

function sanitizeTools(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.map((item) => sanitizeText(item)).filter(Boolean)
    : fallback
}

function sanitizeAgent(raw: unknown, fallback: EditableReviewAgent, index: number): EditableReviewAgent {
  const parsed = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
  const seatRole = sanitizeText(parsed.seatRole, fallback.seatRole)
  const name = sanitizeText(parsed.name, fallback.name)
  const focus = sanitizeText(parsed.focus, fallback.focus)
  const avatar = sanitizeText(parsed.avatar, fallback.avatar).slice(0, 2).toUpperCase() || fallback.avatar
  const color = /^#[0-9a-fA-F]{6}$/.test(sanitizeText(parsed.color)) ? sanitizeText(parsed.color) : fallback.color

  return {
    id: sanitizeText(parsed.id, `${fallback.id}-${index + 1}`),
    seatRole,
    name,
    focus,
    avatar,
    color,
    description: sanitizeText(parsed.description, fallback.description),
    systemPrompt: sanitizeText(parsed.systemPrompt, fallback.systemPrompt),
    bias: sanitizeText(parsed.bias, fallback.bias ?? '') || undefined,
    tools: sanitizeTools(parsed.tools, fallback.tools),
    model: sanitizeText(parsed.model, fallback.model),
    enabled: parsed.enabled === false ? false : true,
    isCustom: true,
  }
}

function normalizeBuilderResponse(raw: string, fallback: TeamBuilderResult): TeamBuilderResult {
  try {
    const jsonText = extractFirstJsonObject(raw)
    if (!jsonText) return fallback

    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const agents = Array.isArray(parsed.agents)
      ? parsed.agents.map((agent, index) => sanitizeAgent(agent, fallback.agents[index] ?? fallback.agents[fallback.agents.length - 1], index))
      : fallback.agents

    return {
      mode: sanitizeMode(parsed.mode, fallback.mode),
      rounds: sanitizeRounds(parsed.rounds, fallback.rounds),
      agents: agents.length ? agents : fallback.agents,
      rationale: sanitizeText(parsed.rationale, fallback.rationale ?? ''),
    }
  } catch {
    return fallback
  }
}

export async function generateTeamWithAI(input: {
  request: string
  brief: TeamBuilderBrief
  model?: string
}): Promise<TeamBuilderResult> {
  const fallback = buildGeneratedTeamFromBrief(input.brief)

  const systemPrompt = [
    'You are Council Architect, an expert at designing multi-agent academic review teams.',
    'Your job is to produce a reviewer lineup for a paper debate workspace.',
    'Return JSON only.',
    'The JSON schema is:',
    `{"mode":"critique|gap","rounds":1|2,"rationale":"string","agents":[{"id":"string","seatRole":"string","name":"string","focus":"string","avatar":"string","color":"#RRGGBB","description":"string","systemPrompt":"string","bias":"string","tools":["rag_query"],"model":"${DEFAULT_GEMMA_MODEL}","enabled":true}]}`,
    'Rules:',
    '- Generate 4 to 6 agents only.',
    '- Make each agent distinct, not paraphrases of each other.',
    '- Keep prompts concise but specific.',
    '- Prefer rag_query and search_papers for academic review.',
    '- Use mode "gap" for revision/rebuttal style teams, otherwise "critique".',
    '- Use rounds 2 when cross-examination is useful, otherwise 1.',
  ].join(' ')

  const prompt = [
    `User request: ${input.request || '(none provided)'}`,
    '',
    'Structured preferences:',
    JSON.stringify(input.brief, null, 2),
    '',
    'Provide the final team JSON only.',
  ].join('\n')

  try {
    const raw = await runLLM(prompt, systemPrompt, input.model ?? DEFAULT_GEMMA_MODEL)
    return normalizeBuilderResponse(raw, fallback)
  } catch {
    return fallback
  }
}
