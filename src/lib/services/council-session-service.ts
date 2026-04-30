import type { ReviewPhase } from '@/lib/council-review-phase'
import {
  hydrateCouncilSessionBundle,
  type CouncilSessionBundle,
  type HydratedCouncilSession,
} from './council-session-hydrator'

export interface LoadedCouncilSession extends HydratedCouncilSession {
  bundle: CouncilSessionBundle
}

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function fetchCouncilSessionBundle(sessionId: string): Promise<CouncilSessionBundle> {
  const response = await fetch(`/api/sessions/${sessionId}`)
  const payload = await readJsonSafely<CouncilSessionBundle & { error?: string }>(response)

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? `Failed to load session (${response.status})`)
  }

  return {
    session: payload.session ?? null,
    turns: Array.isArray(payload.turns) ? payload.turns : [],
    conclusion: payload.conclusion ?? null,
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
  }
}

export async function loadCouncilSession(sessionId: string): Promise<LoadedCouncilSession> {
  const bundle = await fetchCouncilSessionBundle(sessionId)
  const hydrated = hydrateCouncilSessionBundle(bundle)
  return { ...hydrated, bundle }
}

export function isCouncilSessionRunningPhase(phase: ReviewPhase) {
  return phase === 'running'
}
