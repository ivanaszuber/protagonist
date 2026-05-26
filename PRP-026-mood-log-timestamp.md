# PRP-026 · Mood Log — Timestamp Display + Multi-Entry Context

**Status:** Approved — ready for implementation  
**Priority:** Medium  
**Depends on:** nothing — mood multi-logging already works at the DB level

---

## Background

`POST /api/mood` already does an `INSERT` (not an upsert), so every tap already creates a new row in `mood_entries` with a `created_at` timestamp. Multi-logging throughout the day is free — it just isn't surfaced anywhere yet.

Two small gaps to close:

1. The vitality endpoint returns `mood_today` (score only) but not the timestamp of the last entry
2. The dashboard stores and displays the score but has no concept of *when* it was logged

---

## Changes

### 1. `GET /api/dashboard/vitality` — also return `mood_last_logged_at`

**File:** `src/app/api/dashboard/vitality/route.ts`

In the mood query, also select `created_at`:

```ts
const { data: moodRow } = await supabase
  .from('mood_entries')
  .select('mood_score, created_at')   // add created_at
  .eq('user_id', userId)
  .gte('created_at', `${today}T00:00:00`)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```

Add `mood_last_logged_at` to the response:

```ts
return NextResponse.json({
  hp,
  readiness_score,
  sleep_score,
  activity_score,
  cycle_day,
  cycle_phase,
  mood_today: moodRow?.mood_score ?? null,
  mood_last_logged_at: moodRow?.created_at ?? null,   // new
})
```

Also add to the fallback return at the bottom:

```ts
return NextResponse.json({
  ...
  mood_today: null,
  mood_last_logged_at: null,   // new
})
```

### 2. Dashboard — `VitalityData` interface + new state

**File:** `src/app/dashboard/page.tsx`

Add `mood_last_logged_at` to the interface:

```ts
interface VitalityData {
  hp: number
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
  cycle_day: number | null
  cycle_phase: string | null
  mood_today: number | null
  mood_last_logged_at: string | null   // new
}
```

Add state:

```ts
const [moodLoggedAt, setMoodLoggedAt] = useState<string | null>(null)
```

Populate from vitality load (inside `loadDashboard`):

```ts
if (vitalityRes.status === 'fulfilled') {
  const v = vitalityRes.value as VitalityData
  setVitality(v)
  setMoodScore(v.mood_today)
  setMoodLoggedAt(v.mood_last_logged_at ?? null)   // new
}
```

Populate from POST response (inside `handleMoodSelect`):

```ts
async function handleMoodSelect(score: number) {
  setMoodScore(score)
  setVerdictKey((k) => k + 1)
  const uid = userIdRef.current
  const res = await fetch('/api/mood', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: uid, mood_score: score }),
  })
  const data = await res.json() as { mood?: { created_at?: string } }
  if (data.mood?.created_at) setMoodLoggedAt(data.mood.created_at)
}
```

### 3. Dashboard — timestamp helper + UI

**File:** `src/app/dashboard/page.tsx`

Add a helper function near the top of the file (alongside `formatTimeFromIso`):

```ts
function formatMoodTimestamp(iso: string): string {
  const logged = new Date(iso)
  const now = new Date()
  const isToday =
    logged.getFullYear() === now.getFullYear() &&
    logged.getMonth() === now.getMonth() &&
    logged.getDate() === now.getDate()

  const timeStr = logged.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  if (isToday) return timeStr

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    logged.getFullYear() === yesterday.getFullYear() &&
    logged.getMonth() === yesterday.getMonth() &&
    logged.getDate() === yesterday.getDate()

  if (isYesterday) return `Yesterday · ${timeStr}`

  const dayLabel = logged.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return `${dayLabel} · ${timeStr}`
}
```

Update the mood row JSX — add timestamp at far right, same line as the mood label:

```tsx
<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
  {MOOD_OPTIONS.map((m) => { ... })}   {/* unchanged */}

  {moodScore != null && MOOD_LABELS[moodScore] && (
    <span
      key={moodScore}
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: MOOD_LABELS[moodScore].color,
        marginLeft: 4,
        animation: 'verdict-flash 0.3s ease-out',
      }}
    >
      {MOOD_LABELS[moodScore].text}
    </span>
  )}

  {/* Timestamp — only shown when a mood has been logged */}
  {moodLoggedAt && (
    <span
      style={{
        marginLeft: 'auto',
        fontSize: 9,
        color: '#3D2D55',
        flexShrink: 0,
      }}
    >
      {formatMoodTimestamp(moodLoggedAt)}
    </span>
  )}
</div>
```

---

## Timestamp display rules

| Situation | Display |
|-----------|---------|
| Logged today | `14:32` |
| Logged yesterday | `Yesterday · 14:32` |
| Logged earlier | `Mon 3 Mar · 14:32` |
| Never logged | nothing shown |

---

## Oracle / Witness context (future, not in this PRP)

The multi-entry data is already being stored. Surfacing it in AI context is a separate step:
- Oracle morning check-in: include yesterday's mood arc (e.g. "started at 2, peaked at 4 by afternoon")
- Witness: use mood trajectory across past 7 days alongside `dimension_memories`

---

## Summary of files

| File | Change |
|------|--------|
| `src/app/api/dashboard/vitality/route.ts` | Add `mood_last_logged_at` to response |
| `src/app/dashboard/page.tsx` | `VitalityData` interface; `moodLoggedAt` state; populate on load + on POST; `formatMoodTimestamp` helper; timestamp in mood row JSX |

---

## Constraints

- No new tables or migrations needed — `mood_entries.created_at` already exists
- `handleMoodSelect` must remain non-blocking (optimistic UI) — fire POST but don't await before updating `moodScore`
- Timestamp is dimmed (`#3D2D55`) — supporting detail, not primary info
- `npx tsc --noEmit` must pass

---

## Acceptance criteria

- [ ] On page load: if a mood has been logged today, timestamp shows next to the label (e.g. `14:32`)
- [ ] On page load: if last log was yesterday, shows `Yesterday · 14:32`
- [ ] Tapping a mood circle updates the timestamp immediately (uses POST response `created_at`)
- [ ] Tapping a different circle mid-day: label updates AND timestamp updates to the new time
- [ ] No timestamp shown if mood has never been logged
- [ ] `npx tsc --noEmit` passes
