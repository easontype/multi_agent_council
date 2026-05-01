'use client'

import { reviewTheme, sectionEyebrowStyle, subtleButtonStyle } from '../review-theme'

interface ReviewCreateHeaderProps {
  hasSource: boolean
  activeCount: number
  rounds: 1 | 2
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.84)',
      border: `1px solid ${reviewTheme.colors.border}`,
      boxShadow: '0 4px 14px rgba(63, 43, 24, 0.04)',
    }}>
      <span style={sectionEyebrowStyle()}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: reviewTheme.colors.ink }}>
        {value}
      </span>
    </div>
  )
}

export function ReviewCreateHeader({ hasSource, activeCount, rounds }: ReviewCreateHeaderProps) {
  return (
    <div
      className="review-create-header"
      style={{
        padding: '34px 36px 24px',
        borderBottom: `1px solid ${reviewTheme.colors.border}`,
        background: `radial-gradient(circle at top left, ${reviewTheme.colors.pageGlow} 0%, rgba(255,255,255,0.88) 36%, rgba(243,239,231,0.94) 100%)`,
        flexShrink: 0,
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <div style={sectionEyebrowStyle({ marginBottom: 8 })}>
          New Review
        </div>
        <h1 style={{
          margin: '0 0 8px',
          fontSize: 34,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          color: reviewTheme.colors.ink,
          fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
        }}>
          Stage a paper, shape the panel, then launch the debate.
        </h1>
        <p style={{
          margin: 0,
          maxWidth: 780,
          fontSize: 14.5,
          lineHeight: 1.7,
          color: reviewTheme.colors.muted,
        }}>
          This page is only for creating the review. Once the session starts, Council moves you into the dedicated workspace for live debate, evidence inspection, and export.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatPill label="Paper" value={hasSource ? 'Staged' : 'Required'} />
        <StatPill label="Agents" value={String(activeCount)} />
        <StatPill label="Rounds" value={`${rounds}`} />
      </div>
      <style>{`
        @media (max-width: 900px) {
          .review-create-header {
            padding: 24px 18px 18px !important;
          }
        }
      `}</style>
    </div>
  )
}
