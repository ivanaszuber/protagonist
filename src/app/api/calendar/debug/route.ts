import { NextResponse } from 'next/server'
import { getGoogleTokens } from '@/lib/db'
import { refreshGoogleTokens } from '@/lib/google'
import { saveGoogleTokens } from '@/lib/db'

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const stored = await getGoogleTokens(userId)
  if (!stored) return NextResponse.json({ connected: false, error: 'No tokens found' })

  let accessToken = stored.access_token

  // Refresh if needed
  const expiresAt = new Date(stored.expires_at)
  if (Date.now() + 5 * 60 * 1000 > expiresAt.getTime()) {
    if (!stored.refresh_token) return NextResponse.json({ connected: false, error: 'No refresh token' })
    try {
      const newTokens = await refreshGoogleTokens(stored.refresh_token)
      await saveGoogleTokens(userId, newTokens)
      accessToken = newTokens.access_token
    } catch {
      return NextResponse.json({ connected: false, error: 'Token refresh failed — need to reconnect Google' })
    }
  }

  const headers = { Authorization: `Bearer ${accessToken}` }

  // Fetch connected Google account info
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers })
  const profile = profileRes.ok ? await profileRes.json() : null

  // Fetch calendar list
  const calListRes = await fetch(`${CALENDAR_BASE}/users/me/calendarList`, { headers })
  const calList = calListRes.ok ? await calListRes.json() : null

  // Fetch today's events from primary calendar
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const timeMin = new Date(`${today}T00:00:00Z`).toISOString()
  const timeMax = new Date(`${tomorrow}T23:59:59Z`).toISOString()

  const primaryEvents = calList?.items?.find((c: { primary?: boolean }) => c.primary)
  let todayEvents: unknown[] = []
  if (primaryEvents) {
    const evRes = await fetch(
      `${CALENDAR_BASE}/calendars/${encodeURIComponent(primaryEvents.id)}/events?` +
        new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '10' }),
      { headers }
    )
    if (evRes.ok) {
      const evData = await evRes.json()
      todayEvents = (evData.items ?? []).map((e: { summary?: string; start?: { dateTime?: string; date?: string }; status?: string }) => ({
        title: e.summary,
        start: e.start?.dateTime ?? e.start?.date,
        status: e.status,
      }))
    }
  }

  return NextResponse.json({
    connected: true,
    account: {
      email: profile?.email,
      name: profile?.name,
    },
    calendars: (calList?.items ?? []).map((c: { id: string; summary: string; primary?: boolean; accessRole: string }) => ({
      id: c.id,
      name: c.summary,
      primary: c.primary ?? false,
      role: c.accessRole,
    })),
    todayEventsFromPrimary: todayEvents,
    tokenExpiresAt: stored.expires_at,
  })
}
