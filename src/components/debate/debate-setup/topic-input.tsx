'use client'

import { reviewTheme } from '@/components/review/review-theme'

interface TopicInputProps {
  optionA: string
  optionB: string
  context: string
  onOptionAChange: (v: string) => void
  onOptionBChange: (v: string) => void
  onContextChange: (v: string) => void
}

const inputStyle = {
  border: `1px solid ${reviewTheme.colors.borderStrong}`,
  borderRadius: 10,
  padding: '11px 13px',
  fontSize: 14,
  fontWeight: 600,
  color: reviewTheme.colors.ink,
  outline: 'none',
  background: '#fffdfa',
  width: '100%',
  boxSizing: 'border-box' as const,
}

export function TopicInput({
  optionA,
  optionB,
  context,
  onOptionAChange,
  onOptionBChange,
  onContextChange,
}: TopicInputProps) {
  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        border: `1px solid ${reviewTheme.colors.border}`,
        borderRadius: 16,
        background: '#fff',
        padding: '20px',
        marginBottom: 14,
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase' as const,
          color: reviewTheme.colors.softMuted,
          marginBottom: 14,
        }}>
          Compare
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: '#4a6b73', textTransform: 'uppercase' as const, marginBottom: 6 }}>
              Option A
            </div>
            <input
              type="text"
              value={optionA}
              onChange={(e) => onOptionAChange(e.target.value)}
              placeholder="e.g. MXene"
              style={{ ...inputStyle, borderColor: optionA ? '#4a6b73' : reviewTheme.colors.borderStrong }}
            />
          </div>

          <div style={{
            fontSize: 16,
            fontWeight: 700,
            color: reviewTheme.colors.softMuted,
            flexShrink: 0,
            paddingTop: 20,
          }}>
            vs
          </div>

          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: '#7a4c54', textTransform: 'uppercase' as const, marginBottom: 6 }}>
              Option B
            </div>
            <input
              type="text"
              value={optionB}
              onChange={(e) => onOptionBChange(e.target.value)}
              placeholder="e.g. Graphene"
              style={{ ...inputStyle, borderColor: optionB ? '#7a4c54' : reviewTheme.colors.borderStrong }}
            />
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: reviewTheme.colors.muted, marginBottom: 7 }}>
          Background context <span style={{ fontWeight: 400, color: reviewTheme.colors.softMuted }}>(optional)</span>
        </div>
        <textarea
          value={context}
          onChange={(e) => onContextChange(e.target.value)}
          placeholder="e.g. Comparing electrode materials for flexible sensor applications..."
          rows={3}
          style={{
            border: `1px solid ${reviewTheme.colors.border}`,
            borderRadius: 12,
            padding: '11px 13px',
            fontSize: 13,
            lineHeight: 1.6,
            color: reviewTheme.colors.ink,
            background: '#fff',
            resize: 'vertical' as const,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box' as const,
          }}
        />
      </div>
    </div>
  )
}
