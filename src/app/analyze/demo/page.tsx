'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DiscussionTimeline } from '@/components/council/discussion-timeline'
import { useStreamingDemo } from '@/hooks/use-streaming-demo'

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M19 12H5" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  )
}

export default function AnalyzePage() {
  const searchParams = useSearchParams()
  const arxivId = searchParams.get('arxiv') || '2401.12345'

  // Demo 数据
  const paperTitle = 'Attention Is All You Need: Revisiting Transformer Architectures for Efficient Inference'
  const paperAbstract = 'We present a novel modification to the standard transformer attention mechanism that reduces computational complexity from O(n²) to O(n log n) while maintaining model quality. Our approach introduces a learned sparse attention pattern that dynamically adapts to input characteristics.'

  const { session, isRunning, startDiscussion } = useStreamingDemo(paperTitle, paperAbstract)
  const [hasStarted, setHasStarted] = useState(false)

  const handleStart = () => {
    setHasStarted(true)
    startDiscussion()
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      background: '#fff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#666',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
              padding: '6px 10px',
              borderRadius: 6,
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <BackIcon />
            Back
          </a>
          <div style={{ width: 1, height: 20, background: '#e5e5e5' }} />
          <span style={{ fontSize: 13, color: '#888' }}>
            arXiv: <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{arxivId}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Status badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              background: session.status === 'discussing' ? '#fef3c7' : session.status === 'concluded' ? '#dcfce7' : '#f3f4f6',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              color: session.status === 'discussing' ? '#92400e' : session.status === 'concluded' ? '#166534' : '#666',
            }}
          >
            {session.status === 'discussing' && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1s infinite' }} />
            )}
            {session.status === 'waiting' && 'Ready'}
            {session.status === 'discussing' && 'In Progress'}
            {session.status === 'concluded' && 'Completed'}
          </div>

          {/* Start button */}
          {!hasStarted && (
            <button
              onClick={handleStart}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#4f46e5' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#6366f1' }}
            >
              <PlayIcon />
              Start Discussion
            </button>
          )}

          {isRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6366f1' }}>
              <SpinnerIcon />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Processing...</span>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <DiscussionTimeline session={session} />

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
