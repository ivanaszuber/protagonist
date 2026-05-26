# PRP-022 · Google Calendar Event Creation

**Status:** Approved — ready for implementation  
**Priority:** Medium  
**Depends on:** PRP-006 (Google Calendar read integration — already shipped)

---

## Overview

Let users create Google Calendar events from within Protagonist — via a `+` quick-add button in the Today section, or by asking Oracle in natural language ("Block 90 minutes tomorrow at 10am for interview prep"). Events are created directly in their primary Google Calendar via the Google Calendar API v3.

---

## What needs to change

Currently `src/lib/google.ts` requests only `calendar.readonly` scope. Creating events requires `calendar.events` scope. Because the scope set changes, users who already connected Google Calendar will need to re-authorise once. The app handles this with a soft re-auth prompt rather than silently failing.

---

## Fix 1 — OAuth scope upgrade

**File:** `src/lib/google.ts`

Change `SCOPES` to include write access:

```ts
const SCOPES =
  'https://www.googleapis.com/auth/calendar.events ' +
  'https://www.googleapis.com/auth/calendar.readonly ' +
  'https://www.googleapis.com/auth/gmail.readonly ' +
  'https://www.googleapis.com/auth/userinfo.email'
```

`calendar.events` is a superset of `calendar.readonly` for the primary calendar — granting it covers both reading and writing. No other scopes need changing.

### Re-auth handling

After this change, existing users have tokens with the old scope (`calendar.readonly` only). When a write call fails with HTTP 403, the response body from Google contains `"message": "Request had insufficient authentication scopes"`.

**Detection:** The new `createCalendarEvent()` function (Fix 2) checks for this specific error and returns a typed error object so the caller can show a re-auth prompt instead of a generic error.

---

## Fix 2 — `createCalendarEvent` function

**File:** `src/lib/google.ts`

Add a new export after the existing `fetchCalendarEvents` function:

```ts
export interface CreateEventInput {
  title: string
  date: string          // YYYY-MM-DD
  startTime: string     // HH:MM (24h) or null for all-day
  durationMinutes: number  // 0 for all-day
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
    const [h, m] = input.startTime.split(':').map(Number)
    const startMs = new Date(`${input.date}T${input.startTime}:00`).getTime()
    const endMs = startMs + input.durationMinutes * 60_000
    const endIso = new Date(endMs).toISOString()
    const startIso = `${input.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`

    body = {
      summary: input.title,
      description: input.description ?? undefined,
      location: input.location ?? undefined,
      start: { dateTime: startIso, timeZone: 'Europe/London' },
      end: { dateTime: endIso, timeZone: 'Europe/London' },
    }
  }

  const res = await fetch(
    `${CALENDAR_BASE}/calendars/primary/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
    const text = await res.text().catch(() => '')
    return { success: false, error: 'api_error', errorMessage: text }
  }

  const created = await res.json()
  return {
    success: true,
    eventId: created.id as string,
    htmlLink: created.htmlLink as string,
  }
}
```

---

## Fix 3 — New API endpoint `POST /api/calendar/create`

**New file:** `src/app/api/calendar/create/route.ts`

```ts
import { NextResponse } from 'next/server'
import { getGoogleTokensForUser, refreshAndSaveGoogleTokens } from '@/lib/db'
import { createCalendarEvent, CreateEventInput } from '@/lib/google'

export async function POST(request: Request) {
  const body = await request.json() as {
    userId: string
    title: string
    date: string
    startTime?: string
    durationMinutes?: number
    description?: string
    location?: string
  }

  const { userId, title, date, startTime, durationMinutes, description, location } = body

  if (!userId || !title || !date) {
    return NextResponse.json({ error: 'userId, title, and date are required' }, { status: 400 })
  }

  // Load tokens
  const tokens = await getGoogleTokensForUser(userId)
  if (!tokens) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  // Refresh if expired
  let accessToken = tokens.access_token
  if (tokens.expires_at < new Date()) {
    if (!tokens.refresh_token) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 })
    }
    const refreshed = await refreshAndSaveGoogleTokens(userId, tokens.refresh_token)
    accessToken = refreshed.access_token
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
    return NextResponse.json({ error: result.error, detail: result.errorMessage }, { status: 500 })
  }

  return NextResponse.json({ eventId: result.eventId, htmlLink: result.htmlLink })
}
```

### `db.ts` helper additions required

The endpoint uses `getGoogleTokensForUser` and `refreshAndSaveGoogleTokens`. Add these to `src/lib/db.ts` if not already present:

```ts
// Returns raw token row for a user, or null if not connected
export async function getGoogleTokensForUser(userId: string) {
  const { data } = await supabaseAdmin
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single()
  return data ?? null
}

