import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  url.pathname = url.pathname.replace('/api/v1/analyze', '/api/public/v1/analyze')
  return NextResponse.redirect(url, 307)
}
