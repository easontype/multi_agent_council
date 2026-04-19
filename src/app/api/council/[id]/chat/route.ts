import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  url.pathname = url.pathname.replace('/api/council', '/api/sessions')
  return NextResponse.redirect(url, 307)
}
