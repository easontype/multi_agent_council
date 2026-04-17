'use client'

import { DiscussionSession } from '@/types/council'

interface SourcePanelProps {
  session: DiscussionSession
}

function FileTextIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function BookOpenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

export function SourcePanel({ session }: SourcePanelProps) {
  const sourceRefs = session.sourceRefs ?? []
  const isActive = session.status !== 'waiting'

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 18px 32px' }}>

      {/* Panel label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <span style={{ color: '#aaa', display: 'flex' }}><BookOpenIcon /></span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#aaa', textTransform: 'uppercase' }}>
          Paper &amp; Sources
        </span>
      </div>

      {/* Paper card */}
      <div style={{
        background: '#fff',
        border: '1px solid #ebebed',
        borderRadius: 10,
        padding: '14px 16px',
        marginBottom: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ color: '#bbb', display: 'flex' }}><FileTextIcon /></span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: '#bbb', textTransform: 'uppercase' }}>
            Under Review
          </span>
        </div>
        <h2 style={{
          fontSize: 15, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.5, margin: '0 0 10px',
          fontFamily: "'Georgia', 'Times New Roman', serif", letterSpacing: '-0.01em',
        }}>
          {session.paperTitle}
        </h2>
        {session.paperAbstract && (
          <p style={{ fontSize: 12.5, color: '#666', lineHeight: 1.7, margin: 0 }}>
            {session.paperAbstract}
          </p>
        )}
      </div>

      {/* Cited Sources section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#aaa', textTransform: 'uppercase' }}>
            Cited Sources
          </span>
          {sourceRefs.length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              background: '#f0f0f2', color: '#888',
              borderRadius: 4, padding: '1px 6px',
            }}>
              {sourceRefs.length}
            </span>
          )}
        </div>

        {!isActive ? (
          <div style={{
            padding: '20px 0',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            color: '#ccc', textAlign: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span style={{ fontSize: 12.5, lineHeight: 1.6, color: '#bbb' }}>
              Sources cited by reviewers<br />will appear here
            </span>
          </div>
        ) : sourceRefs.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#bbb', padding: '8px 0', lineHeight: 1.6 }}>
            Awaiting first citations…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sourceRefs.map((ref, i) => (
              <div key={i} style={{
                background: '#fff',
                border: '1px solid #ebebed',
                borderLeft: `3px solid ${ref.agentColor}`,
                borderRadius: 8,
                padding: '10px 12px',
                cursor: ref.uri ? 'pointer' : 'default',
                transition: 'box-shadow 150ms',
              }}
                onClick={() => ref.uri && window.open(ref.uri, '_blank', 'noopener')}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: ref.agentColor, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, flexShrink: 0,
                  }}>
                    {ref.agentAvatar}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', flex: 1 }}>
                    {ref.label}
                  </span>
                  {ref.uri && (
                    <span style={{ color: '#ccc', display: 'flex', transition: 'color 150ms' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.color = '#555' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.color = '#ccc' }}
                    >
                      <ExternalLinkIcon />
                    </span>
                  )}
                </div>
                {ref.snippet && (
                  <p style={{ fontSize: 12, color: '#777', lineHeight: 1.6, margin: 0 }}>
                    {ref.snippet}
                  </p>
                )}
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: '#bbb', fontWeight: 400 }}>
                    cited by {ref.agentName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verdict banner */}
      {session.status === 'concluded' && (
        <div style={{
          marginTop: 20,
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d', marginBottom: 3 }}>Review concluded</div>
            <div style={{ fontSize: 12, color: '#4ade80' === '#4ade80' ? '#166534' : '#166534', lineHeight: 1.55 }}>
              All reviewers submitted assessments. Check the debate panel for the full verdict.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
