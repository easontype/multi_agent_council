import { NextResponse } from 'next/server'

// Demo sessions data
const demoSessions = [
  {
    id: '1',
    title: 'Review: Attention Is All You Need',
    status: 'concluded',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
  },
  {
    id: '2',
    title: 'Review: BERT: Pre-training of Deep Bidirectional Transformers',
    status: 'concluded',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
  },
  {
    id: '3',
    title: 'Review: GPT-4 Technical Report',
    status: 'pending',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  },
]

export async function GET() {
  return NextResponse.json(demoSessions)
}
