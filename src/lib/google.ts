// Google Calendar API v3 integration

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2'
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

const SCOPES =
  'https://www.googleapis.com/auth/calendar.events ' +
  'https://www.googleapis.com/auth/calendar.readonly ' +
  'https://www.googleapis.com/auth/gmail.readonly ' +
  'https://www.googleapis.com/auth/userinfo.email'

const CALENDAR_TIMEZONE = 'Europe/London'

export interface GoogleTokens {
  access_token: string
  refresh_token: string | null
  expires_at: Date
  scope: string
}

export interface CalendarEvent {
  id: string
  title: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  location: string | null
  description: string | null
  calendar_name: string
  event_date: string
}

export interface CalendarEventRow {
  google_event_id: string
  title: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  location: string | null
  description: string | null
  calendar_name: string
  event_date: string
}

export function calendarRowToEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.google_event_id,
    title: row.title,
    start_time: row.start_time,
    end_time: row.end_time,
    all_day: row.all_day,
    location: row.location,
    description: row.description,
    calendar_name: row.calendar_name,
    event_date: row.event_date,
  }
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function getGoogleAuthUrl(state: string, baseUrl: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${baseUrl}/api/calendar/callback`,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'select_account consent',
    include_granted_scopes: 'false',
    state,
  })
  return `${GOOGLE_AUTH}/auth?${params}`
}

export async function exchangeGoogleCode(code: string, baseUrl: string): Promise<GoogleTokens> {
  const res = await fetch(`${GOOGLE_AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${baseUrl}/api/calendar/callback`,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`)
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? null,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    scope: data.scope ?? SCOPES,
  }
}

export async function refreshGoogleTokens(refreshToken: string): Promise<GoogleTokens> {
  const res = await fetch(`${GOOGLE_AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`)
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    scope: data.scope ?? SCOPES,
  }
}

interface GoogleCalendarListItem {
  id: string
  summary?: string
  primary?: boolean
}

