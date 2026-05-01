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
  fonts: {
    body: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    display: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
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

export function pageGradientStyle(extra?: CSSProperties): CSSProperties {
  return {
    background: `linear-gradient(180deg, ${reviewTheme.colors.pageGlow} 0%, ${reviewTheme.colors.page} 100%)`,
    ...extra,
  }
}

export function heroGradientStyle(extra?: CSSProperties): CSSProperties {
  return {
    background: `radial-gradient(circle at top left, ${reviewTheme.colors.pageGlow} 0%, rgba(255,255,255,0.9) 38%, rgba(243,239,231,0.94) 100%)`,
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

export function pillStyle(extra?: CSSProperties): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.84)',
    border: `1px solid ${reviewTheme.colors.border}`,
    boxShadow: '0 4px 14px rgba(63, 43, 24, 0.04)',
    ...extra,
  }
}

export function primaryButtonStyle(extra?: CSSProperties): CSSProperties {
  return {
    border: 'none',
    borderRadius: 12,
    padding: '13px 14px',
    background: reviewTheme.colors.accent,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    ...extra,
  }
}

export function panelHeaderStyle(extra?: CSSProperties): CSSProperties {
  return {
    padding: '18px 20px 16px',
    borderBottom: `1px solid ${reviewTheme.colors.border}`,
    background: 'linear-gradient(180deg, rgba(248,242,232,0.7) 0%, rgba(255,255,255,0.92) 100%)',
    ...extra,
  }
}
