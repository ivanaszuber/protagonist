# PRP-024 · Champion Card Layout Fix + Oracle Calendar Management

**Status:** Approved — ready for implementation  
**Priority:** High  
**Depends on:** PRP-022 (Google Calendar write scope + `createCalendarEvent`)

---

## Overview

Three changes:

1. **Fix champion card pill layout** — dimension pill sits left of the Lv badge (top row), not below the character SVG
2. **Oracle calendar updates** — "move my 2pm meeting to tomorrow at 5" → Oracle finds the event and reschedules it
3. **Oracle calendar deletes** — "cancel my 3pm today" → Oracle finds the event, confirms with user, deletes it

---

## Fix 1 — Champion card pill layout

**File:** `src/app/dashboard/page.tsx`

### Problem

Non-Root champion cards use `display: 'block'`, which stacks the SVG container and content div vertically. The dimension pill and Lv badge are correctly on the same row *within* the content div, but the content div itself sits below the SVG — so the pill appears below the character art instead of beside it.

### Fix

Change all cards (not just Root) to `display: 'flex'`, with the SVG on the left and content on the right. Root already uses this layout — all 7 cards should match it.

```tsx
// Change from:
style={{
  display: isRoot ? 'flex' : 'block',
  gap: isRoot ? 10 : undefined,
  alignItems: isRoot ? 'center' : undefined,
  ...
}}

// Change to:
style={{
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  ...
}}
```

The SVG container stays at `width: 38, height: 46` for non-Root. The content div keeps `flex: 1, minWidth: 0`. The pill+Lv row at the top of the content div will now render visually to the right of the character SVG — exactly the intended layout.

Remove `paddingRight: 4` from the content div since the card padding handles it.

---

## Fix 2 — Oracle calendar updates

### New intent: `CALENDAR_UPDATE`

When the user says something like:
- *"Move my 2pm meeting to tomorrow at 5"*
- *"Reschedule drinks with Victoria to Saturday"*
- *"Change my 10am to 11am"*
- *"Push my 3 o'clock to next Monday"*

### Classifier changes

**File:** `src/app/api/oracle/classify/route.ts`

**Step 1 — Inject today's + tomorrow's events into classifier context**

After the existing `questContext` fetch, add:

```ts
let calendarContext = '(none)'
if (isSupabaseConfigured()) {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]
  const { data: events } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, event_date')
    .eq('user_id', userId)
    .in('event_date', [today, tomorrow])
    .order('start_time', { ascending: true })
    .limit(20)

  calendarContext =
    (events ?? [])
      .map((e) => {
        const timeStr = e.start_time
          ? new Date(e.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          : 'all day'
        const dayStr = e.event_date === today ? 'today' : 'tomorrow'
        return `- id:"${e.id}" "${e.title}" ${dayStr} at ${timeStr}`
      })
      .join('\n') || '(none)'
}
```

**Step 2 — Add to prompt context block**

```ts
The user's calendar events (today + tomorrow):
${calendarContext}
```

**Step 3 — Add intents to classifier prompt**

Add after `CALENDAR_CREATE`:

```
7. CALENDAR_UPDATE — user wants to reschedule, move, or change the time/date of an existing calendar event. Keywords: "move", "reschedule", "push", "change time", "shift", "postpone". Only use when clearly referring to an existing event.

8. CALENDAR_DELETE — user wants to cancel or delete an existing calendar event. Keywords: "cancel", "delete", "remove", "drop", "skip". Only use when clearly referring to an existing event.
```

**Step 4 — Add extraction fields to JSON schema**

```json
"calendar_update": {
  "event_id": "...",
  "event_title": "...",
  "current_time": "HH:MM or null",
  "current_date": "YYYY-MM-DD",
  "new_date": "YYYY-MM-DD",
  "new_start_time": "HH:MM or null",
  "new_duration_minutes": 60
} | null,

"calendar_delete": {
  "event_id": "...",
  "event_title": "...",
  "event_time": "HH:MM or null",
  "event_date": "YYYY-MM-DD"
} | null
```

**Step 5 — Extraction rules to add to the prompt**

