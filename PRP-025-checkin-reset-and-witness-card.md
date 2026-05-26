# PRP-025 · Check-In Reset (Dev) + Witness Card Wiring

**Status:** Approved — ready for implementation  
**Priority:** High  
**Depends on:** PRP-023 (dev reset infrastructure), PRP-017 (Witness API — already built)

---

## Overview

Two small fixes:

1. **Check-in reset button** — when "Checked in today ✓" is showing, a dev-only reset button lets you clear just today's check-in so you can re-test the morning check-in flow without wiping all your data
2. **Witness card** — the API and memory system are fully built but the dashboard card was never wired up after PRP-019's rewrite; this adds the 3 missing pieces

---

## Fix 1 — Check-in reset

### The problem

Once checked in, `dashboard/page.tsx` shows "Checked in today ✓" and hides the morning check-in button. The only way to reset it is the full dev data wipe (PRP-023), which destroys all tasks and quests. For testing the new PRP-023 morning check-in flow, you need a targeted reset that only clears today's check-in.

### New API: `POST /api/dev/reset-checkin`

**New file:** `src/app/api/dev/reset-checkin/route.ts`

```ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS !== 'true') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { userId } = await request.json() as { userId: string }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]
  const startOfDay = `${today}T00:00:00.000Z`

  // Delete today's voice notes — this is what determines check-in status
  await supabaseAdmin
    .from('voice_notes')
    .delete()
    .eq('user_id', userId)
    .gte('created_at', startOfDay)

  // Also clear any mood logs from today so mood resets
  await supabaseAdmin
    .from('mood_logs')
    .delete()
    .eq('user_id', userId)
    .gte('created_at', startOfDay)

  // Also clear mood_entries if that table exists
  await supabaseAdmin
    .from('mood_entries')
    .delete()
    .eq('user_id', userId)
    .gte('created_at', startOfDay)
    .throwOnError()
    .catch(() => {}) // table may not exist — ignore

  return NextResponse.json({ ok: true })
}
```

### Dashboard change — reset button next to "Checked in today ✓"

**File:** `src/app/dashboard/page.tsx`

When `hasCheckedInToday` is true and `NEXT_PUBLIC_SHOW_DEV_TOOLS === 'true'`, show a small reset icon beside the checked-in text:

```tsx
{hasCheckedInToday ? (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 16,
    }}
  >
    <p style={{ textAlign: 'center', fontSize: 11, color: '#34d399', margin: 0 }}>
      Checked in today ✓
    </p>
    {process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === 'true' && (
      <button
        type="button"
        onClick={() => void handleResetCheckin()}
        title="Dev: reset today's check-in"
        style={{
          background: 'transparent',
          border: '0.5px solid #2D1B55',
          borderRadius: 6,
          color: '#3D2D55',
          fontSize: 10,
          padding: '2px 6px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        ↺
      </button>
    )}
  </div>
) : (
  // existing check-in button...
)}
```

### `handleResetCheckin` function in dashboard

```ts
const handleResetCheckin = useCallback(async () => {
  await fetch('/api/dev/reset-checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userIdRef.current }),
  })
  setHasCheckedInToday(false)
  setMoodScore(null)
}, [])
```

No page reload needed — just flipping the two state values brings the check-in button straight back.

### Also add to MenuDrawer dev section (TopNav.tsx)

In the dev tools section of `MenuDrawer` (already planned in PRP-023), add a second dev row above the full reset:

```tsx
{
  icon: '↺',
  label: 'Dev: Reset today\'s check-in',
  onClick: async () => {
    await fetch('/api/dev/reset-checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    onClose()
    window.dispatchEvent(new CustomEvent('protagonist:oracle-closed')) // triggers dashboard refresh
  },
}
```

---

## Fix 2 — Witness card wiring

### The problem

`/api/witness` and `/api/memories` were built in PRP-017 and are live. The Arc agent writes to `dimension_memories` on every Oracle conversation. But `dashboard/page.tsx` was fully rewritten in PRP-019 and the Witness card was never re-added. The backend exists; just the 3 frontend pieces are missing.

### Add state

**File:** `src/app/dashboard/page.tsx`

```ts
const [witnessInsight, setWitnessInsight] = useState<string | null>(null)
const [witnessDismissed, setWitnessDismissed] = useState(false)
```

### Add lazy fetch (separate useEffect — runs after main content)

