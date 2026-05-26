import { NextResponse } from 'next/server'
import { runMorningCheckin } from '@/lib/morning-checkin'

export async function POST(request: Request) {
  const body = (await request.json()) as { userId?: string; transcript?: string }

  if (!body.userId || !body.transcript?.trim()) {
    return NextResponse.json({ error: 'userId and transcript required' }, { status: 400 })
  }

  try {
    const result = await runMorningCheckin(body.userId, body.transcript.trim())
    return NextResponse.json(result)
  } catch (error) {
    console.error('Morning check-in error:', error)
    const message = error instanceof Error ? error.message : 'Check-in failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
