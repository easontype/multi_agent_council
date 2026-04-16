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
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 200ms ease',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  )
}

export function ThinkingBlock({ content, isStreaming, agentColor }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)

  // 截取前 80 字符作为摘要
  const summary = content.length > 80 ? content.slice(0, 80) + '...' : content

  return (
    <div
      style={{
        background: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      {/* 折叠标题 */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ color: agentColor, display: 'flex' }}>
          <BrainIcon />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>
          Thinking
          {isStreaming && (
            <span style={{ marginLeft: 6, color: agentColor }}>
              <span className="streaming-dots">...</span>
            </span>
          )}
        </span>
        <span style={{ marginLeft: 'auto', color: '#999', display: 'flex' }}>
          <ChevronIcon open={expanded} />
        </span>
      </button>

      {/* 内容区域 */}
      <div
        style={{
          maxHeight: expanded ? 400 : 0,
          overflow: 'hidden',
          transition: 'max-height 250ms ease',
        }}
      >
        <div
          style={{
            padding: '0 12px 12px',
            fontSize: 13,
            color: '#555',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            fontStyle: 'italic',
            borderTop: '1px solid #e9ecef',
            paddingTop: 10,
          }}
        >
          {content}
          {isStreaming && <span className="cursor">|</span>}
        </div>
      </div>

      {/* 收起时显示摘要 */}
      {!expanded && content && (
        <div
          style={{
            padding: '0 12px 10px',
            fontSize: 12,
            color: '#888',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {summary}
        </div>
      )}

      <style jsx>{`
        .streaming-dots {
          animation: blink 1s infinite;
        }
        .cursor {
          animation: blink 0.8s infinite;
          color: ${agentColor};
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
