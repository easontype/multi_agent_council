'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useUiLocale } from '@/lib/i18n/ui-locale-context'
import { CRITIQUE_SEAT_DEFINITIONS, EXPERIMENTAL_SEAT_DEFINITIONS, BIOMEDICAL_SEAT_DEFINITIONS, PHYSICS_SEAT_DEFINITIONS } from '@/lib/core/council-academic'
import type { SeatDefinition } from '@/lib/core/council-academic'

type Domain = 'general' | 'materials' | 'biomedical' | 'physics'

const DOMAIN_SEATS: Record<Domain, SeatDefinition[]> = {
  general: CRITIQUE_SEAT_DEFINITIONS,
  materials: EXPERIMENTAL_SEAT_DEFINITIONS,
  biomedical: BIOMEDICAL_SEAT_DEFINITIONS,
  physics: PHYSICS_SEAT_DEFINITIONS,
}

const DEFAULT_ROLES_BY_DOMAIN: Record<Domain, string[]> = {
  general: ['methods', 'literature', 'contribution'],
  materials: ['material', 'characterization', 'benchmark'],
  biomedical: ['safety', 'translational', 'clinicalbench'],
  physics: ['device', 'efficiency', 'reliability'],
}

export default function DebateSetupPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const t = useUiLocale()
  const assetId = params.assetId as string

  const DOMAIN_OPTIONS = [
    { value: 'general' as Domain,    label: t.domain_general,    sub: 'Multidisciplinary' },
    { value: 'materials' as Domain,  label: t.domain_materials,  sub: 'Chemistry & Engineering' },
    { value: 'biomedical' as Domain, label: t.domain_biomedical, sub: 'Life Sciences' },
    { value: 'physics' as Domain,    label: t.domain_physics,    sub: 'Devices & Systems' },
  ]

  const [domain, setDomain] = useState<Domain>((searchParams.get('domain') ?? 'general') as Domain)
  const availableSeats = DOMAIN_SEATS[domain] ?? CRITIQUE_SEAT_DEFINITIONS

  const handleDomainChange = (d: Domain) => {
    setDomain(d)
    setSelectedRoleIds(DEFAULT_ROLES_BY_DOMAIN[d] ?? ['methods', 'literature', 'contribution'])
  }

  const [optionA, setOptionA] = useState('Supporting the paper')
  const [optionB, setOptionB] = useState('Challenging the paper')
  const [context, setContext] = useState('')
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    DEFAULT_ROLES_BY_DOMAIN[(searchParams.get('domain') ?? 'general') as Domain] ?? ['methods', 'literature', 'contribution']
  )
  const [rounds, setRounds] = useState<1 | 2>(2)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleRole = (id: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const handleLaunch = async () => {
    if (!optionA.trim() || !optionB.trim()) {
      setError(t.debate_error_sides)
      return
    }
    if (selectedRoleIds.length === 0) {
      setError(t.debate_error_roles)
      return
    }
    setLaunching(true)
    setError(null)
    try {
      const res = await fetch('/api/sessions/from-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperAssetId: assetId,
          sessionType: 'debate',
          domain,
          rounds,
          optionA: optionA.trim(),
          optionB: optionB.trim(),
          context: context.trim(),
          selectedRoleIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      router.push(`/review/${encodeURIComponent(data.sessionId)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch debate')
      setLaunching(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '60px 24px', background: '#fafafa',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Back */}
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            border: 'none', background: 'none', color: '#aaa',
            fontSize: 12.5, cursor: 'pointer', padding: 0, marginBottom: 32,
          }}
        >
          ← {t.common_back}
        </button>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 800, color: '#1e3a8a', letterSpacing: '-0.04em',
            margin: '0 0 4px', fontFamily: "'Georgia', serif",
          }}>
            {t.page_configure_debate}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>
            {t.debate_context_placeholder}
          </p>
        </div>

        {/* Domain */}
        <SectionLabel>{t.home_domain_label}</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {DOMAIN_OPTIONS.map(opt => {
            const active = domain === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleDomainChange(opt.value)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer', outline: 'none',
                  border: `1.5px solid ${active ? '#1e3a8a' : '#e4e4e7'}`,
                  background: active ? '#1e3a8a' : '#fff',
                  transition: 'all 120ms',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: active ? '#fff' : '#3f3f46' }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.6)' : '#a1a1aa', marginTop: 1 }}>
                  {opt.sub}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sides */}
        <SectionLabel>{t.debate_positions_label}</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#4a6b73', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
              {t.debate_side_a}
            </div>
            <textarea
              value={optionA}
              onChange={e => setOptionA(e.target.value)}
              placeholder={t.debate_side_a_placeholder}
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid #e4e4e7', borderRadius: 8, padding: '9px 12px',
                fontSize: 13, color: '#111', resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7a4c54', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
              {t.debate_side_b}
            </div>
            <textarea
              value={optionB}
              onChange={e => setOptionB(e.target.value)}
              placeholder={t.debate_side_b_placeholder}
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid #e4e4e7', borderRadius: 8, padding: '9px 12px',
                fontSize: 13, color: '#111', resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
          </div>
        </div>

        {/* Context */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#aaa', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
            {t.debate_context_optional_label}
          </div>
          <input
            type="text"
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="e.g. Evaluating fitness for Nature publication"
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1.5px solid #e4e4e7', borderRadius: 8, padding: '9px 12px',
              fontSize: 13, color: '#111', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Expert roles */}
        <SectionLabel>{t.debate_roles_selected} ({selectedRoleIds.length})</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
          {availableSeats.map(seat => {
            const selected = selectedRoleIds.includes(seat.id)
            return (
              <button
                key={seat.id}
                onClick={() => toggleRole(seat.id)}
                title={seat.description}
                style={{
                  padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                  border: `1.5px solid ${selected ? seat.color : '#e4e4e7'}`,
                  background: selected ? seat.color : '#fff',
                  color: selected ? '#fff' : '#52525b',
                  fontSize: 12, fontWeight: 500, transition: 'all 120ms', outline: 'none',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: selected ? 'rgba(255,255,255,0.25)' : seat.color,
                  color: '#fff', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {seat.avatar}
                </span>
                {seat.role}
              </button>
            )
          })}
        </div>

        {/* Rounds */}
        <SectionLabel>{t.setup_rounds_label}</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {([1, 2] as const).map(r => (
            <button
              key={r}
              onClick={() => setRounds(r)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1.5px solid ${rounds === r ? '#1e3a8a' : '#e4e4e7'}`,
                background: rounds === r ? '#1e3a8a' : '#fff',
                textAlign: 'left', outline: 'none', transition: 'all 120ms',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: rounds === r ? '#fff' : '#111' }}>
                {r === 1 ? t.setup_rounds_1 : t.setup_rounds_2}
              </div>
              <div style={{ fontSize: 11, color: rounds === r ? '#93c5fd' : '#a1a1aa', marginTop: 2 }}>
                {r === 1 ? 'Fast — 10–15 min' : 'Full debate — 25–40 min'}
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
            background: launching ? '#d4d4d8' : '#1e3a8a', color: launching ? '#888' : '#fff',
            fontSize: 14, fontWeight: 700, cursor: launching ? 'default' : 'pointer',
            letterSpacing: '-0.01em', transition: 'background 150ms',
          }}
        >
          {launching ? t.debate_launching : `${t.debate_launch} →`}
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
