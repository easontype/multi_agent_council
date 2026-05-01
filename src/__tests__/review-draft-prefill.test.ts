import type { CouncilSession } from '@/lib/core/council-types'
import {
  buildDraftPrefillFromSession,
  extractArxivIdFromSource,
  extractSourceUrl,
} from '@/lib/review-draft-prefill'

function makeSession(overrides: Partial<CouncilSession> = {}): CouncilSession {
  return {
    id: 'session-1',
    title: 'Test Paper',
    topic: 'Academic peer review of: Test Paper',
    context: 'Source: https://arxiv.org/abs/1706.03762. Library: lib-1',
    goal: 'Provide rigorous multi-perspective academic critique.',
    status: 'concluded',
    rounds: 2,
    moderator_model: 'model-x',
    seats: [
      { role: 'Methods Critic', model: 'm1', systemPrompt: 'p1', tools: ['rag_query'] },
      { role: 'Literature Auditor', model: 'm2', systemPrompt: 'p2', tools: ['search_papers'] },
    ],
    workspace_id: null,
    created_by_user_id: null,
    owner_agent_id: null,
    owner_api_key_id: null,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    heartbeat_at: null,
    concluded_at: new Date().toISOString(),
    last_error: null,
    run_attempts: 1,
    updated_at: new Date().toISOString(),
    divergence_level: null,
    is_public: false,
    ...overrides,
  }
}

describe('review draft prefill helpers', () => {
  it('extracts source url and arxiv id from session context', () => {
    const sourceUrl = extractSourceUrl('Source: https://arxiv.org/pdf/1706.03762.pdf. Library: lib-1')
    expect(sourceUrl).toBe('https://arxiv.org/pdf/1706.03762.pdf')
    expect(extractArxivIdFromSource(sourceUrl)).toBe('1706.03762')
  })

  it('builds arxiv-prefilled draft state from a saved session', () => {
    const prefill = buildDraftPrefillFromSession(makeSession())
    expect(prefill.mode).toBe('critique')
    expect(prefill.rounds).toBe(2)
    expect(prefill.arxivId).toBe('1706.03762')
    expect(prefill.sourceType).toBe('arxiv')
    expect(prefill.agents).toHaveLength(2)
  })

  it('flags upload sessions for manual re-upload', () => {
    const uploadSession = makeSession({ context: 'Source: upload. Library: lib-1' })
    const prefill = buildDraftPrefillFromSession(uploadSession)
    expect(prefill.sourceType).toBe('upload')
    expect(prefill.notice).toMatch(/Re-upload the paper/i)
  })
})
