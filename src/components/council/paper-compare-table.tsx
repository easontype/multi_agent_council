'use client'

import type { ActionItem } from '@/lib/core/council-types'

export interface CompareSessionData {
  id: string
  title: string
  mode: 'critique' | 'gap'
  confidence: 'high' | 'medium' | 'low' | null
  confidenceReason: string | null
  summary: string | null
  consensus: string | null
  veto: string | null
  actionItems: ActionItem[]
  rounds: number
  createdAt: string
}

const CONFIDENCE_STYLES = {
  high:   { dot: '#16a34a', text: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'High' },
  medium: { dot: '#d97706', text: '#92400e', bg: '#fffbeb', border: '#fde68a', label: 'Medium' },
  low:    { dot: '#dc2626', text: '#991b1b', bg: '#fef2f2', border: '#fecaca', label: 'Low' },
}

const PRIORITY_COLORS = {
  blocking:    '#b91c1c',
  recommended: '#1d4ed8',
  optional:    '#6b7280',
}

function trunc(s: string | null | undefined, n: number): string {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

function ConfidenceBadge({ level }: { level: CompareSessionData['confidence'] }) {
  if (!level) return <span style={{ color: '#c4c4cc', fontSize: 12 }}>—</span>
  const s = CONFIDENCE_STYLES[level]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 999,
      border: `1px solid ${s.border}`, background: s.bg,
      fontSize: 11, fontWeight: 700, color: s.text,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  )
}

function ModeBadge({ mode }: { mode: CompareSessionData['mode'] }) {
  const isGap = mode === 'gap'
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      color: isGap ? '#7c3aed' : '#1d4ed8',
      background: isGap ? '#faf5ff' : '#eff6ff',
      border: `1px solid ${isGap ? '#ddd6fe' : '#bfdbfe'}`,
      padding: '2px 7px', borderRadius: 4,
    }}>
      {isGap ? 'Gap Analysis' : 'Critique'}
    </span>
  )
}

const ROWS: { key: string; label: string }[] = [
  { key: 'mode', label: 'Mode' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'summary', label: 'Summary' },
  { key: 'consensus', label: 'Consensus' },
  { key: 'veto', label: 'Veto' },
  { key: 'issues', label: 'Key Issues' },
  { key: 'rounds', label: 'Rounds' },
]

function CellContent({ rowKey, session }: { rowKey: string; session: CompareSessionData }) {
  switch (rowKey) {
    case 'mode':
      return <ModeBadge mode={session.mode} />
    case 'confidence':
      return (
        <div>
          <ConfidenceBadge level={session.confidence} />
          {session.confidenceReason && (
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 4, lineHeight: 1.4 }}>
              {trunc(session.confidenceReason, 80)}
            </div>
          )}
        </div>
      )
    case 'summary':
      return (
        <span style={{ fontSize: 12, color: '#3f3f46', lineHeight: 1.55 }}>
          {trunc(session.summary, 140)}
        </span>
      )
    case 'consensus':
      return session.consensus ? (
        <span style={{ fontSize: 12, color: '#166534', lineHeight: 1.55 }}>
          {trunc(session.consensus, 120)}
        </span>
      ) : (
        <span style={{ color: '#d4d4d8', fontSize: 12 }}>—</span>
      )
    case 'veto':
      return session.veto ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
            color: '#b91c1c', background: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: 3,
            padding: '2px 5px', marginTop: 1, flexShrink: 0,
          }}>
            VETO
          </span>
          <span style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
            {trunc(session.veto, 100)}
          </span>
        </div>
      ) : (
        <span style={{ color: '#d4d4d8', fontSize: 12 }}>—</span>
      )
    case 'issues': {
      const items = session.actionItems.slice(0, 3)
      if (!items.length) return <span style={{ color: '#d4d4d8', fontSize: 12 }}>—</span>
      return (
        <ol style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item, i) => (
            <li key={i} style={{ fontSize: 11, color: '#3f3f46', lineHeight: 1.45 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: PRIORITY_COLORS[item.priority], marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {item.priority === 'blocking' ? '!' : item.priority === 'recommended' ? '·' : '○'}
              </span>
              {trunc(item.action, 80)}
            </li>
          ))}
        </ol>
      )
    }
    case 'rounds':
      return (
        <span style={{ fontSize: 13, fontWeight: 600, color: '#3f3f46' }}>
          {session.rounds}
        </span>
      )
    default:
      return null
  }
}

interface PaperCompareTableProps {
  sessions: CompareSessionData[]
  onClose: () => void
  onOpenSession: (id: string) => void
}

export function PaperCompareTable({ sessions, onClose, onOpenSession }: PaperCompareTableProps) {
  const cols = sessions.length
  const colWidth = cols <= 2 ? 280 : cols === 3 ? 220 : 180

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 20px', borderBottom: '1px solid #ebebed',
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: '1px solid #e4e4e7', borderRadius: 7,
            padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#52525b',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#a1a1aa', textTransform: 'uppercase' }}>
            Comparing {cols} paper{cols !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{
          borderCollapse: 'collapse',
          width: '100%',
          minWidth: 140 + cols * colWidth,
          tableLayout: 'fixed',
        }}>
          <colgroup>
            <col style={{ width: 140 }} />
            {sessions.map((s) => <col key={s.id} style={{ width: colWidth }} />)}
          </colgroup>

          {/* Paper title header */}
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={{
                padding: '12px 16px', borderBottom: '2px solid #ebebed',
                textAlign: 'left', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase',
              }}>
                Attribute
              </th>
              {sessions.map((s) => (
                <th
                  key={s.id}
                  style={{
                    padding: '12px 16px', borderBottom: '2px solid #ebebed',
                    borderLeft: '1px solid #ebebed',
                    textAlign: 'left',
                  }}
                >
                  <button
                    onClick={() => onOpenSession(s.id)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      textAlign: 'left', width: '100%',
                    }}
                  >
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: '#18181b',
                      lineHeight: 1.3, marginBottom: 3,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {s.title.replace(/^Review:\s*/i, '')}
                    </div>
                    <div style={{ fontSize: 10, color: '#a1a1aa' }}>
                      {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {ROWS.map((row, rowIndex) => (
              <tr
                key={row.key}
                style={{ background: rowIndex % 2 === 0 ? '#fff' : '#fafafa' }}
              >
                <td style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f0f0f2',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                  color: '#71717a', textTransform: 'uppercase',
                  verticalAlign: 'top',
                }}>
                  {row.label}
                </td>
                {sessions.map((s) => (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f0f0f2',
                      borderLeft: '1px solid #f0f0f2',
                      verticalAlign: 'top',
                    }}
                  >
                    <CellContent rowKey={row.key} session={s} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
