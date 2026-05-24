import { NextResponse } from 'next/server'
import { fetchCalendarEvents, refreshGoogleTokens } from '@/lib/google'
import {
  getGoogleTokens,
  saveGoogleTokens,
  saveCalendarEvents,
  deleteCalendarEventsForDate,
  getCalendarEvents,
} from '@/lib/db'

export async function POST(request: Request) {
  const { userId } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const stored = await getGoogleTokens(userId)
  if (!stored) {
    return NextResponse.json({ error: 'not_connected', connected: false }, { status: 200 })
  }

  let accessToken = stored.access_token

  const expiresAt = new Date(stored.expires_at)
  if (Date.now() + 5 * 60 * 1000 > expiresAt.getTime()) {
    if (!stored.refresh_token) {
      return NextResponse.json(
        { error: 'no_refresh_token', connected: false },
        { status: 200 }
      )
    }
    try {
      const newTokens = await refreshGoogleTokens(stored.refresh_token)
      await saveGoogleTokens(userId, newTokens)
      accessToken = newTokens.access_token
    } catch {
      return NextResponse.json(
        { error: 'token_refresh_failed', connected: false },
        { status: 200 }
      )
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  try {
    const events = await fetchCalendarEvents(accessToken, today, tomorrow)

    await deleteCalendarEventsForDate(userId, today)
    await deleteCalendarEventsForDate(userId, tomorrow)
    await saveCalendarEvents(
      userId,
      events.map((e) => ({
        google_event_id: e.id,
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
        all_day: e.all_day,
        location: e.location,
        description: e.description,
        calendar_name: e.calendar_name,
        event_date: e.event_date,
      }))
    )

    return NextResponse.json({ success: true, connected: true, events })
  } catch (err) {
    console.error('Calendar sync error:', err)
    return NextResponse.json({ error: 'sync_failed', connected: true }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const stored = await getGoogleTokens(userId)
  if (!stored) return NextResponse.json({ connected: false })

  const today = new Date().toISOString().split('T')[0]
  const events = await getCalendarEvents(userId, today)
  return NextResponse.json({ connected: true, events })
}
