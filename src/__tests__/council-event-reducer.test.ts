import { applyCouncilServerEvent } from '../lib/council-event-reducer'
import { makeEmptySession } from '../lib/council-session-factory'

describe('council-event-reducer', () => {
  it('preserves citation metadata on tool_result events', () => {
    let session = makeEmptySession('Test Paper', 'Abstract')

    session = applyCouncilServerEvent(session, {
      type: '@@RESET',
      title: 'Test Paper',
      abstract: 'Abstract',
      agents: session.agents,
    })

    session = applyCouncilServerEvent(session, {
      type: 'session_start',
      sessionId: 'sess-1',
    })

    session = applyCouncilServerEvent(session, {
      type: 'turn_start',
      round: 1,
      role: 'Methods Critic',
      model: 'gemini-3.1-flash-lite-preview',
    })

    session = applyCouncilServerEvent(session, {
      type: 'tool_call',
      round: 1,
      role: 'Methods Critic',
      tool: 'rag_query',
      args: { query: 'method details' },
    })

    session = applyCouncilServerEvent(session, {
      type: 'tool_result',
      round: 1,
      role: 'Methods Critic',
      tool: 'rag_query',
      result: 'Evidence result',
      sourceRefs: [
        {
          marker: '[1]',
          label: 'Paper 3',
          uri: 'https://example.com/paper-3',
          snippet: 'Method section snippet',
          chunk_index: 4,
          doc_id: 'doc-1',
          source_type: 'academic',
          similarity_score: 0.873,
          is_heuristic: false,
          authors: ['Alice Smith', 'Bob Jones'],
          year: 2024,
        },
      ],
    })

    expect(session.sourceRefs).toHaveLength(1)
    expect(session.sourceRefs[0]).toMatchObject({
      marker: '[1]',
      label: 'Paper 3',
      uri: 'https://example.com/paper-3',
      snippet: 'Method section snippet',
      chunk_index: 4,
      doc_id: 'doc-1',
      source_type: 'academic',
      similarity_score: 0.873,
      is_heuristic: false,
      authors: ['Alice Smith', 'Bob Jones'],
      year: 2024,
      round: 1,
      agentName: 'Methods Critic',
    })

    expect(session.messages).toHaveLength(1)
    expect(session.messages[0]?.blocks[0]).toMatchObject({
      type: 'tool_use',
      tool: { name: 'rag_query', status: 'completed', output: 'Evidence result' },
    })
  })
})
