import { resolveCouncilSessionRestore } from '../lib/services/council-session-restore'

describe('resolveCouncilSessionRestore', () => {
  it('prefers the explicit session query param over local history', () => {
    expect(resolveCouncilSessionRestore({
      sessionIdFromUrl: 'sess-url',
      lastOpenedSessionId: 'sess-local',
    })).toEqual({
      sessionId: 'sess-url',
      source: 'url',
    })
  })

  it('does not auto-restore local history when a new paper intent exists', () => {
    expect(resolveCouncilSessionRestore({
      lastOpenedSessionId: 'sess-local',
      hasArxivParam: true,
    })).toEqual({
      sessionId: null,
      source: null,
    })
  })

  it('falls back to last opened session when there is no explicit session or fresh paper intent', () => {
    expect(resolveCouncilSessionRestore({
      lastOpenedSessionId: 'sess-local',
    })).toEqual({
      sessionId: 'sess-local',
      source: 'local',
    })
  })

  it('does not request restore again when the requested session is already loaded', () => {
    expect(resolveCouncilSessionRestore({
      sessionIdFromUrl: 'sess-1',
      currentSessionId: 'sess-1',
      lastOpenedSessionId: 'sess-2',
    })).toEqual({
      sessionId: null,
      source: 'url',
    })
  })

  it('preserves local restore source after the saved session has already been loaded', () => {
    expect(resolveCouncilSessionRestore({
      lastOpenedSessionId: 'sess-local',
      currentSessionId: 'sess-local',
    })).toEqual({
      sessionId: null,
      source: 'local',
    })
  })

  it('does not request the same restore twice in a row', () => {
    expect(resolveCouncilSessionRestore({
      sessionIdFromUrl: 'sess-1',
      lastRequestedSessionId: 'sess-1',
    })).toEqual({
      sessionId: null,
      source: null,
    })
  })
})
