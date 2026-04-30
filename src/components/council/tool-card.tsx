'use client'

import { ToolCall } from '@/types/council'

interface ToolCardProps {
  tool: ToolCall
  agentColor: string
}

function ToolIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function SpinnerIcon({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'tc-spin 0.8s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <style>{`@keyframes tc-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

const TOOL_LABELS: Record<string, string> = {
  rag_query: 'RAG Query',
  semantic_search: 'Semantic Search',
  search_papers: 'Search Papers',
  web_search: 'Web Search',
  fetch_url: 'Fetch URL',
  search_arxiv: 'Search arXiv',
  search_semantic_scholar: 'Search Semantic Scholar',
  fetch_paper: 'Fetch Paper',
  analyze_citations: 'Analyze Citations',
  check_methodology: 'Check Methodology',
  verify_claims: 'Verify Claims',
  search_related_work: 'Search Related Work',
}

export function ToolCard({ tool, agentColor }: ToolCardProps) {
  const StatusIcon = tool.status === 'running'
    ? () => <SpinnerIcon color={agentColor} />
    : tool.status === 'completed'
    ? CheckIcon
    : ErrorIcon
  const statusColor = tool.status === 'completed'
    ? '#16a34a'
    : tool.status === 'error'
    ? '#dc2626'
    : agentColor

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: '#fafafa', border: '1px solid #ebebed',
      borderRadius: 6, padding: '4px 10px',
      marginBottom: 5, marginRight: 5, fontSize: 12,
    }}>
      <span style={{ color: '#a1a1aa', display: 'flex' }}><ToolIcon /></span>
      <span style={{ color: '#3f3f46', fontWeight: 500 }}>
        {TOOL_LABELS[tool.name] || tool.name.replace(/_/g, ' ')}
      </span>
      <span style={{ display: 'flex', color: statusColor }}><StatusIcon /></span>
    </div>
  )
}
