'use client'

import { ReviewStatPill } from '../review-primitives'
import { heroGradientStyle, reviewTheme, sectionEyebrowStyle } from '../review-theme'

interface ReviewCreateHeaderProps {
  hasSource: boolean
  activeCount: number
  rounds: 1 | 2
}

export function ReviewCreateHeader({ hasSource, activeCount, rounds }: ReviewCreateHeaderProps) {
  return (
    <div
      className="review-create-header"
      style={{
        padding: '34px 36px 24px',
        borderBottom: `1px solid ${reviewTheme.colors.border}`,
        ...heroGradientStyle(),
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
          fontFamily: reviewTheme.fonts.display,
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
        <ReviewStatPill label="Paper" value={hasSource ? 'Staged' : 'Required'} />
        <ReviewStatPill label="Agents" value={String(activeCount)} />
        <ReviewStatPill label="Rounds" value={`${rounds}`} />
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
