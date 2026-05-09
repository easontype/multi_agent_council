'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'

type ReviewMode = 'critique' | 'gap'
type Domain = 'general' | 'materials' | 'biomedical' | 'physics'

const MODE_OPTIONS: { value: ReviewMode; label: string; sub: string; description: string }[] = [
  {
    value: 'critique',
    label: 'Critical Review',
    sub: 'Methods · Literature · Novelty',
    description: 'Multi-agent panel scrutinises methodology, related work, statistical validity, and novelty claims.',
  },
  {
    value: 'gap',
    label: 'Gap Analysis',
    sub: 'Opportunities · Missing work',
    description: 'Agents identify research gaps, missing controls, and opportunities for follow-up studies.',
  },
]

const ROUND_OPTIONS: { value: 1 | 2; label: string; sub: string }[] = [
  { value: 1, label: '1 Round', sub: 'Fast — 8–12 min' },
  { value: 2, label: '2 Rounds', sub: 'Deep — 20–30 min' },
]

export default function ReviewSetupPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const assetId = params.assetId as string
  const domain = (searchParams.get('domain') ?? 'general') as Domain

  const [mode, setMode] = useState<ReviewMode>('critique')
  const [rounds, setRounds] = useState<1 | 2>(1)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLaunch = async () => {
    setLaunching(true)
    setError(null)
    try {
      const res = await fetch('/api/sessions/from-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperAssetId: assetId, mode, rounds, domain }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      router.push(`/review/${encodeURIComponent(data.sessionId)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch session')
      setLaunching(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '60px 24px', background: '#fafafa',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Back */}
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            border: 'none', background: 'none', color: '#aaa',
            fontSize: 12.5, cursor: 'pointer', padding: 0, marginBottom: 32,
          }}
        >
          ← Back
        </button>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 800, color: '#111', letterSpacing: '-0.04em',
            margin: '0 0 4px', fontFamily: "'Georgia', serif",
          }}>
            Configure Review
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>
            Domain: <span style={{ color: '#52525b', fontWeight: 500, textTransform: 'capitalize' }}>{domain}</span>
          </p>
        </div>

        {/* Mode */}
        <SectionLabel>Review Mode</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {MODE_OPTIONS.map(opt => (
            <OptionCard
              key={opt.value}
              selected={mode === opt.value}
              onClick={() => setMode(opt.value)}
              label={opt.label}
              sub={opt.sub}
              description={opt.description}
            />
          ))}
        </div>

        {/* Rounds */}
        <SectionLabel>Rounds</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {ROUND_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRounds(opt.value)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1.5px solid ${rounds === opt.value ? '#111' : '#e4e4e7'}`,
                background: rounds === opt.value ? '#111' : '#fff',
                textAlign: 'left', outline: 'none', transition: 'all 120ms',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: rounds === opt.value ? '#fff' : '#111' }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 11, color: rounds === opt.value ? '#aaa' : '#a1a1aa', marginTop: 2 }}>
                {opt.sub}
              </div>
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 16, padding: '8px 12px', borderRadius: 7,
            background: '#fef2f2', color: '#b91c1c', fontSize: 12.5,
          }}>
            {error}
          </div>
        )}

        {/* Launch */}
        <button
          onClick={handleLaunch}
          disabled={launching}
          style={{
            width: '100%', padding: '13px', borderRadius: 9, border: 'none',
            background: launching ? '#d4d4d8' : '#111', color: launching ? '#888' : '#fff',
            fontSize: 14, fontWeight: 700, cursor: launching ? 'default' : 'pointer',
            letterSpacing: '-0.01em', transition: 'background 150ms',
          }}
        >
          {launching ? 'Launching…' : 'Launch Review →'}
        </button>

      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
      color: '#bbb', textTransform: 'uppercase', marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

function OptionCard({
  selected, onClick, label, sub, description,
}: {
  selected: boolean
  onClick: () => void
  label: string
  sub: string
  description: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left',
        padding: '12px 16px', borderRadius: 9, cursor: 'pointer', outline: 'none',
        border: `1.5px solid ${selected ? '#111' : '#e4e4e7'}`,
        background: selected ? '#111' : '#fff',
        transition: 'all 120ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: selected ? '#fff' : '#111' }}>
          {label}
        </span>
        <span style={{ fontSize: 10.5, color: selected ? '#888' : '#a1a1aa', fontWeight: 500 }}>
          {sub}
        </span>
      </div>
      <span style={{ fontSize: 12, color: selected ? 'rgba(255,255,255,0.65)' : '#71717a', lineHeight: 1.55 }}>
        {description}
      </span>
    </button>
  )
}
