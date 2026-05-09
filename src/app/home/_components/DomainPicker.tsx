'use client'

import { useEffect, useState } from 'react'
import { useUiLocale } from '@/lib/i18n/ui-locale-context'

export type Domain = 'general' | 'materials' | 'biomedical' | 'physics'

const DOMAIN_SUBS: Record<Domain, string> = {
  general: 'Multidisciplinary',
  materials: 'Chemistry & Engineering',
  biomedical: 'Life Sciences',
  physics: 'Devices & Systems',
}

const LS_KEY = 'council.preferred-domain'

export function useDomain(): [Domain, (d: Domain) => void] {
  const [domain, setDomainState] = useState<Domain>('general')

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) as Domain | null
    if (saved && saved in DOMAIN_SUBS) setDomainState(saved)
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
  const t = useUiLocale()
  const DOMAINS: { value: Domain; label: string; sub: string }[] = [
    { value: 'general',    label: t.domain_general,    sub: DOMAIN_SUBS.general },
    { value: 'materials',  label: t.domain_materials,  sub: DOMAIN_SUBS.materials },
    { value: 'biomedical', label: t.domain_biomedical, sub: DOMAIN_SUBS.biomedical },
    { value: 'physics',    label: t.domain_physics,    sub: DOMAIN_SUBS.physics },
  ]

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
        color: '#bbb', textTransform: 'uppercase', marginBottom: 10,
      }}>
        {t.home_domain_label}
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
