'use client'

import type { CouncilConclusion, ActionItem, DissentItem } from '@/lib/core/council-types'
import { EvidenceAnnotatedMarkdown } from './evidence-annotated-markdown'

interface ModeratorConclusionProps {
  conclusion: CouncilConclusion | null
  raw: string
  isStreaming: boolean
  agentColor: string
}

function tryParseConclusion(raw: string): CouncilConclusion | null {
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    if (!parsed.summary) return null
    return parsed as CouncilConclusion
  } catch {
    return null
  }
}

const CONFIDENCE_STYLES = {
  high: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#16a34a', label: 'High Confidence' },
  medium: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#d97706', label: 'Medium Confidence' },
  low: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', dot: '#dc2626', label: 'Low Confidence' },
}

const PRIORITY_STYLES = {
  blocking: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', label: 'Blocking' },
  recommended: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', label: 'Recommended' },
  optional: { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', label: 'Optional' },
}

function PriorityBadge({ priority }: { priority: ActionItem['priority'] }) {
  const s = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.optional
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: 999,
      border: `1px solid ${s.border}`,
      background: s.bg,
      color: s.text,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      flexShrink: 0,
    }}>
      {s.label}
    </span>
  )
}

export function ModeratorConclusion({ raw, isStreaming, agentColor }: ModeratorConclusionProps) {
  const parsed = tryParseConclusion(raw)

  if (!parsed) {
    return (
      <div style={{ fontSize: 14, color: '#3f3f46', lineHeight: 1.75, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {raw}
        {isStreaming && (
          <span style={{
            display: 'inline-block', width: 2, height: 14,
            background: agentColor, marginLeft: 2,
            animation: 'cur-blink 0.8s infinite',
            verticalAlign: 'text-bottom', borderRadius: 1,
          }} />
        )}
      </div>
    )
  }

  const conf = parsed.confidence ? CONFIDENCE_STYLES[parsed.confidence] : null
  const actionItems: ActionItem[] = Array.isArray(parsed.action_items) ? parsed.action_items : []
  const dissentItems: DissentItem[] = Array.isArray(parsed.dissent) ? parsed.dissent : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Confidence badge */}
      {conf && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 8,
          border: `1px solid ${conf.border}`, background: conf.bg,
          alignSelf: 'flex-start',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: conf.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: conf.text }}>{conf.label}</span>
          {parsed.confidence_reason && (
            <span style={{ fontSize: 11, color: conf.text, opacity: 0.75 }}>— {parsed.confidence_reason}</span>
          )}
        </div>
      )}

      {/* Summary */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
          Summary
        </div>
        <EvidenceAnnotatedMarkdown content={parsed.summary} sourceRefs={[]} color="#18181b" fontSize={14} />
      </div>

      {/* Consensus */}
      {parsed.consensus && (
        <div style={{
          padding: '10px 14px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#15803d', textTransform: 'uppercase', marginBottom: 5 }}>
            Consensus
          </div>
          <EvidenceAnnotatedMarkdown content={parsed.consensus} sourceRefs={[]} color="#166534" fontSize={13} />
        </div>
      )}

      {/* Veto */}
      {parsed.veto && (
        <div style={{
          padding: '10px 14px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 10,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#dc2626', textTransform: 'uppercase', marginBottom: 4 }}>
              Veto
            </div>
            <EvidenceAnnotatedMarkdown content={parsed.veto} sourceRefs={[]} color="#991b1b" fontSize={13} />
          </div>
        </div>
      )}

      {/* Action items */}
      {actionItems.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 8 }}>
            Action Items
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {actionItems.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '9px 12px',
                border: '1px solid #e4e4e7',
                borderRadius: 8,
                background: '#fff',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', minWidth: 18, paddingTop: 1 }}>
                  {i + 1}.
                </span>
                <div style={{ flex: 1 }}>
                  <EvidenceAnnotatedMarkdown content={item.action} sourceRefs={[]} color="#18181b" fontSize={13} />
                </div>
                <PriorityBadge priority={item.priority} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dissent */}
      {dissentItems.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 8 }}>
            Unresolved Disagreements
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dissentItems.map((item, i) => (
              <div key={i} style={{
                border: '1px solid #e4e4e7',
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '9px 12px', background: '#fafafa', borderBottom: '1px solid #e4e4e7' }}>
                  <EvidenceAnnotatedMarkdown content={item.question} sourceRefs={[]} color="#18181b" fontSize={12} />
                </div>
                {item.seats && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {Object.entries(item.seats).map(([seat, position], si) => (
                      <div key={si} style={{
                        display: 'flex', gap: 10, padding: '7px 12px',
                        borderBottom: si < Object.entries(item.seats).length - 1 ? '1px solid #f3f4f6' : 'none',
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#71717a', minWidth: 120, flexShrink: 0 }}>
                          {seat}
                        </span>
                        <div style={{ flex: 1 }}>
                          <EvidenceAnnotatedMarkdown content={position} sourceRefs={[]} color="#3f3f46" fontSize={12} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isStreaming && (
        <span style={{ fontSize: 12, color: '#a1a1aa', fontStyle: 'italic' }}>Finalising synthesis…</span>
      )}
    </div>
  )
}

export { tryParseConclusion }