// Refreshes tokens, persists, and returns the new row
export async function refreshAndSaveGoogleTokens(userId: string, refreshToken: string) {
  const { refreshGoogleTokens } = await import('./google')
  const tokens = await refreshGoogleTokens(refreshToken)
  await saveGoogleTokens(userId, tokens)
  return tokens
}
```

(Check whether `getGoogleTokensForUser` already exists under a different name — several db helpers overlap. If so, reuse the existing function.)

---

## Fix 4 — Oracle classifier — `CALENDAR_CREATE` intent

**File:** `src/app/api/oracle/classify/route.ts`

### Add intent to classifier prompt

Add `CALENDAR_CREATE` to the intent list (after `BOSS`):

```
6. CALENDAR_CREATE — user wants to create, schedule, block, or add a new calendar event or appointment. Keywords: "block", "schedule", "add to calendar", "book time", "create event", "put in my calendar", "add a meeting", "add an appointment". Only use this when the user is clearly creating a new event, not when viewing or discussing existing ones.
```

### Add extraction fields to the JSON schema

Add to the output schema object:

```json
"calendar_event": {
  "title": "...",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM" | null,
  "durationMinutes": 60,
  "description": "..." | null,
  "location": "..." | null
} | null
```

### Add `CALENDAR_CREATE` to the intent union type in the JSON response spec

```
"intent": "TASK" | "NOTE" | "LEGEND" | "BOSS" | "CALENDAR_CREATE" | "CHAT"
```

### Date/time extraction rules for calendar events

Include these in the classifier prompt so Oracle can parse natural language:

```
For CALENDAR_CREATE, extract:
- title: clean event title (e.g. "Interview prep", "1:1 with Sarah", "Gym session")
- date: ISO date string. Interpret: "tomorrow" = next day, "next Monday" = next occurrence of Monday, "in 3 days" = today + 3, "this Friday" = next Friday. Default to today if no date specified.
- startTime: 24h format HH:MM if specified, otherwise null (= all-day event)
- durationMinutes: duration in minutes. Default 60. Interpret: "30 mins" = 30, "1 hour" = 60, "90 minutes" = 90, "2 hours" = 120, "half an hour" = 30. If not specified default to 60.
- description: any additional context the user mentions (e.g. "prepare STAR stories") — null if none
- location: explicit location mentioned — null if none
```

---

## Fix 5 — OracleSheet handles `CALENDAR_CREATE` intent

**File:** `src/components/OracleSheet.tsx`

In the response handler where classified intents are processed (the switch/if-else block for `TASK`, `NOTE`, `LEGEND`, `BOSS`), add a `CALENDAR_CREATE` case:

```ts
if (classified.intent === 'CALENDAR_CREATE' && classified.calendar_event) {
  const ev = classified.calendar_event

  // Show a confirmation card in the Oracle chat, then create on confirm
  setMessages((prev) => [
    ...prev,
    {
      role: 'assistant',
      content: buildCalendarConfirmMessage(ev),
      pending_calendar_event: ev,
    },
  ])
  return  // don't submit to full Oracle conversation; wait for user to confirm
}
```

The confirmation message shows event details and two buttons: **"Add to Calendar ✓"** and **"Cancel"**.

### Confirmation message builder

```ts
function buildCalendarConfirmMessage(ev: CalendarEventInput): string {
  const timeStr = ev.startTime
    ? `${ev.startTime} · ${ev.durationMinutes ?? 60} min`
    : 'All day'
  return `📅 Got it — adding to your calendar:\n\n**${ev.title}**\n${ev.date} · ${timeStr}${ev.description ? `\n${ev.description}` : ''}`
}
```

### On "Add to Calendar ✓" confirm

```ts
async function handleCalendarConfirm(ev: CalendarEventInput) {
  setCalendarCreating(true)
  const res = await fetch('/api/calendar/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...ev }),
  })
  const data = await res.json()

  if (res.status === 403 && data.error === 'insufficient_scope') {
    // User needs to re-auth — show reconnect prompt
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: '🔐 To create events, reconnect Google Calendar with updated permissions.',
        reconnect_url: `/api/calendar/connect?userId=${userId}`,
      },
    ])
  } else if (res.ok) {
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: `✅ Added! **${ev.title}** is in your calendar.`,
      },
    ])
    // Trigger dashboard refresh so Today list picks up the new event
    window.dispatchEvent(new CustomEvent('protagonist:calendar-updated'))
  } else {
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '⚠️ Couldn\'t add the event — try again.' },
    ])
  }
  setCalendarCreating(false)
}
```

---

## Fix 6 — Quick-add `+` button in Today section

**File:** `src/app/dashboard/page.tsx`

### Header row

Change the Today section header from:

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', ... }}>
  <span>Today</span>
  <span>{formattedDate}</span>
</div>
```

