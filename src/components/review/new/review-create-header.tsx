'use client'

interface ReviewCreateHeaderProps {
  hasSource: boolean
  activeCount: number
  rounds: 1 | 2
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 999,
      background: '#fff',
      border: '1px solid #e4e4e7',
    }}>
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: '#a1a1aa',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>
        {value}
      </span>
    </div>
  )
}

export function ReviewCreateHeader({ hasSource, activeCount, rounds }: ReviewCreateHeaderProps) {
  return (
    <div style={{
      padding: '28px 32px 22px',
      borderBottom: '1px solid #ececf1',
      background: 'linear-gradient(180deg, #fff 0%, #fcfcfb 100%)',
      flexShrink: 0,
    }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.09em',
          color: '#a1a1aa',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          New Review
        </div>
        <h1 style={{
          margin: '0 0 8px',
          fontSize: 30,
          lineHeight: 1.05,
          letterSpacing: '-0.04em',
          color: '#18181b',
          fontFamily: "'Georgia', 'Times New Roman', serif",
        }}>
          Stage a paper, shape the panel, then launch the debate.
        </h1>
        <p style={{
          margin: 0,
          maxWidth: 780,
          fontSize: 14,
          lineHeight: 1.7,
          color: '#71717a',
        }}>
          This page is only for creating the review. Once the session starts, Council moves you into the dedicated workspace for live debate, evidence inspection, and export.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatPill label="Paper" value={hasSource ? 'Staged' : 'Required'} />
        <StatPill label="Agents" value={String(activeCount)} />
        <StatPill label="Rounds" value={`${rounds}`} />
      </div>
    </div>
  )
}
