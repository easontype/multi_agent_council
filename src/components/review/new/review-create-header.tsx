'use client'

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
      <div>
        <div style={sectionEyebrowStyle({ marginBottom: 8 })}>
          New Review
        </div>
        <h1 style={{
          margin: 0,
          fontSize: 34,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          color: reviewTheme.colors.ink,
          fontFamily: reviewTheme.fonts.display,
        }}>
          Stage a paper, shape the panel, then launch the debate.
        </h1>
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
