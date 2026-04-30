export type RestoreSource = 'url' | 'local'

export interface RestoreResolutionInput {
  sessionIdFromUrl?: string | null
  lastOpenedSessionId?: string | null
  hasArxivParam?: boolean
  hasPendingUpload?: boolean
  currentSessionId?: string | null
  lastRequestedSessionId?: string | null
}

export interface RestoreResolution {
  sessionId: string | null
  source: RestoreSource | null
}

function normalize(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

export function resolveCouncilSessionRestore(input: RestoreResolutionInput): RestoreResolution {
  const sessionIdFromUrl = normalize(input.sessionIdFromUrl)
  const lastOpenedSessionId = normalize(input.lastOpenedSessionId)
  const currentSessionId = normalize(input.currentSessionId)
  const lastRequestedSessionId = normalize(input.lastRequestedSessionId)
  const hasFreshPaperIntent = Boolean(input.hasArxivParam || input.hasPendingUpload)

  if (sessionIdFromUrl && sessionIdFromUrl !== currentSessionId && sessionIdFromUrl !== lastRequestedSessionId) {
    return { sessionId: sessionIdFromUrl, source: 'url' }
  }

  if (sessionIdFromUrl && sessionIdFromUrl === currentSessionId) {
    return { sessionId: null, source: 'url' }
  }

  if (hasFreshPaperIntent) {
    return { sessionId: null, source: null }
  }

  if (lastOpenedSessionId && lastOpenedSessionId !== currentSessionId && lastOpenedSessionId !== lastRequestedSessionId) {
    return { sessionId: lastOpenedSessionId, source: 'local' }
  }

  if (lastOpenedSessionId && lastOpenedSessionId === currentSessionId) {
    return { sessionId: null, source: 'local' }
  }

  return { sessionId: null, source: null }
}
