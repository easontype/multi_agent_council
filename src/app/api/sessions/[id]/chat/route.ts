import { NextRequest, NextResponse } from 'next/server'
import { canAccessCouncilSession } from '@/lib/core/council-access'
import { answerCouncilPaperQuestion } from '@/lib/core/council-paper-chat'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const allowed = await canAccessCouncilSession(req, id)
  if (!allowed) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }

  try {
    const result = await answerCouncilPaperQuestion(id, question)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to answer question'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
