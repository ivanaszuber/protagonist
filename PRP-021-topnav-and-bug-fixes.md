# PRP-021 · Top Nav Bar + 6 Bug Fixes

**Status:** Approved — ready for implementation  
**Priority:** High  
**No dependencies** — all changes are isolated to existing files + one new component

---

## Overview

Six discrete fixes plus one new component (TopNav). Each fix is independent — they can be implemented in any order.

---

## Fix 1 — Top Navigation Bar (new component)

### New file: `src/components/TopNav.tsx`

A slim, always-visible bar placed above all page content. Used in `dashboard/page.tsx` and `src/components/CharacterPage.tsx`.

### Visual spec (Option C — approved)

```
┌──────────────────────────────────────────────┐
│  Tue 26 May  ·  🔥 5d         🔔  ☰         │
└──────────────────────────────────────────────┘
```

- Background: `#110A22`
- Bottom border: `0.5px solid #2D1B55`
- Padding: `8px 16px`
- Height: ~40px
- `position: sticky; top: 0; z-index: 40` so it stays visible when scrolling

**Left side:**
- Date: `new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })` — 10px, `#5A4A7A`
- Separator dot: `·` in `#3D2D55`
- Streak: `🔥 {n}d` where `n` = max `streak_days` across all `main_quests` for this user — 10px, `#fb923c`. If all streaks are 0, hide the streak pill entirely (don't show `🔥 0d`).

**Right side:**
- Bell icon (SVG or inline): 17px, `#5A4A7A` — tapping does nothing for now (future: notifications)
- Menu button: 28×28px, `background: #1A0D40`, `border: 0.5px solid #4A2080`, `border-radius: 8px`, hamburger lines icon `#C084FC` — tapping opens `MenuDrawer`

### MenuDrawer

A bottom sheet that slides up when the menu button is tapped. Same animation pattern as `OracleSheet` (`transform: translateY` from `100%` to `0`). Semi-transparent backdrop.

**Contents:**

```
────────────
  ⚙  Settings          →  /settings
  💜  Oura Ring         →  [Connected ✓]  or  [Reconnect]
  👤  Profile           →  shows userId truncated
────────────
```

- Each row: 48px tap target, left icon + label, right chevron or status badge
- Settings row → `router.push('/settings')`
- Oura row → if Oura tokens exist in DB, show green `Connected ✓` badge; else show amber `Reconnect` badge that links to `/api/oura/auth?userId=...`
- Profile row → shows `userId.slice(0, 8)...` as a placeholder for now
- Close: tap backdrop or drag down

### Usage

In `dashboard/page.tsx`, add `<TopNav streakDays={maxStreak} />` as the very first element inside `<main>`, before the protagonist/HP row.

In `src/components/CharacterPage.tsx`, add `<TopNav streakDays={quest?.streak_days ?? 0} />` at the top of the page, before the character hero section.

`TopNav` accepts props:
```ts
interface TopNavProps {
  streakDays?: number   // defaults to 0
}
```

It fetches Oura connection status itself (GET `/api/oura/status?userId=X`) only when MenuDrawer is opened — not on mount.

---

## Fix 2 — Readiness and Sleep 7-day fallback

**File:** `src/app/api/dashboard/vitality/route.ts`

The current code fetches today's Oura row, falls back to yesterday. If both are null (e.g. early morning or sync not yet run), `readiness_score` and `sleep_score` return null and the biometric circles show `--`.

**Fix:** After the today/yesterday check, if `readiness_score` or `sleep_score` is still null, query the last 7 days for the most recent non-null value for each field independently.

```ts
// After existing today/yesterday row fetch:

if (readiness_score === null || sleep_score === null || activity_score === null) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
  const { data: recentRows } = await supabase
    .from('oura_daily')
    .select('readiness_score, sleep_score, activity_score, date')
    .eq('user_id', userId)
    .gte('date', weekAgo)
    .order('date', { ascending: false })
    .limit(7)

  if (recentRows) {
    if (readiness_score === null) {
      const r = recentRows.find((row) => row.readiness_score != null)
      if (r) readiness_score = r.readiness_score
    }
    if (sleep_score === null) {
      const r = recentRows.find((row) => row.sleep_score != null)
      if (r) sleep_score = r.sleep_score
    }
    if (activity_score === null) {
      const r = recentRows.find((row) => row.activity_score != null)
      if (r) activity_score = r.activity_score
    }
  }
}
```

Each field is resolved independently — readiness might come from 2 days ago while sleep comes from yesterday. This is fine; the biometric circles show scores, not "today's" scores specifically.

---

## Fix 3 — Mood circles visual feedback

**File:** `src/app/dashboard/page.tsx`

**Problem:** The mood buttons are plain coloured circles with no inner content. The scale transform (`scale(1.2)`) is barely perceptible because there's nothing inside the circle to see change. The Oracle verdict text updates correctly in state but the transition is invisible.

**Fix — two parts:**

**Part A: Add number labels inside each mood button.**

Change the mood button render to include the number (1–5) inside each circle:

```tsx
<button
  key={m.value}
  type="button"
  onClick={() => void handleMoodSelect(m.value)}
  style={{
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: `2px solid ${m.border}`,
    background: m.bg,
    cursor: 'pointer',
    transform: selected ? 'scale(1.2)' : 'scale(1)',
    opacity: moodScore != null && !selected ? 0.45 : 1,
    boxShadow: selected ? `0 0 0 3px ${m.border}44` : 'none',
    transition: 'transform 0.15s, opacity 0.15s, box-shadow 0.15s',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 600,
    color: m.border,
    fontFamily: 'inherit',
  }}
  aria-label={`Mood ${m.value}`}
>
  {m.value}
</button>
```

**Part B: Make the Oracle verdict visually respond to mood selection.**

The `verdict` variable is already derived from `getOracleVerdict(oracleInput, moodScore)` — it recomputes on every render when `moodScore` changes. The issue is the verdict bar colour change is subtle. Add a brief opacity flash to confirm the update:

Add state: `const [verdictKey, setVerdictKey] = useState(0)`

In `handleMoodSelect`, after `setMoodScore(score)`, add: `setVerdictKey(k => k + 1)`

On the verdict text `<span>`, add: `key={verdictKey}` and `style={{ ..., animation: 'verdict-flash 0.3s ease-out' }}`

In `globals.css`, add:
```css
@keyframes verdict-flash {
  0% { opacity: 0.3; }
  100% { opacity: 1; }
}
```

---

## Fix 4 — Check-in state refresh after Oracle closes

**File:** `src/app/dashboard/page.tsx`

**Problem:** The check-in button sets `hasCheckedInToday(true)` optimistically on click, but:
1. The user might dismiss Oracle without completing a note — the button incorrectly stays hidden
2. After Oracle saves a note, the "Checked in today ✓" text shows but the dashboard doesn't reflect what Oracle discussed (no tasks added to Today, etc.)

**Fix — two parts:**

**Part A: Re-fetch check-in status when OracleSheet closes.**

Listen for a custom event fired by OracleSheet when it transitions to `closed`:

```tsx
useEffect(() => {
  function onOracleClose() {
    void fetch(`/api/checkin/today?userId=${encodeURIComponent(userIdRef.current)}`)
      .then((r) => r.json())
      .then((d) => {
        setHasCheckedInToday(Boolean(d.hasCheckIn))
        // Also refresh dashboard data (new tasks may have been added)
        void loadDashboard()
      })
  }
  window.addEventListener('protagonist:oracle-closed', onOracleClose)
  return () => window.removeEventListener('protagonist:oracle-closed', onOracleClose)
}, [loadDashboard])
```

**Part B: OracleSheet must fire `protagonist:oracle-closed` when state becomes `'closed'`.**

In `src/components/OracleSheet.tsx`, in the `useEffect` or state transition that sets `state` to `'closed'`, add:

```ts
window.dispatchEvent(new CustomEvent('protagonist:oracle-closed'))
```

**Part C: Don't set `hasCheckedInToday(true)` on button click.**

Remove the optimistic `setHasCheckedInToday(true)` from the button's `onClick`. The re-fetch after Oracle closes handles it correctly. The button simply opens Oracle and waits.

---

## Fix 5 — Calendar events not loading

**File:** `src/app/dashboard/page.tsx` + `src/app/api/calendar/next/route.ts`

**Root cause:** `getCalendarEvents` queries the `calendar_events` DB table, which is only populated when a Google Calendar sync runs. If the sync hasn't run today, the table is empty and no events appear.

**Fix:** In the dashboard load sequence, after the parallel fetch completes, if `events` is empty, trigger a background calendar sync then re-fetch:

```tsx
// In loadDashboard, after calRes is processed:
if (calRes.status === 'fulfilled') {
  const eventsData = (calRes.value.events ?? []) as CalendarEventRow[]
  setEvents(eventsData)

  // If empty, try a background sync then re-fetch once
  if (eventsData.length === 0) {
    fetch(`/api/calendar/sync?userId=${encodeURIComponent(uid)}`, { method: 'POST' })
      .then(() =>
        fetch(`/api/calendar/next?userId=${encodeURIComponent(uid)}&limit=10`)
      )
      .then((r) => r.json())
      .then((d) => {
        if (d.events?.length) setEvents(d.events as CalendarEventRow[])
      })
      .catch(() => {/* silent — calendar is optional */})
  }
}
```

**Also check:** Ensure `getCalendarEvents` in `src/lib/db.ts` uses `event_date` (a `date` column) compared against the local date string `YYYY-MM-DD`, not a UTC timestamp. If the column stores UTC dates, events in the user's timezone (BST = UTC+1) may fall on the "wrong" day. If this is the case, add a ±1 day buffer:

```ts
// In getCalendarEvents, also include yesterday and tomorrow to handle timezone offset:
.gte('event_date', previousDay(date))
.lte('event_date', nextDay(date))
```

Then filter client-side to only `isToday()` events by comparing `start_time` to local date.

---

## Fix 6 — Champions bottom padding

**File:** `src/app/dashboard/page.tsx`

**Current:** `padding: '16px 16px calc(80px + env(safe-area-inset-bottom, 0px))'`

**Fix:** Increase bottom padding to ensure the last Champion card is fully visible above the BottomNav:

```tsx
padding: '0 16px calc(120px + env(safe-area-inset-bottom, 0px))',
```

Note: top padding is removed from `<main>` padding since `TopNav` (Fix 1) provides its own top spacing. The content area starts directly below TopNav.

If TopNav is sticky, the first content section (protagonist/HP row) needs `padding-top: 16px` added explicitly to compensate.

---

## Summary of files changed

| File | Fix |
|------|-----|
| `src/components/TopNav.tsx` | **New** — slim top bar + menu drawer |
| `src/app/dashboard/page.tsx` | Fix 1 (add TopNav), Fix 3 (mood labels + flash), Fix 4 (oracle-closed listener, remove optimistic), Fix 5 (calendar sync fallback), Fix 6 (bottom padding) |
| `src/components/CharacterPage.tsx` | Fix 1 (add TopNav) |
| `src/components/OracleSheet.tsx` | Fix 4 (fire protagonist:oracle-closed event) |
| `src/app/api/dashboard/vitality/route.ts` | Fix 2 (7-day readiness/sleep fallback) |
| `src/app/globals.css` | Fix 3 (verdict-flash keyframe) |

---

## Constraints

- TypeScript strict mode — `npx tsc --noEmit` must pass after all changes
- No `position: fixed` on TopNav — use `position: sticky; top: 0` instead so it scrolls with the page on character pages where the hero header is large
- TopNav must not break the existing `BottomNav` z-index (BottomNav is z-index 50; TopNav uses z-index 40)
- Calendar fix must be silent on failure — Google Calendar auth may not be connected for all users

---

## Acceptance criteria

- [ ] TopNav renders on dashboard and all character pages
- [ ] TopNav shows correct date and highest current streak (hidden if 0)
- [ ] Hamburger opens drawer with Settings, Oura status, Profile rows
- [ ] Settings row navigates to `/settings`
- [ ] Readiness and sleep biometric circles show a value (not `--`) even early morning
- [ ] Mood circles show numbers 1–5 inside
- [ ] Tapping a mood circle scales it up, dims others, and flashes the Oracle verdict text
- [ ] Check-in button does NOT set itself to checked-in until Oracle actually closes after a note
- [ ] Dashboard refreshes (tasks, check-in status) after Oracle sheet closes
- [ ] Calendar events appear when Google Calendar is connected and events exist today
- [ ] If no calendar events in DB, a background sync is attempted silently
- [ ] Champion cards are fully visible with adequate spacing above BottomNav
- [ ] `npx tsc --noEmit` passes
