const LAST_OPENED_COUNCIL_SESSION_KEY = 'council.lastOpenedSessionId'

export function loadLastOpenedCouncilSessionId(): string | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(LAST_OPENED_COUNCIL_SESSION_KEY)?.trim()
  return value || null
}

export function saveLastOpenedCouncilSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return
  const value = sessionId.trim()
  if (!value) return
  window.localStorage.setItem(LAST_OPENED_COUNCIL_SESSION_KEY, value)
}

export function clearLastOpenedCouncilSessionId(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LAST_OPENED_COUNCIL_SESSION_KEY)
}