```
For CALENDAR_UPDATE, extract:
- event_id: the id from the calendar context that best matches what the user described (match by title + approximate time)
- event_title: the matched event title (as it appears in the calendar context)
- current_date: the event's current date
- current_time: the event's current start time (HH:MM)
- new_date: the new date the user wants (interpret "tomorrow", "Saturday", "next Monday" relative to today ${today})
- new_start_time: the new start time in HH:MM 24h format, or null if unchanged
- new_duration_minutes: duration in minutes, default 60, or unchanged if not mentioned

For CALENDAR_DELETE, extract:
- event_id: the id from the calendar context that best matches
- event_title: the matched event title
- event_date: the event's date
- event_time: the event's start time (HH:MM) or null
```

**Step 6 — Update ClassifyResult type** (in `classify/route.ts` and in `OracleSheet.tsx`):

```ts
interface ClassifyResult {
  intent: 'TASK' | 'NOTE' | 'LEGEND' | 'BOSS' | 'CALENDAR_CREATE' | 'CALENDAR_UPDATE' | 'CALENDAR_DELETE' | 'CHAT'
  // ...existing fields...
  calendar_update?: {
    event_id: string
    event_title: string
    current_date: string
    current_time: string | null
    new_date: string
    new_start_time: string | null
    new_duration_minutes: number
  } | null
  calendar_delete?: {
    event_id: string
    event_title: string
    event_date: string
    event_time: string | null
  } | null
}
```

---

### New API: `PATCH /api/calendar/update`

**New file:** `src/app/api/calendar/update/route.ts`

```ts
import { NextResponse } from 'next/server'
import { getGoogleTokensForUser, refreshAndSaveGoogleTokens } from '@/lib/db'
import { updateCalendarEvent } from '@/lib/google'

export async function PATCH(request: Request) {
  const body = await request.json() as {
    userId: string
    eventId: string
    newDate: string
    newStartTime?: string
    newDurationMinutes?: number
  }

  const { userId, eventId, newDate, newStartTime, newDurationMinutes } = body
  if (!userId || !eventId || !newDate) {
    return NextResponse.json({ error: 'userId, eventId, newDate required' }, { status: 400 })
  }

  const tokens = await getGoogleTokensForUser(userId)
  if (!tokens) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  let accessToken = tokens.access_token
  if (tokens.expires_at < new Date()) {
    if (!tokens.refresh_token) return NextResponse.json({ error: 'not_connected' }, { status: 401 })
    const refreshed = await refreshAndSaveGoogleTokens(userId, tokens.refresh_token)
    accessToken = refreshed.access_token
  }

  const result = await updateCalendarEvent(accessToken, eventId, {
    date: newDate,
    startTime: newStartTime,
    durationMinutes: newDurationMinutes ?? 60,
  })

  if (!result.success) {
    if (result.error === 'insufficient_scope') {
      return NextResponse.json({ error: 'insufficient_scope' }, { status: 403 })
    }
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, htmlLink: result.htmlLink })
}
```

### New API: `DELETE /api/calendar/delete`

**New file:** `src/app/api/calendar/delete/route.ts`

