import { NextRequest, NextResponse } from 'next/server'
import { applyEntitlementResponse, checkEntitlement, quotaDenied } from '@/lib/entitlements'
import { generateTeamWithAI } from '@/lib/team-builder'
import type { TeamBuilderBrief } from '@/lib/prompts/review-presets'
import { toSafeError } from '@/lib/utils/text'
import { ensureAnonymousVisitorIdentity } from '@/lib/anonymous-access'

function isValidBrief(value: unknown): value is TeamBuilderBrief {
  if (!value || typeof value !== 'object') return false
  const brief = value as Record<string, unknown>
  return (
    (brief.reviewGoal === 'submission' || brief.reviewGoal === 'literature' || brief.reviewGoal === 'revision' || brief.reviewGoal === 'rebuttal') &&
    (brief.paperType === 'methods' || brief.paperType === 'systems' || brief.paperType === 'theory' || brief.paperType === 'applied') &&
    (brief.stance === 'skeptical' || brief.stance === 'balanced' || brief.stance === 'supportive') &&
    (brief.priority === 'novelty' || brief.priority === 'methods' || brief.priority === 'experiments' || brief.priority === 'writing' || brief.priority === 'citations') &&
    (brief.teamSize === 4 || brief.teamSize === 5 || brief.teamSize === 6)
  )
}

export async function POST(req: NextRequest) {
  const quota = await checkEntitlement(req, 'team_builder', ensureAnonymousVisitorIdentity(req))
  if (!quota.ok) return quotaDenied(quota.error, quota.retryAfterSeconds, quota.anonymousVisitorIdToSet)

  const body = await req.json().catch(() => ({}))
  const request = typeof body.request === 'string' ? body.request.trim() : ''
  const brief = isValidBrief(body.brief) ? body.brief : null

  if (!brief) {
    return NextResponse.json({ error: 'valid brief is required' }, { status: 400 })
  }

  try {
    const result = await generateTeamWithAI({ request, brief })
    return applyEntitlementResponse(NextResponse.json(result), quota)
  } catch (error) {
    return applyEntitlementResponse(
      NextResponse.json({ error: toSafeError(error, 'team builder') }, { status: 500 }),
      quota,
    )
  }
}
