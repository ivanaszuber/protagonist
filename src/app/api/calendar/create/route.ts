import { NextResponse } from 'next/server'
import { getGoogleTokensForUser, refreshAndSaveGoogleTokens } from '@/lib/db'
import { createCalendarEvent, type CreateEventInput } from '@/lib/google'

export async function POST(request: Request) {
  const body = (await request.json()) as {
    userId?: string
    title?: string
    date?: string
    startTime?: string
    durationMinutes?: number
    description?: string
    location?: string
  }

  const { userId, title, date, startTime, durationMinutes, description, location } = body

  if (!userId || !title || !date) {
    return NextResponse.json(
      { error: 'userId, title, and date are required' },
      { status: 400 }
    )
  }

  const tokens = await getGoogleTokensForUser(userId)
  if (!tokens) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  let accessToken = tokens.access_token as string
  const expiresAt = new Date(tokens.expires_at as string)
  if (expiresAt.getTime() < Date.now()) {
    if (!tokens.refresh_token) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 })
    }
    const refreshed = await refreshAndSaveGoogleTokens(
      userId,
      tokens.refresh_token as string
    )
    accessToken = refreshed.access_token
  } else if (Date.now() + 5 * 60 * 1000 > expiresAt.getTime() && tokens.refresh_token) {
    try {
      const refreshed = await refreshAndSaveGoogleTokens(
        userId,
        tokens.refresh_token as string
      )
      accessToken = refreshed.access_token
    } catch {
      /* use existing token if refresh fails */
    }
  }

  const input: CreateEventInput = {
    title,
    date,
    startTime: startTime ?? '',
    durationMinutes: durationMinutes ?? 60,
    description,
    location,
  }

  const result = await createCalendarEvent(accessToken, input)

  if (!result.success) {
    if (result.error === 'insufficient_scope') {
      return NextResponse.json({ error: 'insufficient_scope' }, { status: 403 })
    }
    return NextResponse.json(
      { error: result.error, detail: result.errorMessage },
      { status: 500 }
    )
  }

  return NextResponse.json({
    eventId: result.eventId,
    htmlLink: result.htmlLink,
  })
}
