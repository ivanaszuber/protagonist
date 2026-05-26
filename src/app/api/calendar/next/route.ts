import { NextResponse } from 'next/server'
import { getCalendarEvents } from '@/lib/db'
import { isSupabaseConfigured } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const limitParam = searchParams.get('limit')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return limitParam ? NextResponse.json({ events: [] }) : NextResponse.json({ event: null })
  }

  const dateParam = searchParams.get('date')
  const today = dateParam ?? new Date().toISOString().split('T')[0]

  if (limitParam) {
    const rows = await getCalendarEvents(userId, today)
    const limit = Math.min(Number(limitParam) || 10, 50)
    const events = rows.slice(0, limit).map((row) => ({
      id: String(row.id ?? row.google_event_id ?? row.title),
      title: String(row.title ?? 'Event'),
      start: String(row.start_time ?? ''),
      end: String(row.end_time ?? ''),
    }))
    return NextResponse.json({ events })
  }
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [todayEvents, tomorrowEvents] = await Promise.all([
    getCalendarEvents(userId, today),
    getCalendarEvents(userId, tomorrow),
  ])

  const now = Date.now()
  const upcoming = [...todayEvents, ...tomorrowEvents]
    .filter((row) => row.start_time && new Date(row.start_time as string).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.start_time as string).getTime() -
        new Date(b.start_time as string).getTime()
    )

  const next = upcoming[0]
  if (!next?.start_time) {
    return NextResponse.json({ event: null })
  }

  return NextResponse.json({
    event: {
      title: next.title as string,
      start: next.start_time as string,
    },
  })
}
