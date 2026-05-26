import { NextResponse } from 'next/server'
import { resolveGoogleAccessToken } from '@/lib/calendar-auth'
import { deleteCalendarEvent } from '@/lib/google'

export async function POST(request: Request) {
  const body = (await request.json()) as { userId?: string; eventId?: string }
  const { userId, eventId } = body

  if (!userId || !eventId) {
    return NextResponse.json({ error: 'userId and eventId required' }, { status: 400 })
  }

  const tokenResult = await resolveGoogleAccessToken(userId)
  if ('error' in tokenResult) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  const result = await deleteCalendarEvent(tokenResult.accessToken, eventId)

  if (!result.success) {
    if (result.error === 'insufficient_scope') {
      return NextResponse.json({ error: 'insufficient_scope' }, { status: 403 })
    }
    return NextResponse.json({ error: result.error, detail: result.errorMessage }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
