'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUiLocale } from '@/lib/i18n/ui-locale-context'
import { PaperInputBox } from '@/app/home/_components/PaperInputBox'

export default function AnalyzePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useUiLocale()

  useEffect(() => {
    const session = searchParams.get('session')
    if (session) {
      router.replace(`/review/${encodeURIComponent(session)}`)
    }
  }, [searchParams, router])

  return (
    <div style={{
      padding: '40px 48px 60px',
      maxWidth: 680,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 800, color: '#1a1a1a',
          letterSpacing: '-0.04em', marginBottom: 4,
          fontFamily: "'Georgia', 'Times New Roman', serif",
        }}>
          {t.page_new_analysis}
        </h1>
        <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>
          {t.page_new_analysis_subtitle}
        </p>
      </div>
      <PaperInputBox />
    </div>
  )
}