To:

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ... }}>
  <span style={{ fontSize: 13, fontWeight: 500, color: '#E8E0F0' }}>Today</span>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: 11, color: '#5A4A7A' }}>{formattedDate}</span>
    <button
      onClick={() => setShowQuickAdd(true)}
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: '#1A0D40',
        border: '0.5px solid #4A2080',
        color: '#C084FC',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        lineHeight: 1,
        padding: 0,
      }}
      aria-label="Add calendar event"
    >
      +
    </button>
  </div>
</div>
```

### Quick-add inline form

Add state: `const [showQuickAdd, setShowQuickAdd] = useState(false)`

When `showQuickAdd` is true, render an inline card below the Today header (above the tabs):

```tsx
{showQuickAdd && (
  <div style={{
    background: '#140C28',
    border: '0.5px solid #3D2070',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 8,
  }}>
    <div style={{ fontSize: 11, color: '#9370CC', marginBottom: 10, fontWeight: 500 }}>
      📅 New Calendar Event
    </div>
    <input
      placeholder="Event title"
      value={quickAddTitle}
      onChange={(e) => setQuickAddTitle(e.target.value)}
      style={quickAddInputStyle}
    />
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <input
        type="date"
        value={quickAddDate}
        onChange={(e) => setQuickAddDate(e.target.value)}
        style={{ ...quickAddInputStyle, flex: 1 }}
      />
      <input
        type="time"
        value={quickAddTime}
        onChange={(e) => setQuickAddTime(e.target.value)}
        style={{ ...quickAddInputStyle, flex: 1 }}
      />
      <select
        value={quickAddDuration}
        onChange={(e) => setQuickAddDuration(Number(e.target.value))}
        style={{ ...quickAddInputStyle, flex: 1 }}
      >
        <option value={30}>30 min</option>
        <option value={60}>1 hr</option>
        <option value={90}>90 min</option>
        <option value={120}>2 hr</option>
      </select>
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <button onClick={handleQuickAddSubmit} style={primaryButtonStyle}>
        Add to Calendar
      </button>
      <button onClick={() => setShowQuickAdd(false)} style={ghostButtonStyle}>
        Cancel
      </button>
    </div>
    {quickAddError && (
      <div style={{ fontSize: 10, color: '#ef4444', marginTop: 6 }}>{quickAddError}</div>
    )}
  </div>
)}
```

### Quick-add state + handler

```ts
const [showQuickAdd, setShowQuickAdd] = useState(false)
const [quickAddTitle, setQuickAddTitle] = useState('')
const [quickAddDate, setQuickAddDate] = useState(new Date().toISOString().split('T')[0])
const [quickAddTime, setQuickAddTime] = useState('')
const [quickAddDuration, setQuickAddDuration] = useState(60)
const [quickAddError, setQuickAddError] = useState('')
const [quickAddLoading, setQuickAddLoading] = useState(false)

async function handleQuickAddSubmit() {
  if (!quickAddTitle.trim()) {
    setQuickAddError('Event title is required')
    return
  }
  setQuickAddLoading(true)
  setQuickAddError('')

  const res = await fetch('/api/calendar/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userIdRef.current,
      title: quickAddTitle.trim(),
      date: quickAddDate,
      startTime: quickAddTime || undefined,
      durationMinutes: quickAddDuration,
    }),
  })

  if (res.status === 403) {
    setQuickAddError('Google Calendar needs updated permissions. Reconnect in Settings.')
  } else if (!res.ok) {
    setQuickAddError('Couldn\'t add event — try again.')
  } else {
    // Reset form and close
    setQuickAddTitle('')
    setQuickAddTime('')
    setQuickAddDuration(60)
    setShowQuickAdd(false)
    // Re-fetch calendar events so new event appears in Today list
    void fetch(`/api/calendar/sync?userId=${encodeURIComponent(userIdRef.current)}`, { method: 'POST' })
      .then(() => fetch(`/api/calendar/next?userId=${encodeURIComponent(userIdRef.current)}&limit=10`))
      .then((r) => r.json())
      .then((d: { events?: CalendarEventRow[] }) => {
        if (d.events?.length) setEvents(d.events)
      })
      .catch(() => {/* calendar optional */})
  }
  setQuickAddLoading(false)
}
```

### Input style constants (add near top of component or in a shared styles file)

```ts
const quickAddInputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1A0D3A',
  border: '0.5px solid #3D2070',
  borderRadius: 8,
  padding: '7px 10px',
  color: '#E8E0F0',
  fontSize: 12,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  background: '#4A2080',
  border: '0.5px solid #7C3AED',
  borderRadius: 8,
  color: '#C084FC',
  fontSize: 11,
  fontWeight: 500,
  padding: '7px 0',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const ghostButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '0.5px solid #2D1B55',
  borderRadius: 8,
  color: '#5A4A7A',
  fontSize: 11,
  padding: '7px 12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
