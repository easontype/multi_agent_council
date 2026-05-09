'use client'

import { useState } from 'react'
import type { SeatDefinition } from '@/lib/core/council-academic'
import { reviewTheme } from '@/components/review/review-theme'

interface RoleSelectorProps {
  seats: SeatDefinition[]
  selectedIds: string[]
  optionA: string
  optionB: string
  onToggle: (id: string) => void
  maxSelect?: number
  customPrompts?: Record<string, string>
  onPromptChange?: (id: string, prompt: string) => void
}

export function RoleSelector({
  seats,
  selectedIds,
  optionA,
  optionB,
  onToggle,
  maxSelect = 3,
  customPrompts = {},
  onPromptChange,
}: RoleSelectorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const selectedCount = selectedIds.length
  const totalSeats = selectedCount * 2
  const atMax = selectedCount >= maxSelect

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {seats.map((seat) => {
          const checked = selectedIds.includes(seat.id)
          const disabled = !checked && atMax
          const isExpanded = expandedId === seat.id
          const hasCustomPrompt = Boolean(customPrompts[seat.id])
          return (
            <div key={seat.id} style={{
              borderRadius: 13,
              border: `1.5px solid ${checked ? reviewTheme.colors.accent : reviewTheme.colors.border}`,
              background: checked ? `${reviewTheme.colors.accent}0d` : disabled ? '#fafafa' : '#fff',
              opacity: disabled ? 0.5 : 1,
              transition: 'border-color 120ms, background 120ms',
              overflow: 'hidden',
            }}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onToggle(seat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '13px 14px',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: `2px solid ${checked ? reviewTheme.colors.accent : reviewTheme.colors.borderStrong}`,
                  background: checked ? reviewTheme.colors.accent : '#fff',
                  flexShrink: 0,
                  marginTop: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: seat.color,
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {seat.avatar}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: reviewTheme.colors.ink }}>
                      {seat.role}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: seat.color,
                      background: `${seat.color}15`,
                      border: `1px solid ${seat.color}30`,
                      borderRadius: 999,
                      padding: '2px 7px',
                    }}>
                      {seat.focus}
                    </span>
                    {hasCustomPrompt && (
                      <span style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>edited</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: reviewTheme.colors.muted, lineHeight: 1.55 }}>
                    {seat.description}
                  </div>
                </div>
              </button>

              {/* Prompt editor — only for selected seats */}
              {checked && onPromptChange && (
                <div style={{ borderTop: `1px solid ${reviewTheme.colors.accent}22`, padding: '0 14px' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : seat.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 0',
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600,
                      color: isExpanded ? reviewTheme.colors.accent : reviewTheme.colors.muted,
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    {isExpanded ? 'Hide prompt editor' : 'Edit system prompt'}
                  </button>

                  {isExpanded && (
                    <div style={{ paddingBottom: 12 }}>
                      <div style={{ fontSize: 11, color: reviewTheme.colors.muted, marginBottom: 6, lineHeight: 1.5 }}>
                        Editing the <strong>analytical framework</strong> for this role. Debate framing (sides, context) is added automatically.
                      </div>
                      <textarea
                        value={customPrompts[seat.id] ?? seat.systemPrompt}
                        onChange={e => onPromptChange(seat.id, e.target.value)}
                        rows={8}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          border: `1px solid ${reviewTheme.colors.borderStrong}`,
                          borderRadius: 8, padding: '9px 11px',
                          fontSize: 12, fontFamily: 'monospace',
                          color: reviewTheme.colors.ink,
                          resize: 'vertical', outline: 'none',
                          lineHeight: 1.6,
                        }}
                      />
                      {hasCustomPrompt && (
                        <button
                          type="button"
                          onClick={() => onPromptChange(seat.id, seat.systemPrompt)}
                          style={{
                            marginTop: 6, border: 'none', background: 'none',
                            fontSize: 11, color: '#b45309', cursor: 'pointer', padding: 0,
                          }}
                        >
                          ↩ Reset to default
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedCount > 0 && (
        <div style={{
          marginTop: 18,
          padding: '14px 16px',
          borderRadius: 14,
          border: `1px solid ${reviewTheme.colors.border}`,
          background: reviewTheme.colors.panelStrong,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: reviewTheme.colors.softMuted, marginBottom: 10 }}>
            Preview
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{
              flex: 1,
              minWidth: 120,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#e8f1f3',
              border: '1px solid #b0ccd3',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6b73', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Team A — {optionA || 'Option A'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1b18' }}>{selectedCount} seats</div>
            </div>
            <div style={{
              flex: 1,
              minWidth: 120,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#f3e8ea',
              border: '1px solid #d3b0b6',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7a4c54', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Team B — {optionB || 'Option B'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1b18' }}>{selectedCount} seats</div>
            </div>
            <div style={{
              flex: 1,
              minWidth: 120,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#f0f0f2',
              border: '1px solid #d0d0d5',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Moderator
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1b18' }}>1 neutral</div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: reviewTheme.colors.muted }}>
            {totalSeats} debate seats + 1 Moderator = {totalSeats + 1} total seats
          </div>
        </div>
      )}

      {selectedCount === 0 && (
        <div style={{ marginTop: 14, fontSize: 12, color: '#b45309', lineHeight: 1.5 }}>
          Select 2–3 roles. Each role will be duplicated — one supporting {optionA || 'Option A'}, one supporting {optionB || 'Option B'}.
        </div>
      )}
    </div>
  )
}
