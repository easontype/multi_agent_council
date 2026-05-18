import { ReviewSurface } from '@/components/review/review-surface'

export default async function DebateSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ReviewSurface mode="session" forcedSessionId={id} />
}
