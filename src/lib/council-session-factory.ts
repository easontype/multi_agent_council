/**
 * council-session-factory.ts
 *
 * Shared factory for creating an empty DiscussionSession.
 * Extracted so it can be used by both the hook and the pure event reducer.
 */

import type { AgentUI } from '@/types/agent'
import type { DiscussionSession } from '@/types/council'
import { DEFAULT_AGENTS } from '@/types/council'

export function makeEmptySession(
  title = '',
  abstract = '',
  agents: AgentUI[] = DEFAULT_AGENTS,
): DiscussionSession {
  return {
    id: '',
    paperId: '',
    paperTitle: title,
    paperAbstract: abstract,
    status: 'waiting',
    agents,
    messages: [],
    sourceRefs: [],
    alerts: [],
    startedAt: new Date(),
  }
}
