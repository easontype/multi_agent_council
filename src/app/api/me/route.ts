import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthAccountContext } from '@/lib/auth-account'
import { updateUserPreferredLanguage } from '@/lib/db/account-db'

const SUPPORTED_LANGUAGES = ['en', 'zh-TW', 'zh-CN', 'ja', 'ko'] as const
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

function isSupported(lang: unknown): lang is SupportedLanguage {
  return typeof lang === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
}

export async function GET() {
  const ctx = await resolveAuthAccountContext()
  if (!ctx) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  return NextResponse.json({
    userId: ctx.userId,
    email: ctx.email,
    displayName: ctx.displayName,
    preferredLanguage: ctx.preferredLanguage,
  })
}

export async function PATCH(req: NextRequest) {
  const ctx = await resolveAuthAccountContext()
  if (!ctx) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const { preferredLanguage } = body as Record<string, unknown>
  if (!isSupported(preferredLanguage)) {
    return NextResponse.json(
      { error: `unsupported language. Must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` },
      { status: 400 }
    )
  }

  await updateUserPreferredLanguage(ctx.userId, preferredLanguage)
  return NextResponse.json({ ok: true, preferredLanguage })
}
