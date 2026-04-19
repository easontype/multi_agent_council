'use client'

import { useState } from 'react'

interface ThinkingBlockProps {
  content: string
  isStreaming?: boolean
  agentColor: string
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
    </svg>
  )
}

export function ThinkingBlock({ content, isStreaming, agentColor }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const summary = content.length > 72 ? `${content.slice(0, 72)}...` : content

  return (
    <div style={{
      background: '#fafafa',
      border: '1px solid #ebebed',
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ color: agentColor, opacity: 0.8, display: 'flex' }}><BrainIcon /></span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.05em' }}>
          Thinking
          {isStreaming && (
            <span style={{ marginLeft: 4, color: agentColor, animation: 'tb-blink 1s infinite' }}>Live</span>
          )}
        </span>
        <span style={{ marginLeft: 'auto', color: '#a1a1aa', display: 'flex' }}>
          <ChevronIcon open={expanded} />
        </span>
      </button>

      <div style={{ maxHeight: expanded ? 280 : 0, overflow: 'hidden', transition: 'max-height 250ms ease' }}>
        <div style={{
          padding: '8px 12px 12px',
          fontSize: 13,
          color: '#52525b',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          fontStyle: 'italic',
          borderTop: '1px solid #ebebed',
        }}>
          {content}
        </div>
      </div>

      {!expanded && content && (
        <div style={{
          padding: '0 12px 8px',
          fontSize: 12,
          color: '#a1a1aa',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontStyle: 'italic',
        }}>
          {summary}
        </div>
      )}

      <style>{`@keyframes tb-blink { 0%,50% { opacity:1; } 51%,100% { opacity:0; } }`}</style>
    </div>
  )
}
