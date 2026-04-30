'use client'

import { ToolCall } from '@/types/council'

interface ToolCardProps {
  tool: ToolCall
  agentColor: string
}

function ToolIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" style={{ animation: 'spin 1s linear infinite' }} />
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

// 工具名称的友好显示
const TOOL_LABELS: Record<string, string> = {
  search_arxiv: 'Search arXiv',
  search_semantic_scholar: 'Search Semantic Scholar',
  fetch_paper: 'Fetch Paper',
  analyze_citations: 'Analyze Citations',
  check_methodology: 'Check Methodology',
  verify_claims: 'Verify Claims',
  search_related_work: 'Search Related Work',
}

export function ToolCard({ tool, agentColor }: ToolCardProps) {
  const statusColors = {
    running: agentColor,
    completed: '#22c55e',
    error: '#ef4444',
  }

  const StatusIcon = {
    running: SpinnerIcon,
    completed: CheckIcon,
    error: ErrorIcon,
  }[tool.status]

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        padding: '5px 10px',
        marginBottom: 6,
        marginRight: 6,
        fontSize: 12,
      }}
    >
      <span style={{ color: '#888', display: 'flex' }}>
        <ToolIcon />
      </span>
      <span style={{ color: '#444', fontWeight: 500 }}>
        {TOOL_LABELS[tool.name] || tool.name}
      </span>
      <span style={{ color: statusColors[tool.status], display: 'flex' }}>
        <StatusIcon />
      </span>
    </div>
  )
}
