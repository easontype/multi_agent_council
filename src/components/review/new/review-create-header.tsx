'use client'

import { heroGradientStyle, reviewTheme, sectionEyebrowStyle } from '../review-theme'

interface ReviewCreateHeaderProps {
  hasSource: boolean
}

export function ReviewCreateHeader({ hasSource: _ }: ReviewCreateHeaderProps) {
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
          Step 1 of 2
        </div>
        <h1 style={{
          margin: 0,
          fontSize: 34,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          color: reviewTheme.colors.ink,
          fontFamily: reviewTheme.fonts.display,
        }}>
          Choose a paper and set the review focus.
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