```ts
import { NextResponse } from 'next/server'
import { getGoogleTokensForUser, refreshAndSaveGoogleTokens } from '@/lib/db'
import { deleteCalendarEvent } from '@/lib/google'

export async function POST(request: Request) {
  // Using POST not DELETE so body is easy to pass from fetch()
  const body = await request.json() as { userId: string; eventId: string }
  const { userId, eventId } = body

  if (!userId || !eventId) {
    return NextResponse.json({ error: 'userId and eventId required' }, { status: 400 })
  }

  const tokens = await getGoogleTokensForUser(userId)
  if (!tokens) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  let accessToken = tokens.access_token
  if (tokens.expires_at < new Date()) {
    if (!tokens.refresh_token) return NextResponse.json({ error: 'not_connected' }, { status: 401 })
    const refreshed = await refreshAndSaveGoogleTokens(userId, tokens.refresh_token)
    accessToken = refreshed.access_token
  }

  const result = await deleteCalendarEvent(accessToken, eventId)

  if (!result.success) {
    if (result.error === 'insufficient_scope') {
      return NextResponse.json({ error: 'insufficient_scope' }, { status: 403 })
    }
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

### `src/lib/google.ts` additions

Add `updateCalendarEvent` and `deleteCalendarEvent` after the existing `createCalendarEvent`:

```ts
export interface UpdateEventInput {
  date: string           // YYYY-MM-DD — new date
  startTime?: string     // HH:MM 24h — new start time, omit to keep existing
  durationMinutes?: number
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  input: UpdateEventInput
): Promise<CreateEventResult> {
  // First fetch the existing event to preserve fields we're not changing
  const existingRes = await fetch(
    `${CALENDAR_BASE}/calendars/primary/events/${eventId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!existingRes.ok) {
    return { success: false, error: 'api_error', errorMessage: 'Event not found' }
  }
  const existing = await existingRes.json()

  // Build the updated event body
  let patchBody: Record<string, unknown>

  if (input.startTime) {
    const startIso = `${input.date}T${input.startTime}:00`
    const startMs = new Date(startIso).getTime()
    const endMs = startMs + (input.durationMinutes ?? 60) * 60_000
    patchBody = {
      start: { dateTime: startIso, timeZone: 'Europe/London' },
      end: { dateTime: new Date(endMs).toISOString(), timeZone: 'Europe/London' },
    }
  } else {
    // Time unchanged — just move the date, preserve existing time offset
    const existingStart: string = existing.start?.dateTime ?? existing.start?.date ?? input.date
    const existingEnd: string = existing.end?.dateTime ?? existing.end?.date ?? input.date
    const startDate = existingStart.split('T')[1]
    const endDate = existingEnd.split('T')[1]
    if (startDate && endDate) {
      patchBody = {
        start: { dateTime: `${input.date}T${startDate}`, timeZone: 'Europe/London' },
        end: { dateTime: `${input.date}T${endDate}`, timeZone: 'Europe/London' },
      }
    } else {
      // All-day event — just move the date
      patchBody = {
        start: { date: input.date },
        end: { date: input.date },
      }
    }
  }

  const res = await fetch(
    `${CALENDAR_BASE}/calendars/primary/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patchBody),
    }
  )

  if (res.status === 403) {
    const data = await res.json().catch(() => ({}))
    const msg = (data as { error?: { message?: string } })?.error?.message ?? ''
    if (msg.toLowerCase().includes('insufficient')) {
      return { success: false, error: 'insufficient_scope' }
    }
  }
  if (!res.ok) {
    return { success: false, error: 'api_error', errorMessage: await res.text().catch(() => '') }
  }

  const updated = await res.json()
  return { success: true, eventId: updated.id as string, htmlLink: updated.htmlLink as string }
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<{ success: boolean; error?: 'insufficient_scope' | 'api_error'; errorMessage?: string }> {
  const res = await fetch(
    `${CALENDAR_BASE}/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (res.status === 204) return { success: true }  // Google returns 204 on success

  if (res.status === 403) {
    const data = await res.json().catch(() => ({}))
    const msg = (data as { error?: { message?: string } })?.error?.message ?? ''
    if (msg.toLowerCase().includes('insufficient')) {
      return { success: false, error: 'insufficient_scope' }
    }
  }

  return { success: false, error: 'api_error', errorMessage: await res.text().catch(() => '') }
}
```

---

### OracleSheet changes

**File:** `src/components/OracleSheet.tsx`

#### New sheet states

```ts
type SheetState =
  | ... // existing states
  | 'calendar-update-confirm'   // NEW
  | 'calendar-delete-confirm'   // NEW
  | 'calendar-manage-done'      // NEW — shared success state for update + delete
```

#### New state variables

```ts
const [calendarManageAction, setCalendarManageAction] = useState<'update' | 'delete' | null>(null)
const [calendarManageDoneMsg, setCalendarManageDoneMsg] = useState('')
const [calendarManaging, setCalendarManaging] = useState(false)
```

#### Handle new intents in `handleSubmit`

In the `handleSubmit` function, add after the `CALENDAR_CREATE` case:

```ts
} else if (data.intent === 'CALENDAR_UPDATE' && data.calendar_update) {
  setResult(data)
  setCalendarManageAction('update')
  setState('calendar-update-confirm')

} else if (data.intent === 'CALENDAR_DELETE' && data.calendar_delete) {
  setResult(data)
  setCalendarManageAction('delete')
  setState('calendar-delete-confirm')
```

#### `handleCalendarUpdate` function

```ts
const handleCalendarUpdate = useCallback(async () => {
  if (!result?.calendar_update) return
  const { event_id, event_title, new_date, new_start_time, new_duration_minutes } = result.calendar_update
  setCalendarManaging(true)
  try {
    const res = await fetch('/api/calendar/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        eventId: event_id,
        newDate: new_date,
        newStartTime: new_start_time ?? undefined,
        newDurationMinutes: new_duration_minutes ?? 60,
      }),
    })
    const data = await res.json() as { error?: string }
    if (res.status === 403 && data.error === 'insufficient_scope') {
      setCalendarInsufficientScope(true)
      setState('calendar-done')  // reuse existing insufficient scope UI
    } else if (res.ok) {
      setCalendarManageDoneMsg(`✅ Updated — ${event_title} rescheduled.`)
      setState('calendar-manage-done')
      window.dispatchEvent(new CustomEvent('protagonist:calendar-updated'))
    } else {
      setCalendarManageDoneMsg("⚠️ Couldn't update the event — try again.")
      setState('calendar-manage-done')
    }
  } finally {
    setCalendarManaging(false)
  }
}, [result, userId])
```

#### `handleCalendarDelete` function

```ts
const handleCalendarDelete = useCallback(async () => {
  if (!result?.calendar_delete) return
  const { event_id, event_title } = result.calendar_delete
  setCalendarManaging(true)
  try {
    const res = await fetch('/api/calendar/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, eventId: event_id }),
    })
    const data = await res.json() as { error?: string }
    if (res.status === 403 && data.error === 'insufficient_scope') {
      setCalendarInsufficientScope(true)
      setState('calendar-done')
    } else if (res.ok) {
      setCalendarManageDoneMsg(`🗑 Cancelled — ${event_title} removed from your calendar.`)
      setState('calendar-manage-done')
      window.dispatchEvent(new CustomEvent('protagonist:calendar-updated'))
    } else {
      setCalendarManageDoneMsg("⚠️ Couldn't cancel the event — try again.")
      setState('calendar-manage-done')
    }
  } finally {
    setCalendarManaging(false)
  }
}, [result, userId])
```

#### New UI states

**`calendar-update-confirm` state:**

```tsx
{state === 'calendar-update-confirm' && result?.calendar_update && (
  <>
    <div style={{
      background: '#0D0820',
      borderRadius: 12,
      border: '0.5px solid #3D2070',
      padding: '12px',
      marginBottom: 10,
      fontSize: 12,
      color: '#C0B0E0',
      lineHeight: 1.6,
    }}>
      <div style={{ fontSize: 10, color: '#5A4A7A', marginBottom: 8 }}>📅 Reschedule event</div>
      <div style={{ fontWeight: 500, marginBottom: 4 }}>{result.calendar_update.event_title}</div>
      <div style={{ color: '#5A4A7A', textDecoration: 'line-through', fontSize: 11 }}>
        {result.calendar_update.current_date}
        {result.calendar_update.current_time ? ` · ${result.calendar_update.current_time}` : ''}
      </div>
      <div style={{ color: '#60a5fa', fontSize: 11, marginTop: 2 }}>
        → {result.calendar_update.new_date}
        {result.calendar_update.new_start_time ? ` · ${result.calendar_update.new_start_time}` : ''}
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => { setResult(null); setState('idle') }}
        disabled={calendarManaging}
        style={ghostButtonStyle}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void handleCalendarUpdate()}
        disabled={calendarManaging}
        style={{ ...primaryButtonStyle, opacity: calendarManaging ? 0.6 : 1 }}
      >
        {calendarManaging ? 'Updating...' : 'Reschedule ✓'}
      </button>
    </div>
  </>
)}
```

**`calendar-delete-confirm` state:**

```tsx
{state === 'calendar-delete-confirm' && result?.calendar_delete && (
  <>
    <div style={{
      background: '#0D0820',
      borderRadius: 12,
      border: '0.5px solid #6B1A1A',
      padding: '12px',
      marginBottom: 10,
      fontSize: 12,
      color: '#C0B0E0',
      lineHeight: 1.6,
    }}>
      <div style={{ fontSize: 10, color: '#5A4A7A', marginBottom: 8 }}>🗑 Cancel event</div>
      <div style={{ fontWeight: 500 }}>{result.calendar_delete.event_title}</div>
      {result.calendar_delete.event_time && (
        <div style={{ color: '#5A4A7A', fontSize: 11, marginTop: 2 }}>
          {result.calendar_delete.event_date} · {result.calendar_delete.event_time}
        </div>
      )}
      <div style={{ color: '#ef4444', fontSize: 11, marginTop: 8 }}>
        This will remove it from Google Calendar.
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => { setResult(null); setState('idle') }}
        disabled={calendarManaging}
        style={ghostButtonStyle}
      >
        Keep it
      </button>
      <button
        type="button"
        onClick={() => void handleCalendarDelete()}
        disabled={calendarManaging}
        style={{
          ...primaryButtonStyle,
          background: calendarManaging ? '#3B0010' : '#7F1D1D',
          border: '0.5px solid #ef4444',
          color: '#fca5a5',
          opacity: calendarManaging ? 0.6 : 1,
        }}
      >
        {calendarManaging ? 'Cancelling...' : 'Yes, cancel it'}
      </button>
    </div>
  </>
)}
```

**`calendar-manage-done` state:**

```tsx
{state === 'calendar-manage-done' && (
  <>
    <div style={{
      background: '#0D0820',
      borderRadius: 12,
      border: '0.5px solid #2D1B55',
      padding: '12px',
      marginBottom: 10,
      fontSize: 12,
      color: '#C0B0E0',
      lineHeight: 1.55,
    }}>
      {calendarManageDoneMsg}
    </div>
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => { setResult(null); setState('idle') }}
        style={ghostButtonStyle}
      >
        Do more
      </button>
      <button
        type="button"
        onClick={close}
        style={primaryButtonStyle}
      >
        Done
      </button>
    </div>
  </>
)}
```

Also add `'calendar-update-confirm'` and `'calendar-delete-confirm'` and `'calendar-manage-done'` to the subtitle and header title logic so they render sensible labels while the sheet is in those states.

---

## Summary of files changed

| File | Change |
|------|--------|
| `src/app/dashboard/page.tsx` | Fix 1: `display: 'flex'` on all champion cards |
| `src/app/api/oracle/classify/route.ts` | Fetch calendar events; add `CALENDAR_UPDATE` + `CALENDAR_DELETE` intents + extraction |
| `src/lib/google.ts` | Add `updateCalendarEvent()` and `deleteCalendarEvent()` |
| `src/app/api/calendar/update/route.ts` | **New** — PATCH endpoint |
| `src/app/api/calendar/delete/route.ts` | **New** — POST endpoint (delete by eventId) |
| `src/components/OracleSheet.tsx` | 3 new states, 2 new handlers, 3 new UI blocks, updated `ClassifyResult` type |

---

## Constraints

- TypeScript strict mode — `npx tsc --noEmit` must pass
- Calendar event injection in classifier: fail silently if DB unavailable — `calendarContext` defaults to `'(none)'`
- Update and delete both require explicit confirmation tap — never fire automatically
- Delete uses a red-tinted confirmation card to signal destructiveness
- "Keep it" / "Cancel" (not "Confirm") — button labels should feel natural
- If Oracle can't match an event (no `event_id` returned), fall through to `CHAT` intent so Oracle replies conversationally instead of showing a broken confirmation card
- `protagonist:calendar-updated` fires on success so the Today list refreshes

---

## Acceptance criteria

- [ ] Champion cards all use `display: flex` — dimension pill appears left of Lv badge, not below SVG
- [ ] "Move my 2pm to tomorrow at 5" → `CALENDAR_UPDATE` intent with correct event matched
- [ ] Update confirmation card shows current → new time with strikethrough on old
- [ ] Confirming update calls PATCH endpoint and event moves in Google Calendar
- [ ] "Cancel my drinks tonight" → `CALENDAR_DELETE` intent with correct event matched
- [ ] Delete confirmation card uses red border, "Yes, cancel it" button
- [ ] Confirming delete calls DELETE endpoint and event disappears from Google Calendar
- [ ] Both flows fire `protagonist:calendar-updated` on success → Today list refreshes
- [ ] Insufficient scope on either flow shows reconnect prompt (reuse existing `calendar-done` state)
- [ ] If no matching event found, Oracle falls through to natural conversation
- [ ] `npx tsc --noEmit` passes
