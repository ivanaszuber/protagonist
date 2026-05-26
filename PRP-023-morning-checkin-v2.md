# PRP-023 · Morning Check-In v2 — Context-Aware Ritual

**Status:** Approved — ready for implementation  
**Priority:** High  
**Depends on:** PRP-019 (dashboard), PRP-021 (TopNav + oracle-closed event)

---

## Overview

Replace the current hollow check-in (opens Oracle, any note counts as "done") with a genuine morning ritual. The user speaks freely for 30–60 seconds about their day. Oracle listens, cross-references everything against their calendar and existing tasks, creates any missing tasks it hears mentioned, and ends with a structured battle plan for the day.

No confirmation step — Oracle acts, then shows what it did. Fast, magical, zero friction.

---

## The full flow

### Step 1 — Button tap

The existing "🌅 Good morning — check in with Oracle" button fires:

```ts
window.dispatchEvent(new CustomEvent('protagonist:open-oracle', {
  detail: { prefill: 'Good morning', context: 'morning_checkin' }
}))
```

The `context: 'morning_checkin'` flag is new — it tells OracleSheet to enter check-in mode rather than the generic Oracle flow.

### Step 2 — Oracle opens in check-in mode

When `context === 'morning_checkin'`, OracleSheet:

1. Sets a new sheet state: `'checkin-listening'`
2. Shows a **morning context card** above the mic button — a brief summary of what Oracle already knows:

```
Good morning, Ivana ☀

Readiness 72 · Sleep 68 · Move —
3 tasks due today · 2 calendar events
```

This reassures the user that Oracle is primed with their data. It loads this context from a single `/api/oracle/morning-context?userId=X` call that fires as soon as the sheet opens.

3. The mic starts automatically (calls `startVoice()` on mount when in check-in mode) — user doesn't need to tap anything, they just start talking.

4. Subtitle shows: *"Tell me about your day — I'm listening"*

### Step 3 — User speaks freely

User speaks naturally — feelings, plans, things to do, events they're aware of. The mic stays open (continuous mode, already implemented). When done, they tap the Stop / Send button.

Example transcript:
> *"I didn't sleep too well but I'm feeling pretty energised. I'm planning to work on the Protagonist app this morning. Later I have drinks with Victoria. I should definitely get a manicure before the drinks, and I also need to wash my clothes at some point today."*

### Step 4 — Processing (the smart part)

OracleSheet posts to **`POST /api/oracle/morning-checkin`** with:

```ts
{
  userId: string,
  transcript: string
}
```

The endpoint fetches all context server-side (parallel):
- Today's calendar events: `getCalendarEvents(userId, today)`
- Today's tasks: `getTodayTasks(userId, today)` 
- Active quests + streaks: `getMainQuests(userId)`
- Vitality: `getOuraDaily(userId, today)` (with yesterday fallback)
- Mood log for today if exists

Then sends one Claude call with a structured prompt (see below).

Claude returns JSON. The endpoint:
1. Creates any new tasks Claude identified
2. Saves the transcript as a voice note (so check-in status = true)
3. Returns the full structured result to the client

### Step 5 — Morning briefing card

OracleSheet transitions to `'checkin-done'` state and renders a summary card:

```
☀ Morning check-in complete

📅 Already on your schedule
   ✓  Work on Protagonist app  ·  09:00–12:00
   ✓  Drinks with Victoria  ·  19:30

✨ Added 2 tasks
   💅  Manicure before drinks  [Love]  today
   🧺  Wash clothes  [Family]  today

⚔ Today's focus
   1.  Protagonist app — this is your main Forge push
   2.  Manicure + get ready before 19:30
   3.  Vault: quick savings review (3 days overdue)

🔮  "Sleep was rough but your energy says otherwise.
     Today's a build day — make something you're proud of."
```

Two buttons at the bottom: **"Go build"** (closes Oracle, fires `protagonist:oracle-closed`) and **"Add something"** (resets to idle input mode).