```

---

## Fix 7 — `protagonist:calendar-updated` event in dashboard

**File:** `src/app/dashboard/page.tsx`

When Oracle creates an event and fires `protagonist:calendar-updated`, re-fetch Today's calendar events:

```tsx
useEffect(() => {
  function onCalendarUpdated() {
    void fetch(`/api/calendar/sync?userId=${encodeURIComponent(userIdRef.current)}`, { method: 'POST' })
      .then(() => fetch(`/api/calendar/next?userId=${encodeURIComponent(userIdRef.current)}&limit=10`))
      .then((r) => r.json())
      .then((d: { events?: CalendarEventRow[] }) => {
        if (d.events?.length) setEvents(d.events)
      })
      .catch(() => {/* calendar optional */})
  }
  window.addEventListener('protagonist:calendar-updated', onCalendarUpdated)
  return () => window.removeEventListener('protagonist:calendar-updated', onCalendarUpdated)
}, [])
```

---

## Re-auth flow for existing users

Users who connected Google Calendar before this change have `calendar.readonly` tokens. On first write attempt, the API returns 403 with `insufficient_scope`. The app:

1. Returns `{ error: 'insufficient_scope' }` from the creation endpoint
2. The UI shows: *"To create events, reconnect Google Calendar with updated permissions — takes 5 seconds."* with a **Reconnect** link to `/api/calendar/connect?userId=X`
3. The reconnect flow already handles `prompt: 'select_account consent'` + `access_type: 'offline'` — it will issue new tokens covering all scopes including `calendar.events`

No schema changes needed — `google_tokens` table already stores `scope` as a text field and `access_token` / `refresh_token` as-is.

---

## Summary of files changed

| File | Change |
|------|--------|
| `src/lib/google.ts` | Add `calendar.events` to SCOPES; add `createCalendarEvent()`, `CreateEventInput`, `CreateEventResult` |
| `src/app/api/calendar/create/route.ts` | **New** — POST endpoint to create Google Calendar event |
| `src/lib/db.ts` | Add `getGoogleTokensForUser()` and `refreshAndSaveGoogleTokens()` if not already present |
| `src/app/api/oracle/classify/route.ts` | Add `CALENDAR_CREATE` intent + `calendar_event` extraction fields |
| `src/components/OracleSheet.tsx` | Handle `CALENDAR_CREATE` intent: show confirmation card, call API on confirm, fire `protagonist:calendar-updated` on success, show re-auth prompt on 403 |
| `src/app/dashboard/page.tsx` | Add `+` button to Today header, quick-add inline form + state + handler, listen for `protagonist:calendar-updated` |

---

## Constraints

- TypeScript strict mode — `npx tsc --noEmit` must pass
- `SUPABASE_SERVICE_ROLE_KEY` never in any `NEXT_PUBLIC_` variable
- Timezone defaults to `Europe/London` (BST / GMT) — the user is in London
- Calendar creation is entirely optional — if not connected, `+` button is hidden or shows a "Connect Google Calendar" prompt
- Silent failure on calendar re-fetch (calendar is an enhancement, not core)
- Never create events without explicit user confirmation (either clicking "Add to Calendar" in quick-add form or pressing confirm in Oracle card)

---

## Acceptance criteria

- [ ] `POST /api/calendar/create` creates a real event in the user's Google Calendar
- [ ] Event appears in the Today list after creation (re-fetch runs automatically)
- [ ] `+` button in Today header opens the quick-add form inline
- [ ] Quick-add form has: title (required), date (pre-filled today), time (optional), duration (dropdown)
- [ ] Submitting without a title shows validation error inline
- [ ] Oracle understands "block 90 mins tomorrow at 10am for prep" → `CALENDAR_CREATE` intent
- [ ] Oracle shows a confirmation card before creating the event
- [ ] Confirming in Oracle calls the API and fires `protagonist:calendar-updated`
- [ ] If user has `insufficient_scope` tokens, a Reconnect prompt appears (not a generic error)
- [ ] After reconnecting, creation succeeds without further prompts
- [ ] `npx tsc --noEmit` passes
