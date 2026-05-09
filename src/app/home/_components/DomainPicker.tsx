'use client'

import { useEffect, useState } from 'react'

export type Domain = 'general' | 'materials' | 'biomedical' | 'physics'

const DOMAINS: { value: Domain; label: string; sub: string }[] = [
  { value: 'general',   label: 'General',    sub: 'Multidisciplinary' },
  { value: 'materials', label: 'Materials',  sub: 'Chemistry & Engineering' },
  { value: 'biomedical',label: 'Biomedical', sub: 'Life Sciences' },
  { value: 'physics',   label: 'Physics',    sub: 'Devices & Systems' },
]

const LS_KEY = 'council.preferred-domain'

export function useDomain(): [Domain, (d: Domain) => void] {
  const [domain, setDomainState] = useState<Domain>('general')

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) as Domain | null
    if (saved && DOMAINS.some(d => d.value === saved)) setDomainState(saved)
  }, [])

  const setDomain = (d: Domain) => {
    setDomainState(d)
    localStorage.setItem(LS_KEY, d)
  }

  return [domain, setDomain]
}

interface Props {
  value: Domain
  onChange: (d: Domain) => void
}

export function DomainPicker({ value, onChange }: Props) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
        color: '#bbb', textTransform: 'uppercase', marginBottom: 10,
      }}>
        Research Domain
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DOMAINS.map(({ value: v, label, sub }) => {
          const active = value === v
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '7px 14px', border: `1.5px solid ${active ? '#111' : '#e4e4e7'}`,
                borderRadius: 8, background: active ? '#111' : '#fff',
                cursor: 'pointer', transition: 'all 120ms ease',
                outline: 'none',
              }}
            >
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: active ? '#fff' : '#3f3f46',
              }}>
                {label}
              </span>
              <span style={{
                fontSize: 10, color: active ? '#aaa' : '#a1a1aa',
                marginTop: 1,
              }}>
                {sub}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