```ts
useEffect(() => {
  // Check if dismissed this calendar month
  const dismissKey = `witness_dismissed_${new Date().toISOString().slice(0, 7)}`
  if (localStorage.getItem(dismissKey) === 'true') {
    setWitnessDismissed(true)
    return
  }
  const uid = userIdRef.current
  fetch(`/api/witness?userId=${encodeURIComponent(uid)}`)
    .then((r) => r.json())
    .then((d: { insight?: string | null }) => {
      if (d.insight) setWitnessInsight(d.insight)
    })
    .catch(() => {})
}, [])
```

### Add Witness card to JSX

Place it **between the Oracle verdict bar and the mood tracker** — it sits in the vital state section but below the main readout:

```tsx
{witnessInsight && !witnessDismissed && (
  <div
    style={{
      background: 'linear-gradient(135deg, #12083A 0%, #1A0D35 100%)',
      border: '0.5px solid rgba(147,51,234,0.3)',
      borderLeft: '3px solid #9333EA',
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 12,
      position: 'relative',
    }}
  >
    <button
      type="button"
      onClick={() => {
        setWitnessDismissed(true)
        const dismissKey = `witness_dismissed_${new Date().toISOString().slice(0, 7)}`
        localStorage.setItem(dismissKey, 'true')
      }}
      aria-label="Dismiss"
      style={{
        position: 'absolute',
        top: 8,
        right: 10,
        background: 'transparent',
        border: 'none',
        color: '#3D2878',
        fontSize: 16,
        cursor: 'pointer',
        lineHeight: 1,
        padding: '2px 6px',
      }}
    >
      ×
    </button>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingRight: 20 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: '#200A45',
          border: '0.5px solid rgba(147,51,234,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="#9333EA" strokeWidth="1.2" />
          <circle cx="8" cy="8" r="2.5" stroke="#C084FC" strokeWidth="1" />
          <circle cx="8" cy="8" r="1.2" fill="#E879F9" />
          <circle cx="7" cy="7" r=".6" fill="white" opacity={0.5} />
        </svg>
      </div>
      <div>
        <div style={{
          fontSize: 9,
          fontWeight: 600,
          color: '#6B3FA0',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 5,
        }}>
          The Witness
        </div>
        <div style={{
          fontSize: 12,
          color: '#C0B0E0',
          lineHeight: 1.6,
          fontStyle: 'italic',
        }}>
          &ldquo;{witnessInsight}&rdquo;
        </div>
      </div>
    </div>
  </div>
)}
```

### Behaviour

- Witness card only appears after **3+ memories** exist in `dimension_memories` (enforced server-side in `/api/witness`) — new users see nothing
- Insight is **cached for 7 days** in `witness_insights` table — no repeated Claude calls
- **Dismissing** hides the card for the rest of the calendar month (localStorage key `witness_dismissed_YYYY-MM`)
- Fails silently — if the API errors, `witnessInsight` stays null and the card simply doesn't render

---

## Summary of files

| File | Change |
|------|--------|
| `src/app/api/dev/reset-checkin/route.ts` | **New** — deletes today's voice_notes + mood logs |
| `src/app/dashboard/page.tsx` | Reset button next to "Checked in today ✓"; `handleResetCheckin`; Witness state + fetch + card |
| `src/components/TopNav.tsx` | Add "Dev: Reset today's check-in" row to dev section of MenuDrawer |

---

## Constraints

- Reset check-in endpoint: guarded by `NEXT_PUBLIC_SHOW_DEV_TOOLS !== 'true'` — returns 403 otherwise
- Reset button on dashboard only renders when `NEXT_PUBLIC_SHOW_DEV_TOOLS === 'true'`
- Witness card is completely silent on failure — never blocks page render
- `supabaseAdmin` (service role) used in reset endpoint — never in any `NEXT_PUBLIC_` var
- `npx tsc --noEmit` must pass

---

## Acceptance criteria

- [ ] With `NEXT_PUBLIC_SHOW_DEV_TOOLS=true`: a small `↺` button appears next to "Checked in today ✓"
- [ ] Clicking `↺` resets check-in state instantly — morning check-in button reappears without page reload
- [ ] MenuDrawer dev section has "Dev: Reset today's check-in" row
- [ ] Clicking it closes the drawer and refreshes the dashboard back to unchecked state
- [ ] Neither reset button appears in production (no `NEXT_PUBLIC_SHOW_DEV_TOOLS` env var)
- [ ] With 3+ memories in `dimension_memories`: Witness card appears on dashboard
- [ ] Witness card shows between Oracle verdict and mood tracker
- [ ] Dismissing hides the card; it stays hidden after reload until next month
- [ ] With 0–2 memories: no Witness card, no error
- [ ] `npx tsc --noEmit` passes
