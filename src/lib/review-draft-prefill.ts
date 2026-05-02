import type { CouncilSeat, CouncilSession } from '@/lib/core/council-types'
import type { EditableReviewAgent, ReviewMode } from '@/lib/prompts/review-presets'
import { CRITIQUE_SEAT_DEFINITIONS, GAP_SEAT_DEFINITIONS } from '@/lib/core/council-academic'

const STORAGE_KEY = 'council.review-draft-prefill.v1'

export interface ReviewDraftPrefill {
  mode: ReviewMode
  rounds: 1 | 2
  agents: EditableReviewAgent[]
  topicPresetId?: string
  topic?: string
  goal?: string
  arxivId?: string
  sourceType: 'arxiv' | 'upload' | 'unknown'
  notice?: string
}

function inferMode(seats: CouncilSeat[]): ReviewMode {
  const critiqueRoles = new Set(CRITIQUE_SEAT_DEFINITIONS.map((seat) => seat.role))
  const gapRoles = new Set(GAP_SEAT_DEFINITIONS.map((seat) => seat.role))
  const critiqueMatches = seats.filter((seat) => critiqueRoles.has(seat.role)).length
  const gapMatches = seats.filter((seat) => gapRoles.has(seat.role)).length
  return gapMatches > critiqueMatches ? 'gap' : 'critique'
}

function buildEditableAgent(seat: CouncilSeat, index: number, mode: ReviewMode): EditableReviewAgent {
  const definitions = mode === 'gap' ? GAP_SEAT_DEFINITIONS : CRITIQUE_SEAT_DEFINITIONS
  const definition = definitions.find((item) => item.role === seat.role)
  const fallbackAvatar = seat.role.trim().charAt(0).toUpperCase() || 'A'
  const avatar = definition?.avatar ?? fallbackAvatar
  return {
    id: definition?.id ?? `prefill-${index + 1}`,
    seatRole: seat.role,
    name: seat.role,
    focus: definition?.focus ?? 'Custom',
    avatar,
    color: definition?.color ?? '#5f6672',
    description: definition?.description ?? 'Recovered from a previous review session.',
    systemPrompt: seat.systemPrompt,
    bias: seat.bias,
    tools: seat.tools ?? [],
    model: seat.model,
    enabled: true,
    isCustom: !definition,
  }
}

export function extractSourceUrl(context: string | null | undefined): string | null {
  if (!context) return null
  const match = context.match(/Source:\s*(.*)\. Library:\s*/i)
  return match?.[1]?.trim() ?? null
}

export function extractArxivIdFromSource(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null
  const arxivMatch = sourceUrl.match(/arxiv\.org\/(?:abs|pdf)\/([^/?#]+?)(?:\.pdf)?$/i)
  if (arxivMatch?.[1]) return arxivMatch[1]
  const plainMatch = sourceUrl.match(/^(\d{4}\.\d{4,5}(?:v\d+)?)$/i)
  return plainMatch?.[1] ?? null
}

export function buildDraftPrefillFromSession(session: CouncilSession): ReviewDraftPrefill {
  const mode = inferMode(session.seats)
  const sourceUrl = extractSourceUrl(session.context)
  const arxivId = extractArxivIdFromSource(sourceUrl)
  const sourceType = arxivId ? 'arxiv' : sourceUrl === 'upload' ? 'upload' : 'unknown'

  return {
    mode,
    rounds: session.rounds === 2 ? 2 : 1,
    agents: session.seats.map((seat, index) => buildEditableAgent(seat, index, mode)),
    topicPresetId: 'custom',
    topic: session.topic,
    goal: session.goal ?? undefined,
    arxivId: arxivId ?? undefined,
    sourceType,
    notice: sourceType === 'upload'
      ? 'Session setup was restored from a previous uploaded PDF. Re-upload the paper to run this draft again.'
      : sourceType === 'unknown'
        ? 'Session setup was restored, but the original paper source could not be recovered automatically.'
        : undefined,
  }
}

export function saveReviewDraftPrefill(prefill: ReviewDraftPrefill) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefill))
}

export function consumeReviewDraftPrefill(): ReviewDraftPrefill | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  window.sessionStorage.removeItem(STORAGE_KEY)
  try {
    return JSON.parse(raw) as ReviewDraftPrefill
  } catch {
    return null
  }
}
