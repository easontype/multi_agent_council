'use client'

import { useState, useReducer, useCallback } from 'react'
import { Agent, DEFAULT_AGENTS } from '@/types/council'
import { takePendingUpload } from '@/lib/pending-upload'
import type { CouncilSeat } from '@/lib/core/council-types'
import type { ReviewPhase } from '@/lib/council-review-phase'
import { loadCouncilSession } from '@/lib/services/council-session-service'
import { useSessionStream } from './use-session-stream'
import { applyCouncilServerEvent } from '@/lib/council-event-reducer'
import { makeEmptySession } from '@/lib/council-session-factory'

export type { ReviewPhase } from '@/lib/council-review-phase'

export function useCouncilReview(arxivIdParam?: string | null) {
  const [phase, setPhase] = useState<ReviewPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [session, dispatch] = useReducer(applyCouncilServerEvent, makeEmptySession())
  const [isRestoring, setIsRestoring] = useState(false)
  const [canResume, setCanResume] = useState(false)

  const { run: runStream } = useSessionStream()

  // ─── Event dispatch ──────────────────────────────────────────────────────────

  function handleEvent(event: Record<string, unknown>) {
    const type = event.type as string

    // Delegate all session-shape transitions to the pure reducer
    dispatch(event)

    // Handle the two events that also update phase/error/canResume
    if (type === 'session_done') {
      setPhase('concluded')
      setCanResume(false)
      return
    }

    if (type === 'error') {
      setError(event.message as string)
      setPhase('error')
      setCanResume(false)
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  const start = useCallback(async (opts?: {
    mode?: 'critique' | 'gap'
    rounds?: 1 | 2
    customSeats?: CouncilSeat[]
    discussionAgents?: Agent[]
    topic?: string
    goal?: string
    topicPresetId?: string
  }) => {
    setError(null)
    setPhase('ingesting')

    const mode = opts?.mode ?? 'critique'
    const rounds = opts?.rounds ?? 1
    const customSeats = opts?.customSeats ?? []
    const discussionAgents = opts?.discussionAgents?.length ? opts.discussionAgents : DEFAULT_AGENTS

    let sessionId: string
    let paperTitle: string
    let paperAbstract: string

    try {
      const pendingFile = takePendingUpload()

      let body: BodyInit
      let headers: Record<string, string> = {}

      if (pendingFile) {
        const form = new FormData()
        form.append('file', pendingFile)
        form.append('mode', mode)
        form.append('rounds', String(rounds))
        if (opts?.topic) form.append('topic', opts.topic)
        if (opts?.goal) form.append('goal', opts.goal)
        if (opts?.topicPresetId) form.append('topicPresetId', opts.topicPresetId)
        if (customSeats.length) {
          form.append('customSeats', JSON.stringify(customSeats))
        }
        body = form
      } else if (arxivIdParam) {
        body = JSON.stringify({
          arxivId: arxivIdParam,
          mode,
          rounds,
          customSeats,
          topic: opts?.topic,
          goal: opts?.goal,
          topicPresetId: opts?.topicPresetId,
        })
        headers = { 'Content-Type': 'application/json' }
      } else {
        throw new Error('No paper provided')
      }

      const res = await fetch('/api/papers/upload', { method: 'POST', body, headers })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      sessionId = data.sessionId
      paperTitle = data.paperTitle
      paperAbstract = data.paperAbstract ?? ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest paper')
      setPhase('error')
      return
    }

    // Reset session state with the correct agents/title/abstract before streaming
    dispatch({ type: '@@RESET', title: paperTitle, abstract: paperAbstract, agents: discussionAgents })
    setPhase('running')
    setCanResume(false)

    let streamErrored = false
    await runStream(
      sessionId,
      (event) => {
        if ((event as Record<string, unknown>).type === 'error') streamErrored = true
        handleEvent(event as Record<string, unknown>)
      },
      () => {
        if (streamErrored) {
          dispatch({ type: '@@COMPLETE_MESSAGES' })
          return
        }
        setPhase('concluded')
        setCanResume(false)
        dispatch({ type: '@@STREAM_DONE' })
      },
      (message) => {
        streamErrored = true
        setError(message)
        setPhase('error')
        dispatch({ type: '@@COMPLETE_MESSAGES' })
      },
      {},
    )
  }, [arxivIdParam, runStream])

  const loadSession = useCallback(async (sessionId: string) => {
    setError(null)
    setIsRestoring(true)

    try {
      const loaded = await loadCouncilSession(sessionId)
      dispatch({ type: '@@LOAD', session: loaded.discussionSession })
      setPhase(loaded.phase)
      setCanResume(loaded.isResumable)
      return true
    } catch (err) {
      dispatch({ type: '@@RESET' })
      setError(err instanceof Error ? err.message : 'Failed to load saved review')
      setPhase('error')
      setCanResume(false)
      return false
    } finally {
      setIsRestoring(false)
    }
  }, [])

  const resumeSession = useCallback(async (sessionId: string) => {
    setError(null)
    setIsRestoring(true)

    try {
      const loaded = await loadCouncilSession(sessionId)
      dispatch({ type: '@@LOAD', session: loaded.discussionSession })
      setPhase(loaded.phase)
      setCanResume(loaded.isResumable)
      if (!loaded.isResumable) return true

      const paperTitle = loaded.discussionSession.paperTitle
      const paperAbstract = loaded.discussionSession.paperAbstract ?? ''
      const discussionAgents = loaded.discussionSession.agents
      setPhase('running')
      setCanResume(false)

      let streamErrored = false
      await runStream(
        sessionId,
        (event) => {
          if ((event as Record<string, unknown>).type === 'error') streamErrored = true
          handleEvent(event as Record<string, unknown>)
        },
        () => {
          if (streamErrored) {
            dispatch({ type: '@@COMPLETE_MESSAGES' })
            return
          }
          setPhase('concluded')
          setCanResume(false)
          dispatch({ type: '@@STREAM_DONE' })
        },
        (message) => {
          streamErrored = true
          setError(message)
          setPhase('error')
          dispatch({ type: '@@COMPLETE_MESSAGES' })
        },
        { resume: true },
      )
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume saved review')
      setPhase('error')
      setCanResume(false)
      return false
    } finally {
      setIsRestoring(false)
    }
  }, [runStream])

  const rerunSession = useCallback(async (sessionId: string) => {
    setError(null)
    setPhase('running')
    setCanResume(false)
    dispatch({
      type: '@@RESET',
      title: session.paperTitle,
      abstract: session.paperAbstract ?? '',
      agents: session.agents,
    })

    let streamErrored = false
    await runStream(
      sessionId,
      (event) => {
        if ((event as Record<string, unknown>).type === 'error') streamErrored = true
        handleEvent(event as Record<string, unknown>)
      },
      () => {
        if (streamErrored) {
          dispatch({ type: '@@COMPLETE_MESSAGES' })
          return
        }
        setPhase('concluded')
        setCanResume(false)
        dispatch({ type: '@@STREAM_DONE' })
      },
      (message) => {
        streamErrored = true
        setError(message)
        setPhase('error')
        dispatch({ type: '@@COMPLETE_MESSAGES' })
      },
      { forceRestart: true },
    )
  }, [runStream, session.agents, session.paperAbstract, session.paperTitle])

  return { session, phase, error, isRestoring, canResume, start, loadSession, resumeSession, rerunSession }
}
