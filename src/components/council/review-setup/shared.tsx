import type { CSSProperties, ReactNode } from 'react'

export function colorAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`
}

export const fieldStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #e4e4e7',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 13,
  color: '#18181b',
  background: '#fff',
  outline: 'none',
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: '#a1a1aa',
      textTransform: 'uppercase',
      marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label style={{
      display: 'block',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.06em',
      color: '#9ca3af',
      textTransform: 'uppercase',
      marginBottom: 7,
    }}>
      {children}
    </label>
  )
}