interface GoogleCalendarEventItem {
  id?: string
  status?: string
  summary?: string
  location?: string
  description?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

export async function fetchCalendarEvents(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const headers = { Authorization: `Bearer ${accessToken}` }

  const calListRes = await fetch(`${CALENDAR_BASE}/users/me/calendarList`, { headers })
  if (!calListRes.ok) throw new Error('Failed to fetch calendar list')
  const calList = await calListRes.json()

  const calendars: GoogleCalendarListItem[] = calList.items ?? []
  const relevantCalendars = calendars.filter(
    (cal) => cal.primary || !cal.summary?.toLowerCase().includes('holiday')
  )

  const timeMin = new Date(`${startDate}T00:00:00`).toISOString()
  const timeMax = new Date(`${endDate}T23:59:59`).toISOString()

  const allEvents: CalendarEvent[] = []

  await Promise.all(
    relevantCalendars.map(async (cal) => {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '20',
      })

      const eventsRes = await fetch(
        `${CALENDAR_BASE}/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
        { headers }
      )
      if (!eventsRes.ok) return

      const eventsData = await eventsRes.json()
      const events: GoogleCalendarEventItem[] = eventsData.items ?? []

      for (const event of events) {
        if (event.status === 'cancelled' || !event.id) continue

        const startObj = event.start
        const endObj = event.end
        const isAllDay = !startObj?.dateTime

        const startTime = startObj?.dateTime ?? null
        const endTime = endObj?.dateTime ?? null
        const eventDate =
          startObj?.date ?? startObj?.dateTime?.split('T')[0] ?? startDate

        allEvents.push({
          id: event.id,
          title: event.summary ?? '(No title)',
          start_time: startTime,
          end_time: endTime,
          all_day: isAllDay,
          location: event.location ?? null,
          description: event.description?.substring(0, 200) ?? null,
          calendar_name: cal.summary ?? 'Calendar',
          event_date: eventDate,
        })
      }
    })
  )

  return allEvents.sort((a, b) => {
    if (!a.start_time) return -1
    if (!b.start_time) return 1
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  })
}

export interface CreateEventInput {
  title: string
  date: string
  startTime: string
  durationMinutes: number
  description?: string
  location?: string
}

export interface CreateEventResult {
  success: boolean
  eventId?: string
  htmlLink?: string
  error?: 'insufficient_scope' | 'not_connected' | 'api_error'
  errorMessage?: string
}

function formatLocalDateTime(date: string, time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

function addMinutesToLocalDateTime(
  date: string,
  time: string,
  minutes: number
): { date: string; time: string } {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const dayOffset = Math.floor(total / (24 * 60))
  const minsInDay = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const endH = Math.floor(minsInDay / 60)
  const endM = minsInDay % 60
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + dayOffset)
  const endDate = d.toISOString().split('T')[0]
  return {
    date: endDate,
    time: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
  }
}

export async function createCalendarEvent(
  accessToken: string,
  input: CreateEventInput
): Promise<CreateEventResult> {
  const isAllDay = !input.startTime || input.durationMinutes === 0

  let body: Record<string, unknown>

  if (isAllDay) {
    body = {
      summary: input.title,
      description: input.description ?? undefined,
      location: input.location ?? undefined,
      start: { date: input.date },
      end: { date: input.date },
    }
  } else {
    const startIso = formatLocalDateTime(input.date, input.startTime)
    const endParts = addMinutesToLocalDateTime(
      input.date,
      input.startTime,
      input.durationMinutes
    )
    const endIso = formatLocalDateTime(endParts.date, endParts.time)

    body = {
      summary: input.title,
      description: input.description ?? undefined,
      location: input.location ?? undefined,
      start: { dateTime: startIso, timeZone: CALENDAR_TIMEZONE },
      end: { dateTime: endIso, timeZone: CALENDAR_TIMEZONE },
    }
  }

  const res = await fetch(`${CALENDAR_BASE}/calendars/primary/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 403) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    const msg = data.error?.message ?? ''
    if (msg.toLowerCase().includes('insufficient')) {
      return { success: false, error: 'insufficient_scope' }
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { success: false, error: 'api_error', errorMessage: text }
  }

  const created = (await res.json()) as { id?: string; htmlLink?: string }
  return {
    success: true,
    eventId: created.id,
    htmlLink: created.htmlLink,
  }
}

export interface UpdateEventInput {
  date: string
  startTime?: string
  durationMinutes?: number
}

async function parse403(res: Response): Promise<CreateEventResult | null> {
  if (res.status !== 403) return null
  try {
    const data = (await res.json()) as { error?: { message?: string } }
    const msg = data.error?.message ?? ''
    if (msg.toLowerCase().includes('insufficient')) {
      return { success: false, error: 'insufficient_scope' }
    }
  } catch {
    /* ignore */
  }
  return null
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  input: UpdateEventInput
): Promise<CreateEventResult> {
  const existingRes = await fetch(
    `${CALENDAR_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!existingRes.ok) {
    return { success: false, error: 'api_error', errorMessage: 'Event not found' }
  }

  const existing = (await existingRes.json()) as {
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
  }

  let patchBody: Record<string, unknown>

  if (input.startTime) {
    const startIso = formatLocalDateTime(input.date, input.startTime)
    const endParts = addMinutesToLocalDateTime(
      input.date,
      input.startTime,
      input.durationMinutes ?? 60
    )
    const endIso = formatLocalDateTime(endParts.date, endParts.time)
    patchBody = {
      start: { dateTime: startIso, timeZone: CALENDAR_TIMEZONE },
      end: { dateTime: endIso, timeZone: CALENDAR_TIMEZONE },
    }
  } else {
    const existingStart = existing.start?.dateTime ?? existing.start?.date
    const existingEnd = existing.end?.dateTime ?? existing.end?.date
    if (existingStart && existingStart.includes('T')) {
      const startTimePart = existingStart.split('T')[1]?.slice(0, 5) ?? '09:00'
      const endTimePart =
        existingEnd && existingEnd.includes('T')
          ? existingEnd.split('T')[1]?.slice(0, 5) ?? startTimePart
          : startTimePart
      patchBody = {
        start: {
          dateTime: formatLocalDateTime(input.date, startTimePart),
          timeZone: CALENDAR_TIMEZONE,
        },
        end: {
          dateTime: formatLocalDateTime(input.date, endTimePart),
          timeZone: CALENDAR_TIMEZONE,
        },
      }
    } else {
      patchBody = {
        start: { date: input.date },
        end: { date: input.date },
      }
    }
  }

  const res = await fetch(
    `${CALENDAR_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patchBody),
    }
  )

  const insufficient = await parse403(res)
  if (insufficient) return insufficient

  if (!res.ok) {
    return {
      success: false,
      error: 'api_error',
      errorMessage: await res.text().catch(() => ''),
    }
  }

  const updated = (await res.json()) as { id?: string; htmlLink?: string }
  return {
    success: true,
    eventId: updated.id,
    htmlLink: updated.htmlLink,
  }
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<{ success: boolean; error?: 'insufficient_scope' | 'api_error'; errorMessage?: string }> {
  const res = await fetch(
    `${CALENDAR_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (res.status === 204 || res.status === 200) {
    return { success: true }
  }

  const insufficient = await parse403(res)
  if (insufficient?.error === 'insufficient_scope') {
    return { success: false, error: 'insufficient_scope' }
  }

  return {
    success: false,
    error: 'api_error',
    errorMessage: await res.text().catch(() => ''),
  }
}

export function buildCalendarContext(events: CalendarEvent[], date: string): string {
  const todayEvents = events.filter((e) => e.event_date === date)

  if (todayEvents.length === 0) {
    return 'Calendar: No events scheduled today — open space to work on what matters.'
  }

  const lines: string[] = [
    `Today's schedule (${todayEvents.length} event${todayEvents.length > 1 ? 's' : ''}):`,
  ]

  for (const event of todayEvents) {
    if (event.all_day) {
      lines.push(`  • [All day] ${event.title}`)
    } else if (event.start_time) {
      const time = new Date(event.start_time).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const endTime = event.end_time
        ? new Date(event.end_time).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        : null
      lines.push(
        `  • ${time}${endTime ? `–${endTime}` : ''} ${event.title}${event.location ? ` @ ${event.location}` : ''}`
      )
    }
  }

  const meetingCount = todayEvents.filter(
    (e) =>
      !e.all_day &&
      e.title.toLowerCase().match(/meeting|call|sync|interview|1:1|standup/)
  ).length

  if (meetingCount >= 3) {
    lines.push(
      '\nNote: Heavy meeting day — deep work windows will be limited. Forge quests should be short and focused.'
    )
  }

  return lines.join('\n')
}

export function detectFreeBlocks(events: CalendarEvent[], date: string): string[] {
  const todayEvents = events
    .filter((e) => e.event_date === date && !e.all_day && e.start_time)
    .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime())

  if (todayEvents.length === 0) return ['Full day open']

  const blocks: string[] = []
  const workStart = 9
  const workEnd = 18

  let cursor = workStart * 60

  for (const event of todayEvents) {
    const start = new Date(event.start_time!)
    const eventStart = start.getHours() * 60 + start.getMinutes()
    const end = event.end_time ? new Date(event.end_time) : null
    const eventEnd = end ? end.getHours() * 60 + end.getMinutes() : eventStart + 60

    const gapMins = eventStart - cursor
    if (gapMins >= 60 && cursor >= workStart * 60) {
      const fromH = Math.floor(cursor / 60)
        .toString()
        .padStart(2, '0')
      const fromM = (cursor % 60).toString().padStart(2, '0')
      const toH = Math.floor(eventStart / 60)
        .toString()
        .padStart(2, '0')
      const toM = (eventStart % 60).toString().padStart(2, '0')
      blocks.push(
        `${fromH}:${fromM}–${toH}:${toM} (${Math.round((gapMins / 60) * 10) / 10}h free)`
      )
    }
    cursor = Math.max(cursor, eventEnd)
  }

  const finalGap = workEnd * 60 - cursor
  if (finalGap >= 60) {
    const fromH = Math.floor(cursor / 60)
      .toString()
      .padStart(2, '0')
    const fromM = (cursor % 60).toString().padStart(2, '0')
    blocks.push(`${fromH}:${fromM}–18:00 (${Math.round((finalGap / 60) * 10) / 10}h free)`)
  }

  return blocks.length > 0 ? blocks : ['Fully booked — no 60min+ free blocks']
}
