'use client'

import type { CSSProperties, ReactNode } from 'react'
import {
  pageGradientStyle,
  panelHeaderStyle,
  pillStyle,
  primaryButtonStyle,
  reviewTheme,
  sectionEyebrowStyle,
  softCard,
  subtleButtonStyle,
} from './review-theme'

export function ReviewPageBody({
  className,
  children,
  padding = '24px 28px 32px',
}: {
  className?: string
  children: ReactNode
  padding?: CSSProperties['padding']
}) {
  return (
    <div
      className={className}
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: 'auto',
        padding,
        ...pageGradientStyle(),
      }}
    >
      {children}
    </div>
  )
}

export function ReviewStatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={pillStyle()}>
      <span style={sectionEyebrowStyle()}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: reviewTheme.colors.ink }}>
        {value}
      </span>
    </div>
  )
}

export function ReviewSectionFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section style={{ ...softCard(), overflow: 'hidden' }}>
      <div style={panelHeaderStyle()}>
        <div style={sectionEyebrowStyle({ marginBottom: 6 })}>
          {eyebrow}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: reviewTheme.colors.ink, marginBottom: 5 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.65, color: reviewTheme.colors.muted, maxWidth: 720 }}>
          {description}
        </div>
      </div>
      {children}
    </section>
  )
}

export function ReviewRailCard({
  eyebrow,
  children,
  accent = false,
}: {
  eyebrow: string
  children: ReactNode
  accent?: boolean
}) {
  if (accent) {
    return (
      <section
        style={{
          background: `linear-gradient(180deg, ${reviewTheme.colors.accent} 0%, #183128 100%)`,
          color: '#fff',
          borderRadius: 24,
          padding: '20px 18px 18px',
          boxShadow: '0 18px 40px rgba(26, 51, 41, 0.24)',
        }}
      >
        <div style={sectionEyebrowStyle({ color: 'rgba(255,255,255,0.58)', marginBottom: 6 })}>
          {eyebrow}
        </div>
        {children}
      </section>
    )
  }

  return (
    <section style={softCard({ padding: '16px 16px 14px' })}>
      <div style={sectionEyebrowStyle({ marginBottom: 10 })}>
        {eyebrow}
      </div>
      {children}
    </section>
  )
}

export function ReviewSummaryItem({
  label,
  value,
  tone = '#18181b',
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={sectionEyebrowStyle()}>
        {label}
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.55, color: tone, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )
}

export function ReviewActionButton({
  children,
  disabled,
  onClick,
  variant = 'subtle',
  style,
}: {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
  variant?: 'primary' | 'subtle'
  style?: CSSProperties
}) {
  const baseStyle = variant === 'primary'
    ? primaryButtonStyle()
    : subtleButtonStyle()

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...baseStyle,
        ...(disabled
          ? {
              cursor: 'default',
              background: variant === 'primary' ? reviewTheme.colors.borderStrong : '#fff',
              color: variant === 'primary' ? 'rgba(255,255,255,0.7)' : reviewTheme.colors.softMuted,
            }
          : {}),
        ...style,
      }}
    >
      {children}
    </button>
  )
}