---

## New API: `POST /api/oracle/morning-checkin`

**New file:** `src/app/api/oracle/morning-checkin/route.ts`

### Request

```ts
{
  userId: string
  transcript: string
}
```

### Implementation

```ts
export async function POST(request: Request) {
  const { userId, transcript } = await request.json()

  // 1. Fetch context in parallel
  const today = new Date().toISOString().split('T')[0]
  const [calendarEvents, tasks, quests, ouraRow] = await Promise.all([
    getCalendarEventsForUser(userId, today),
    getTodayTasksForUser(userId, today),
    getMainQuestsForUser(userId),
    getOuraDailyWithFallback(userId, today),
  ])

  // 2. Build Claude prompt
  const prompt = buildMorningCheckinPrompt({
    transcript,
    today,
    calendarEvents,
    tasks,
    quests,
    ouraRow,
  })

  // 3. Call Claude
  const result = await callClaude(prompt)

  // 4. Create new tasks
  const createdTasks = []
  for (const task of result.new_tasks) {
    const created = await createTask(userId, task)
    createdTasks.push(created)
  }

  // 5. Save transcript as voice note (marks check-in as done)
  await saveVoiceNote(userId, transcript, result.oracle_message)

  // 6. Return
  return NextResponse.json({
    calendar_matches: result.calendar_matches,
    new_tasks: createdTasks,
    focus_list: result.focus_list,
    suggestions: result.suggestions,
    oracle_message: result.oracle_message,
    mood_signal: result.mood_signal,
  })
}
```

### Claude prompt

```ts
function buildMorningCheckinPrompt({ transcript, today, calendarEvents, tasks, quests, ouraRow }) {
  return `You are Oracle, the intelligent morning strategist for Protagonist — a personal RPG life app.

Today: ${today} (${new Date().toLocaleDateString('en-GB', { weekday: 'long' })})

## What Protagonist already knows about today:

### Calendar events today:
${calendarEvents.length ? calendarEvents.map(e => `- "${e.title}" at ${e.start_time ?? 'all day'}`).join('\n') : '(none)'}

### Tasks already scheduled for today:
${tasks.length ? tasks.map(t => `- "${t.title}" [${t.dimension}] ${t.completed ? '(completed)' : '(pending)'}`).join('\n') : '(none)'}

### Active quests:
${quests.map(q => `- ${q.dimension}: "${q.vision}" — streak: ${q.streak_days ?? 0}d, last task: ${q.last_task_date ?? 'unknown'}`).join('\n')}

### Oura biometrics:
- Readiness: ${ouraRow?.readiness_score ?? 'unknown'}
- Sleep: ${ouraRow?.sleep_score ?? 'unknown'}
- Activity: ${ouraRow?.activity_score ?? 'unknown'}

## What the user said this morning (transcript):
"${transcript}"

## Your job:
Read the transcript carefully. Do the following:

1. **calendar_matches** — identify anything the user mentioned that is already in their calendar. Match loosely (e.g. "drinks with Victoria" matches a calendar event called "Drinks - Victoria"). Return the matched event titles.

2. **new_tasks** — identify any concrete action items mentioned in the transcript that are NOT already in their tasks or calendar. For each:
   - title: clean, actionable task title
   - dimension: infer from context (career/social/wealth/vitality/mind/love/family)
   - due_date: "${today}" unless they said something specific like "this week" or "tomorrow"
   - xp_reward: 25 (small), 50 (standard), 100 (meaningful)

3. **mood_signal** — extract their subjective energy/mood from the transcript (e.g. "tired but energised", "feeling sharp", "low energy"). This overrides biometric scores for recommendations.

4. **focus_list** — top 3 things they should do today, ordered by importance. Draw from: existing tasks, new tasks you just identified, and quest-based suggestions. Be specific and human. Each item: { text: string, dimension: string | null }

