'use client'

import { useCallback } from 'react'

/**
 * useSessionStream
 *
 * Responsible solely for SSE transport: opens a POST to the run endpoint,
 * reads the NDJSON/SSE stream, and fires `onEvent` for every parsed event
 * object. Lifecycle signals (done / error) are surfaced via `onDone` /
 * `onError` so the caller keeps full control of React state.
 */
export function useSessionStream() {
  const run = useCallback(async (
    sessionId: string,
    onEvent: (event: Record<string, unknown>) => void,
    onDone: () => void,
    onError: (message: string) => void,
  ): Promise<void> => {
    let res: Response
    try {
      res = await fetch(`/api/sessions/${sessionId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Network error')
      return
    }

    if (!res.ok || !res.body) {
      const d = await res.json().catch(() => ({}))
      onError((d as { error?: string }).error ?? `HTTP ${res.status}`)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          let event: Record<string, unknown>
          try { event = JSON.parse(raw) } catch { continue }

          onEvent(event)
        }
      }

      onDone()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Stream error')
    }
  }, [])

  return { run }
}
