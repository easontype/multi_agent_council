'use client'

import { useEffect, useRef } from 'react'
import { DiscussionSession } from '@/types/council'
import { getSourceRefDisplayUrl, isVisibleSourceRef } from '@/lib/evidence-annotations'

interface SourcePanelProps {
  session: DiscussionSession
  activeLabel?: string | null
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

export function SourcePanel({ session, activeLabel }: SourcePanelProps) {
  const sourceRefs = (session.sourceRefs ?? []).filter(isVisibleSourceRef)
  const isActive = session.status !== 'waiting'
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (!activeLabel) return
    const index = sourceRefs.findIndex((ref) =>
      ref.label === activeLabel ||
      ref.uri === activeLabel ||
      ref.label.toLowerCase().includes(activeLabel.toLowerCase().slice(0, 40)) ||
      (ref.uri && activeLabel.toLowerCase().includes(ref.uri.toLowerCase()))
    )
    if (index === -1) return
    const element = cardRefs.current.get(index)
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeLabel, sourceRefs])

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '18px', background: '#fafafa' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid #ececf1',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid #ececf1',
              background: '#fcfcfb',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ color: '#a1a1aa', display: 'flex' }}><BookOpenIcon /></span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase' }}>
              Paper &amp; Sources
            </span>
          </div>

          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ color: '#a1a1aa', display: 'flex' }}><FileTextIcon /></span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: '#a1a1aa', textTransform: 'uppercase' }}>
                Under Review
              </span>
            </div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#18181b',
                lineHeight: 1.5,
                margin: '0 0 10px',
                fontFamily: "'Georgia', 'Times New Roman', serif",
                letterSpacing: '-0.015em',
              }}
            >
              {session.paperTitle}
            </h2>
            {session.paperAbstract && (
              <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.7, margin: 0 }}>
                {session.paperAbstract}
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #ececf1',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid #ececf1',
              background: '#fcfcfb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase' }}>
              Detailed Evidence
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                background: '#f0f0f2',
                color: '#71717a',
                borderRadius: 999,
                padding: '2px 7px',
              }}
            >
              {sourceRefs.length}
            </span>
          </div>

          <div style={{ padding: '12px 14px 14px' }}>
            {!isActive ? (
              <div
                style={{
                  padding: '24px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  color: '#a1a1aa',
                  textAlign: 'center',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            ) : sourceRefs.length === 0 ? (
              <div style={{ fontSize: 12, color: '#a1a1aa', padding: '8px 0' }}>No citations yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sourceRefs.map((ref, index) => {
                  const displayUrl = getSourceRefDisplayUrl(ref)
                  const refIsActive = Boolean(activeLabel && (
                    ref.label === activeLabel ||
                    ref.uri === activeLabel ||
                    ref.label.toLowerCase().includes(activeLabel.toLowerCase().slice(0, 40)) ||
                    (ref.uri && activeLabel.toLowerCase().includes(ref.uri.toLowerCase()))
                  ))

                  return (
                    <div
                      key={index}
                      ref={(element) => {
                        if (element) cardRefs.current.set(index, element)
                        else cardRefs.current.delete(index)
                      }}
                      style={{
                        background: refIsActive ? `${ref.agentColor}08` : '#fff',
                        border: `1px solid ${refIsActive ? `${ref.agentColor}55` : '#ececf1'}`,
                        borderLeft: `3px solid ${ref.agentColor}`,
                        borderRadius: '0 10px 10px 0',
                        padding: '12px 12px',
                        cursor: ref.uri ? 'pointer' : 'default',
                        transition: 'box-shadow 150ms, background 200ms, border-color 200ms',
                        boxShadow: refIsActive ? `0 0 0 2px ${ref.agentColor}22` : 'none',
                      }}
                      onClick={() => ref.uri && window.open(ref.uri, '_blank', 'noopener')}
                      onMouseEnter={(event) => {
                        if (!refIsActive) (event.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'
                      }}
                      onMouseLeave={(event) => {
                        if (!refIsActive) (event.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '999px',
                            background: ref.agentColor,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 8,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {ref.agentAvatar}
                        </span>
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: '#18181b',
                            flex: 1,
                            fontFamily: "'Georgia', 'Times New Roman', serif",
                            lineHeight: 1.45,
                          }}
                        >
                          {ref.marker ? `${ref.marker} ` : ''}{ref.label}
                        </span>
                          {ref.uri && (
                            <span style={{ color: '#a1a1aa', display: 'flex' }}>
                              <ExternalLinkIcon />
                            </span>
                          )}
                        </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#71717a',
                            background: '#f8f8fa',
                            border: '1px solid #ececf1',
                            borderRadius: 999,
                            padding: '3px 7px',
                          }}
                        >
                          cited by {ref.agentName}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#71717a',
                            background: '#f8f8fa',
                            border: '1px solid #ececf1',
                            borderRadius: 999,
                            padding: '3px 7px',
                          }}
                        >
                          Round {ref.round === 99 ? 'Synthesis' : ref.round}
                        </span>
                        {displayUrl && (
                          <span style={{ fontSize: 10, color: '#71717a' }}>{displayUrl}</span>
                        )}
                      </div>

                      {ref.snippet && (
                        <div
                          style={{
                            background: '#fcfcfb',
                            border: '1px solid #ececf1',
                            borderRadius: 8,
                            padding: '10px 11px',
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 5 }}>
                            Retrieved Quote
                          </div>
                          <p style={{ fontSize: 12, color: '#52525b', lineHeight: 1.65, margin: 0 }}>
                            "{ref.snippet}"
                          </p>
                        </div>
                      )}

                      {ref.uri && (
                        <div style={{ fontSize: 11, color: '#355d7a', textDecoration: 'underline' }}>
                          Open original source
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {session.status === 'concluded' && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1, color: '#16a34a' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d', marginBottom: 3 }}>Review concluded</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