5. **suggestions** — 1–2 additional things worth doing today based on their active quests and readiness. E.g. a quest that hasn't been touched in 3+ days, or a quick win if energy is high. Only suggest things not already covered in focus_list.

6. **oracle_message** — one punchy, personal line. Max 20 words. Reference something specific from their transcript. Energising, not generic. Don't start with "Remember" or "You've got this".

Respond ONLY with valid JSON:
{
  "calendar_matches": ["event title 1", "event title 2"],
  "new_tasks": [
    {
      "title": "...",
      "dimension": "love" | "career" | "social" | "wealth" | "vitality" | "mind" | "family",
      "due_date": "YYYY-MM-DD",
      "xp_reward": 50
    }
  ],
  "mood_signal": "...",
  "focus_list": [
    { "text": "...", "dimension": "career" | null }
  ],
  "suggestions": [
    { "text": "...", "dimension": "..." }
  ],
  "oracle_message": "..."
}`
}
```

---

## New API: `GET /api/oracle/morning-context`

A lightweight endpoint called when the check-in sheet opens (before the user speaks) to populate the context card.

**New file:** `src/app/api/oracle/morning-context/route.ts`

```ts
// GET /api/oracle/morning-context?userId=X
// Returns: { readiness, sleep, activity, task_count, event_count, already_checked_in }
```

Returns enough to render the pre-speech context card. No Claude call — pure DB reads.

---

## OracleSheet changes

**File:** `src/components/OracleSheet.tsx`

### New sheet states

```ts
type SheetState =
  | 'closed'
  | 'idle'
  | 'recording'
  | 'thinking'
  | 'task-done'
  | 'note-done'
  | 'calendar-confirm'
  | 'calendar-done'
  | 'chat'
  | 'checkin-loading'    // NEW: loading morning context
  | 'checkin-listening'  // NEW: mic auto-started, user speaking
  | 'checkin-thinking'   // NEW: processing transcript
  | 'checkin-done'       // NEW: showing briefing card
```

### New interface

```ts
interface MorningCheckinResult {
  calendar_matches: string[]
  new_tasks: Array<{ title: string; dimension: string; due_date: string; xp_reward: number }>
  focus_list: Array<{ text: string; dimension: string | null }>
  suggestions: Array<{ text: string; dimension: string }>
  oracle_message: string
  mood_signal: string
}

interface MorningContext {
  readiness: number | null
  sleep: number | null
  activity: number | null
  task_count: number
  event_count: number
}
```

### Opening in check-in mode

In the `protagonist:open-oracle` event handler, detect the `context` flag:

```ts
const handler = (e: Event) => {
  const detail = (e as CustomEvent<{ prefill?: string; context?: string }>).detail
  setInputText(detail?.prefill ?? '')
  if (detail?.context === 'morning_checkin') {
    setState('checkin-loading')
    void loadMorningContext()
  } else {
    setState('idle')
    setTimeout(() => inputRef.current?.focus(), 100)
  }
}
```

### `loadMorningContext()`

```ts
const loadMorningContext = useCallback(async () => {
  try {
    const res = await fetch(`/api/oracle/morning-context?userId=${encodeURIComponent(userId)}`)
    const data = await res.json() as MorningContext
    setMorningContext(data)
    setState('checkin-listening')
    // Auto-start mic
    setTimeout(() => startVoice(), 200)
  } catch {
    setState('checkin-listening')
    setTimeout(() => startVoice(), 200)
  }
}, [userId, startVoice])
```

### `handleCheckinSubmit()`

Called instead of `handleSubmit` when state is `'checkin-listening'`:

```ts
const handleCheckinSubmit = useCallback(async () => {
  const text = inputText.trim()
  if (!text) return

  stopVoice()
  setState('checkin-thinking')

  try {
    const res = await fetch('/api/oracle/morning-checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, transcript: text }),
    })
    const data = await res.json() as MorningCheckinResult
    setCheckinResult(data)
    setState('checkin-done')
    // Tell dashboard to refresh
    window.dispatchEvent(new CustomEvent('protagonist:oracle-closed'))
  } catch {
    setState('idle')
  }
}, [inputText, userId, stopVoice])
```

### Send button wiring

The Send button should call `handleCheckinSubmit` when in `checkin-listening` state:

```tsx
onClick={() => state === 'checkin-listening'
  ? void handleCheckinSubmit()
  : void handleSubmit()
}
```

### Check-in states UI

**`checkin-loading` state:**
```tsx
<div style={{ padding: '20px 14px', textAlign: 'center', color: '#5A4A7A', fontSize: 12 }}>
  Loading your morning context...
</div>
```

**`checkin-listening` state:**
Show the context card + mic (auto-running) + send button.

Context card (above input area):
```tsx
{morningContext && (
  <div style={{
    background: '#0D0820',
    border: '0.5px solid #2D1B55',
    borderRadius: 10,
    padding: '10px 12px',
    marginBottom: 10,
    fontSize: 11,
    color: '#5A4A7A',
    lineHeight: 1.6,
  }}>
    <div style={{ color: '#E8E0F0', fontWeight: 500, marginBottom: 4 }}>
      Good morning, Ivana ☀
    </div>
    <div>
      Readiness {morningContext.readiness ?? '--'} · Sleep {morningContext.sleep ?? '--'}
    </div>
    <div>
      {morningContext.task_count} tasks · {morningContext.event_count} calendar events today
    </div>
  </div>
)}
```

Then the standard recording input area (shows live transcript while speaking).

**`checkin-thinking` state:**
```tsx
<div style={{ padding: '20px 14px', textAlign: 'center' }}>
  <div style={{ fontSize: 13, color: '#E8E0F0', marginBottom: 6 }}>Analysing your day...</div>
  <div style={{ fontSize: 11, color: '#5A4A7A' }}>cross-referencing calendar · extracting tasks</div>
</div>
```

**`checkin-done` state:**

Full briefing card:
```tsx
{checkinResult && (
  <div style={{ marginBottom: 10 }}>
    {/* Calendar matches */}
    {checkinResult.calendar_matches.length > 0 && (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#5A4A7A', marginBottom: 6 }}>📅 Already on your schedule</div>
        {checkinResult.calendar_matches.map((m, i) => (
          <div key={i} style={{ fontSize: 12, color: '#7A6A9A', padding: '3px 0' }}>
            ✓ {m}
          </div>
        ))}
      </div>
    )}

    {/* New tasks added */}
    {checkinResult.new_tasks.length > 0 && (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#5A4A7A', marginBottom: 6 }}>
          ✨ Added {checkinResult.new_tasks.length} task{checkinResult.new_tasks.length > 1 ? 's' : ''}
        </div>
        {checkinResult.new_tasks.map((t, i) => (
          <div key={i} style={{ fontSize: 12, color: '#C0B0E0', padding: '3px 0' }}>
            {t.title}
            <span style={{
              marginLeft: 6,
              fontSize: 9,
              color: CHARACTERS[t.dimension as Dimension]?.color ?? '#9333EA',
              background: `${CHARACTERS[t.dimension as Dimension]?.color ?? '#9333EA'}18`,
              border: `0.5px solid ${CHARACTERS[t.dimension as Dimension]?.color ?? '#9333EA'}`,
              borderRadius: 20,
              padding: '1px 6px',
            }}>
              {t.dimension}
            </span>
          </div>
        ))}
      </div>
    )}

    {/* Today's focus */}
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#5A4A7A', marginBottom: 6 }}>⚔ Today&apos;s focus</div>
      {checkinResult.focus_list.map((item, i) => (
        <div key={i} style={{ fontSize: 12, color: '#E8E0F0', padding: '3px 0' }}>
          <span style={{ color: '#5A4A7A', marginRight: 6 }}>{i + 1}.</span>
          {item.text}
        </div>
      ))}
    </div>

    {/* Oracle message */}
    <div style={{
      background: '#1A0D35',
      border: '0.5px solid #2D1B55',
      borderLeft: '3px solid #9333EA',
      padding: '10px 12px',
      borderRadius: '0 10px 10px 10px',
    }}>
      <div style={{ fontSize: 10, color: '#9333EA', marginBottom: 4 }}>Oracle</div>
      <div style={{ fontSize: 12, color: '#A090C0', fontStyle: 'italic', lineHeight: 1.5 }}>
        {checkinResult.oracle_message}
      </div>
    </div>
  </div>
)}
```

