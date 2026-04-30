import { hydrateCouncilSessionBundle, mapStoredStatusToReviewPhase } from '../lib/services/council-session-hydrator'

describe('council-session-hydrator', () => {
  it('hydrates persisted turns and evidence into a discussion session', () => {
    const hydrated = hydrateCouncilSessionBundle({
      session: {
        id: 'sess-1',
        title: 'Review: Test Paper',
        topic: 'Test Paper',
        context: 'A short abstract.',
        goal: null,
        status: 'concluded',
        rounds: 1,
        moderator_model: 'gemini-3.1-flash-lite-preview',
        seats: [
          { role: 'Methods Critic', model: 'gemini-3.1-flash-lite-preview', systemPrompt: 'Be critical.' },
        ],
        workspace_id: null,
        created_by_user_id: null,
        owner_agent_id: null,
        owner_api_key_id: null,
        created_at: '2026-04-22T12:00:00.000Z',
        started_at: '2026-04-22T12:01:00.000Z',
        heartbeat_at: '2026-04-22T12:03:00.000Z',
        concluded_at: '2026-04-22T12:05:00.000Z',
        last_error: null,
        run_attempts: 1,
        updated_at: '2026-04-22T12:05:00.000Z',
        divergence_level: 'moderate',
        is_public: false,
      },
      turns: [
        {
          id: 'turn-1',
          session_id: 'sess-1',
          round: 1,
          role: 'Methods Critic',
          model: 'gemini-3.1-flash-lite-preview',
          content: '**Position**\nMethod details are incomplete.',
          input_tokens: 100,
          output_tokens: 80,
          created_at: '2026-04-22T12:02:00.000Z',
        },
      ],
      conclusion: {
        id: 'conc-1',
        session_id: 'sess-1',
        summary: 'Needs stronger method reporting.',
        consensus: null,
        dissent: null,
        action_items: [],
        veto: null,
        confidence: 'medium',
        confidence_reason: null,
        created_at: '2026-04-22T12:05:00.000Z',
      },
      evidence: [
        {
          id: 'ev-1',
          session_id: 'sess-1',
          round: 1,
          role: 'Methods Critic',
          model: 'gemini-3.1-flash-lite-preview',
          tool: 'rag_query',
          runtime_class: 'strict_runtime',
          status: 'completed',
          args: { query: 'method details' },
          result: 'Evidence result',
          source_refs: [{ label: 'Paper §3', uri: null, snippet: 'Method section snippet' }],
          created_at: '2026-04-22T12:01:30.000Z',
          updated_at: '2026-04-22T12:01:40.000Z',
        },
      ],
    })

    expect(hydrated.phase).toBe('concluded')
    expect(hydrated.discussionSession.paperTitle).toBe('Review: Test Paper')
    expect(hydrated.discussionSession.messages).toHaveLength(1)
    expect(hydrated.discussionSession.messages[0]?.blocks[0]).toMatchObject({
      type: 'tool_use',
      tool: { name: 'rag_query', status: 'completed' },
    })
    expect(hydrated.discussionSession.messages[0]?.blocks[1]).toMatchObject({
      type: 'text',
    })
    expect(hydrated.discussionSession.sourceRefs).toHaveLength(1)
    expect(hydrated.discussionSession.alerts?.[0]?.message).toContain('moderate')
  })

  it('maps stored pending sessions without turns back to idle', () => {
    const phase = mapStoredStatusToReviewPhase({
      id: 'sess-2',
      title: 'Review: Pending Paper',
      topic: 'Pending Paper',
      context: null,
      goal: null,
      status: 'pending',
      rounds: 1,
      moderator_model: 'gemini-3.1-flash-lite-preview',
      seats: [],
      workspace_id: null,
      created_by_user_id: null,
      owner_agent_id: null,
      owner_api_key_id: null,
      created_at: '2026-04-22T12:00:00.000Z',
      started_at: null,
      heartbeat_at: null,
      concluded_at: null,
      last_error: null,
      run_attempts: 0,
      updated_at: '2026-04-22T12:00:00.000Z',
      divergence_level: null,
      is_public: false,
    }, false)

    expect(phase).toBe('idle')
  })
})
