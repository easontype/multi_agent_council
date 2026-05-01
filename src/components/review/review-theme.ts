import type { CSSProperties } from 'react'

export const reviewTheme = {
  colors: {
    page: '#f3efe7',
    pageGlow: '#fbfaf6',
    ink: '#1e1b18',
    muted: '#6c665f',
    softMuted: '#9d968d',
    border: '#d9d1c4',
    borderStrong: '#c9bdac',
    panel: 'rgba(255,255,255,0.84)',
    panelStrong: '#fffdf8',
    accent: '#25493d',
    warningBg: '#fff3d9',
    warningBorder: '#efc87b',
    warningText: '#8b5a18',
    errorBg: '#fff0ee',
    errorBorder: '#efb1aa',
    errorText: '#9a2f20',
    infoBg: '#eef5f2',
    infoBorder: '#bfd4c8',
    infoText: '#2f5a49',
    shadow: '0 20px 45px rgba(63, 43, 24, 0.08)',
  },
}

export function softCard(extra?: CSSProperties): CSSProperties {
  return {
    background: reviewTheme.colors.panelStrong,
    border: `1px solid ${reviewTheme.colors.border}`,
    borderRadius: 18,
    boxShadow: '0 8px 24px rgba(63, 43, 24, 0.05)',
    ...extra,
  }
}

export function sectionEyebrowStyle(extra?: CSSProperties): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: reviewTheme.colors.softMuted,
    textTransform: 'uppercase',
    ...extra,
  }
}

export function subtleButtonStyle(extra?: CSSProperties): CSSProperties {
  return {
    border: `1px solid ${reviewTheme.colors.border}`,
    borderRadius: 999,
    background: '#fff',
    color: '#3d3935',
    cursor: 'pointer',
    ...extra,
  }
}