Buttons:
```tsx
<div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
  <button onClick={() => { setState('idle'); setInputText('') }} style={ghostButtonStyle}>
    Add something
  </button>
  <button onClick={close} style={primaryButtonStyle}>
    Go build ›
  </button>
</div>
```

---

## Dashboard changes

**File:** `src/app/dashboard/page.tsx`

Update the check-in button `onClick` to pass the `context` flag:

```ts
// Change from:
onClick={() => openOracle('Good morning')

// To:
onClick={() => {
  window.dispatchEvent(new CustomEvent('protagonist:open-oracle', {
    detail: { prefill: 'Good morning', context: 'morning_checkin' }
  }))
}
```

(If `openOracle` is a wrapper function, update it to accept an optional `context` param and pass it through.)

---

## Part 2 — Dev Reset Tool

A destructive reset button for testing. Wipes all user data so morning check-in (and everything else) can be retested from scratch.

### New API: `POST /api/dev/reset`

**New file:** `src/app/api/dev/reset/route.ts`

```ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Safety check — only allow in non-production or for specific user
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_RESET) {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  const { userId } = await request.json() as { userId: string }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // Delete in dependency order
  await supabaseAdmin.from('boss_kills').delete().eq('user_id', userId)
  await supabaseAdmin.from('boss_battles').delete().eq('user_id', userId)
  await supabaseAdmin.from('medals').delete().eq('user_id', userId)
  await supabaseAdmin.from('tasks').delete().eq('user_id', userId)
  await supabaseAdmin.from('voice_notes').delete().eq('user_id', userId)
  await supabaseAdmin.from('mood_logs').delete().eq('user_id', userId)
  await supabaseAdmin.from('mood_entries').delete().eq('user_id', userId)
  await supabaseAdmin.from('quest_dimension_xp').delete().eq('user_id', userId)
  await supabaseAdmin.from('main_quests').delete().eq('user_id', userId)

  return NextResponse.json({ ok: true, message: 'All user data reset' })
}
```

**Tables deleted (in order):**
1. `boss_kills` (references boss_battles)
2. `boss_battles` (references main_quests via quest_id)
3. `medals`
4. `tasks` (references main_quests)
5. `voice_notes`
6. `mood_logs` / `mood_entries`
7. `quest_dimension_xp`
8. `main_quests`

**Not deleted** (intentionally preserved):
- `oura_daily` — biometric history, not user-generated
- `calendar_events` — synced from Google, not user-generated
- `google_tokens` / `oura_tokens` — auth credentials, must never be wiped
- `users` / `auth.users` — account record

### Dev Reset UI

Add to the **MenuDrawer** in `src/components/TopNav.tsx`, below the existing rows, only rendered when `process.env.NODE_ENV !== 'production'` (or controlled by a `NEXT_PUBLIC_SHOW_DEV_TOOLS=true` env var):

