import { notFound } from 'next/navigation'
import { getCouncilSessionBundle } from '@/lib/council'
import { db } from '@/lib/db'
import type { CouncilConclusion, CouncilTurn } from '@/lib/council-types'
import { MarkdownContent } from '@/components/council/markdown-content'

async function getPublicBundle(id: string) {
  const { rows } = await db.query(
    `SELECT is_public FROM council_sessions WHERE id = $1`,
    [id],
  )
  if (!rows.length || !(rows[0] as { is_public: boolean }).is_public) return null
  return getCouncilSessionBundle(id)
}

function roleColor(role: string) {
  const key = role.toLowerCase()
  if (key.includes('moderator')) return '#6b7280'
  if (key.includes('method')) return '#466671'
  if (key.includes('experiment')) return '#496973'
  if (key.includes('literature')) return '#65505f'
  if (key.includes('novelty')) return '#43506b'
  if (key.includes('writing')) return '#7a4c54'
  return '#5f6672'
}

function ConfidenceBadge({ level }: { level: string | null }) {
  if (!level) return null

  const colors: Record<string, string> = {
    high: '#3f6b52',
    medium: '#8b6b35',
    low: '#8a4545',
  }

  const color = colors[level] ?? '#71717a'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        color,
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: '3px 10px',
        textTransform: 'capitalize',
      }}
    >
      {level} confidence
    </span>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 12, color: '#71717a' }}>
      <span style={{ fontWeight: 600, color: '#3f3f46' }}>{label}:</span> {value}
    </span>
  )
}

function Section({ title, text, color = '#3f3f46' }: { title: string; text: string; color?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
        {title}
      </div>
      <MarkdownContent content={text} color={color} />
    </div>
  )
}

function RoundDivider({ round }: { round: number }) {
  return (
    <div style={{ padding: '8px 0 16px', display: 'flex', alignItems: 'flex-end', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#a1a1aa', textTransform: 'uppercase' }}>
          Round
        </span>
        <span style={{ fontSize: 32, lineHeight: 1, color: '#d4d4d8', fontFamily: "'Georgia', 'Times New Roman', serif", letterSpacing: '-0.03em' }}>
          {round}
        </span>
      </div>
      <div style={{ flex: 1, height: 1, background: '#ececf1' }} />
    </div>
  )
}

function ConclusionSection({ conclusion }: { conclusion: CouncilConclusion }) {
  return (
    <div
      style={{
        border: '1px solid #ececf1',
        borderRadius: 16,
        padding: '28px 32px',
        background: '#fcfcfb',
        marginBottom: 32,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
            Editorial Synthesis
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#18181b', margin: 0, fontFamily: "'Georgia', 'Times New Roman', serif", letterSpacing: '-0.02em' }}>
            Synthesis and academic assessment
          </h2>
        </div>
        <ConfidenceBadge level={conclusion.confidence} />
      </div>

      {conclusion.confidence_reason && (
        <p style={{ fontSize: 13, color: '#71717a', marginBottom: 18, fontStyle: 'italic', lineHeight: 1.7 }}>
          {conclusion.confidence_reason}
        </p>
      )}

      <Section title="Summary Judgment" text={conclusion.summary} />
      {conclusion.consensus && <Section title="Consensus View" text={conclusion.consensus} />}

      {conclusion.dissent?.length ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#8b6b35', textTransform: 'uppercase', marginBottom: 8 }}>
            Unresolved Disagreements
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {conclusion.dissent.map((dissent, index) => (
              <div key={index} style={{ padding: '12px 14px', background: '#fcfcfb', borderLeft: '3px solid #f59e0b', borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#8b6b35', marginBottom: 6 }}>{dissent.question}</div>
                {Object.entries(dissent.seats).map(([seat, position]) => (
                  <div key={seat} style={{ fontSize: 13, color: '#52525b', lineHeight: 1.6 }}>
                    <span style={{ fontWeight: 600 }}>{seat}:</span> {position}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {conclusion.veto && <Section title="Blocking Concern" text={conclusion.veto} color="#8a4545" />}

      {conclusion.action_items.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 8 }}>
            Revision Checklist
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {conclusion.action_items.map((item, index) => (
              <li key={index} style={{ fontSize: 14, color: '#3f3f46', lineHeight: 1.7, marginBottom: 4 }}>
                {item.action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function TurnCard({ turn }: { turn: CouncilTurn }) {
  const color = roleColor(turn.role)

  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${color}08 0%, #ffffff 60%)`,
        borderTop: '1px solid #ececf1',
        borderRight: '1px solid #ececf1',
        borderBottom: '1px solid #ececf1',
        borderLeft: `2px solid ${color}`,
        borderRadius: '0 12px 12px 0',
        padding: '14px 18px',
        marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: '999px',
            background: color,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            boxShadow: `0 8px 18px ${color}2c`,
          }}
        >
          {turn.role.charAt(0).toUpperCase()}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{turn.role}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase' }}>
          Round {turn.round}
        </span>
      </div>

      <MarkdownContent content={turn.content} />
    </div>
  )
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const bundle = await getPublicBundle(id)
  if (!bundle?.session) notFound()

  const { session, turns, conclusion } = bundle
  const roundNumbers = [...new Set(turns.map((turn) => turn.round))].sort((a, b) => a - b)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fcfcfb',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          borderBottom: '1px solid #ececf1',
          padding: '0 24px',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <a href="/" style={{ fontWeight: 700, fontSize: 16, color: '#111827', textDecoration: 'none' }}>
          Council
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href={`/api/sessions/${session.id}/export`}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#3f3f46',
              textDecoration: 'none',
              border: '1px solid #e4e4e7',
              borderRadius: 999,
              padding: '6px 10px',
              background: '#fff',
            }}
          >
            Download Markdown
          </a>
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 10 }}>
            Shared Council Session
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: '#111827',
              marginBottom: 8,
              letterSpacing: '-0.03em',
              fontFamily: "'Georgia', 'Times New Roman', serif",
            }}
          >
            {session.title}
          </h1>
          {session.topic && (
            <p style={{ fontSize: 15, color: '#71717a', lineHeight: 1.6, margin: 0 }}>
              {session.topic}
            </p>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            <Meta label="Status" value={session.status} />
            <Meta label="Rounds" value={String(session.rounds)} />
            {session.concluded_at && (
              <Meta label="Concluded" value={new Date(session.concluded_at).toLocaleDateString()} />
            )}
          </div>
        </div>

        {conclusion && <ConclusionSection conclusion={conclusion} />}

        {roundNumbers.map((round) => (
          <section key={round} style={{ marginBottom: 32 }}>
            <RoundDivider round={round} />
            {turns.filter((turn) => turn.round === round).map((turn) => (
              <TurnCard key={turn.id} turn={turn} />
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
