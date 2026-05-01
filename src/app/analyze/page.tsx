import { redirect } from 'next/navigation'

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const session = typeof params.session === 'string' ? params.session : null
  const arxiv = typeof params.arxiv === 'string' ? params.arxiv : null

  if (session) {
    redirect(`/review/${encodeURIComponent(session)}`)
  }

  if (arxiv) {
    redirect(`/review/new?arxiv=${encodeURIComponent(arxiv)}`)
  }

  redirect('/review/new')
}