```tsx
{process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === 'true' && (
  <button
    key="dev-reset"
    type="button"
    onClick={() => void handleDevReset()}
    style={{
      width: '100%',
      minHeight: 48,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 20px',
      background: 'transparent',
      border: 'none',
      borderTop: '0.5px solid #3B0010',
      cursor: 'pointer',
      fontFamily: 'inherit',
      textAlign: 'left',
    }}
  >
    <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>🗑</span>
    <span style={{ flex: 1, fontSize: 14, color: '#ef4444' }}>Dev: Reset all data</span>
    {devResetState === 'loading' && (
      <span style={{ fontSize: 10, color: '#5A4A7A' }}>Resetting...</span>
    )}
    {devResetState === 'done' && (
      <span style={{ fontSize: 10, color: '#34d399' }}>Done ✓</span>
    )}
  </button>
)}
```

The `handleDevReset` function in `MenuDrawer`:

```ts
const [devResetState, setDevResetState] = useState<'idle' | 'loading' | 'done'>('idle')

async function handleDevReset() {
  if (devResetState === 'loading') return
  setDevResetState('loading')
  try {
    await fetch('/api/dev/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setDevResetState('done')
    onClose()
    // Hard reload so all dashboard state clears
    window.location.reload()
  } catch {
    setDevResetState('idle')
  }
}
```

Add `NEXT_PUBLIC_SHOW_DEV_TOOLS=true` to `.env.local` (never committed). Remove from `.env.local` when testing in production conditions.

---

## Summary of files

| File | Change |
|------|--------|
| `src/app/api/oracle/morning-checkin/route.ts` | **New** — full check-in processing with Claude |
| `src/app/api/oracle/morning-context/route.ts` | **New** — lightweight pre-speech context card data |
| `src/app/api/dev/reset/route.ts` | **New** — destructive reset for testing |
| `src/components/OracleSheet.tsx` | Add 4 new states, `loadMorningContext`, `handleCheckinSubmit`, briefing card UI, context card UI |
| `src/app/dashboard/page.tsx` | Update check-in button to pass `context: 'morning_checkin'` |
| `src/components/TopNav.tsx` | Add dev reset row to MenuDrawer (env-gated) |

---

## Constraints

- TypeScript strict mode — `npx tsc --noEmit` must pass
- Dev reset endpoint: guarded by `NEXT_PUBLIC_SHOW_DEV_TOOLS` env var — never exposed in production without explicit opt-in
- `SUPABASE_SERVICE_ROLE_KEY` used in dev reset endpoint — server-only, never in any `NEXT_PUBLIC_` var
- Mic auto-starts when check-in sheet opens — only when `context === 'morning_checkin'`, never on regular Oracle open
- If the morning context call fails, continue to `checkin-listening` silently — morning context card just doesn't show
- If the morning-checkin API call fails, fall back to `idle` state with the user's transcript preserved in the input

---

## Acceptance criteria

- [ ] Tapping "Good morning" button opens Oracle in check-in mode (not generic Oracle)
- [ ] Morning context card shows readiness, sleep, task count, event count before user speaks
- [ ] Mic auto-starts when check-in sheet opens
- [ ] Live transcript appears as user speaks (already implemented in PRP-021/voice fix)
- [ ] Submitting calls `/api/oracle/morning-checkin` (not `/api/oracle/classify`)
- [ ] "Analysing your day" state shown during processing
- [ ] Calendar events mentioned in transcript are correctly matched and shown as ✓
- [ ] New action items not in calendar/tasks are created as tasks with correct dimension
- [ ] Focus list shows top 3 items with quest-aware suggestions
- [ ] Oracle message is specific to the user's transcript (not generic)
- [ ] "Go build" closes Oracle and fires `protagonist:oracle-closed` (dashboard refreshes tasks)
- [ ] Dev reset button visible when `NEXT_PUBLIC_SHOW_DEV_TOOLS=true`
- [ ] Dev reset deletes all user-generated data and reloads the page
- [ ] Dev reset does NOT delete oura_daily, calendar_events, or auth tokens
- [ ] `npx tsc --noEmit` passes
