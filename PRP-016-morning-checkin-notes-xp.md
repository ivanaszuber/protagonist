# PRP-016: Morning Check-In · Note Persistence · XP Feedback

**Status:** Ready for Cursor implementation  
**Depends on:** PRP-015 (OracleSheet, Tasks page)  
**Date:** 2026-05-25

---

## Context — What's already built (don't rebuild)

The multi-agent Oracle brain is **fully working**:
- `src/lib/agents/arc.ts` — `consultArc()` routes through all 7 specialists in parallel
- `src/lib/agents/specialists.ts` — all 7 specialist prompts (Blaze, Sage, Forge, Echo, Sol, Root, Vault)
- `src/lib/agents/router.ts` — `detectDimensions()` + `isCheckIn()` detection
- `src/lib/db.ts` — `getDimensionMemories()` + `saveDimensionMemory()` fully working
- `src/app/api/quests/tasks/[id]/complete/route.ts` — marks task complete, calls `addQuestDimensionXp`, returns `{ xp_earned, leveled_up, new_level }`

**What's actually missing:**
1. No morning check-in entry point on dashboard
2. Oracle NOTE intent never saves notes to DB
3. Oracle NOTE intent uses classify API's generic reply instead of the real 7-specialist response
4. Task completion returns XP data but the UI shows no feedback (no flash, no level-up)

---

## Change 1 — Morning Check-In button on dashboard

### What it does
Add a "Check in with Oracle" button to the dashboard that only shows if the user hasn't checked in today. Tapping it opens OracleSheet pre-filled with a check-in greeting. The existing `isCheckIn()` detection in router.ts already fires all 7 specialists when it sees "good morning" or "checking in".

### File: `src/app/dashboard/page.tsx`

**Add state near top of `DashboardPage`:**
```tsx
const [hasCheckedInToday, setHasCheckedInToday] = useState(false)
```

**Add fetch in the existing `useEffect` that loads Oura/quests data (or create a new one):**
```tsx
// Inside the data-loading useEffect, after other fetches:
fetch(`/api/checkin/today?userId=${encodeURIComponent(userId)}`)
  .then(r => r.json())
  .then((d: { hasCheckIn: boolean }) => setHasCheckedInToday(d.hasCheckIn))
  .catch(() => {})
```

**Add the check-in button** — insert this block **above** the MoodTracker and below the Oracle verdict section. Only render when `!hasCheckedInToday`:

```tsx
{!hasCheckedInToday && (
  <button
    type="button"
    onClick={() => {
      window.dispatchEvent(
        new CustomEvent('protagonist:open-oracle', {
          detail: { prefill: 'Good morning, checking in for today. ' },
        })
      )
      setHasCheckedInToday(true)
    }}
    style={{
      width: '100%',
      padding: '13px 16px',
      background: 'linear-gradient(135deg, #1A0D35 0%, #200A45 100%)',
      border: '1px solid rgba(147,51,234,0.3)',
      borderRadius: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      cursor: 'pointer',
      marginBottom: 12,
      textAlign: 'left',
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: '#200A45',
        border: '1.5px solid #9333EA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {/* Oracle eye SVG — reuse from OracleSheet */}
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="#9333EA" strokeWidth="1.2" />
        <circle cx="8" cy="8" r="2.5" stroke="#C084FC" strokeWidth="1" />
        <circle cx="8" cy="8" r="1.2" fill="#E879F9" />
        <circle cx="7" cy="7" r=".6" fill="white" opacity={0.5} />
      </svg>
    </div>
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#E8E0F0', marginBottom: 2 }}>
        Good morning — check in with Oracle
      </div>
      <div style={{ fontSize: 11, color: '#5A4A7A' }}>
        Tell me how you're feeling · takes 30 seconds
      </div>
    </div>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}>
      <path d="M6 4l4 4-4 4" stroke="#5A4A7A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
)}
```

---

## Change 2 — `GET /api/checkin/today` route

New file: `src/app/api/checkin/today/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ hasCheckIn: false })

  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ hasCheckIn: Boolean(data) })
}
```

---

## Change 3 — Note persistence: Supabase table + API

### 3a. New Supabase table (run in Supabase SQL editor)

```sql
create table if not exists voice_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  content     text not null,
  oracle_reply text,
  created_at  timestamptz default now()
);

create index if not exists voice_notes_user_created
  on voice_notes (user_id, created_at desc);
```

### 3b. New API route: `src/app/api/notes/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const { userId, content, oracleReply } = await request.json()

  if (!userId || !content) {
    return NextResponse.json({ error: 'userId and content required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('voice_notes')
    .insert({ user_id: userId, content, oracle_reply: oracleReply ?? null })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ note: data })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const limit = Number(searchParams.get('limit') ?? '20')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('voice_notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notes: data ?? [] })
}
```

---

## Change 4 — OracleSheet: NOTE intent upgrades

### File: `src/components/OracleSheet.tsx`

**Goal:** When Oracle classifies a message as NOTE, call the full `/api/arc` endpoint for the real 7-specialist response (not just the classify API's generic `oracleReply`). Then persist the note.

In `handleSubmit`, replace the NOTE branch:

**Before:**
```tsx
} else if (data.intent === 'NOTE') {
  setState('note-done')
}
```

**After:**
```tsx
} else if (data.intent === 'NOTE') {
  // Get a real specialist-informed Oracle response
  const arcReply = await sendChatToArc(text)
  
  // Persist the note (fire-and-forget — don't block UI on this)
  fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      content: text,
      oracleReply: arcReply,
    }),
  }).catch(() => {}) // silent — note still shown even if save fails

  // Update result with the real Oracle reply
  setResult({ ...data, oracleReply: arcReply })
  setState('note-done')
}
```

No other changes to OracleSheet needed — the `note-done` UI already displays `result.oracleReply`.

---

## Change 5 — XP flash + level-up feedback in Tasks page

### File: `src/app/tasks/page.tsx`

**Add state at top of `TasksPage`:**
```tsx
const [xpToast, setXpToast] = useState<{ amount: number; dimension: string } | null>(null)
const [levelUpToast, setLevelUpToast] = useState<{ level: number; dimension: string } | null>(null)
```

**Replace `handleComplete` function:**
```tsx
async function handleComplete(taskId: string) {
  const task = tasks.find(t => t.id === taskId)
  if (!task || task.completed) return

  setCompletingId(taskId)
  try {
    const res = await fetch(`/api/quests/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = (await res.json()) as {
      xp_earned?: number
      leveled_up?: boolean
      new_level?: number
    }

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true } : t))

    if (data.xp_earned) {
      setXpToast({ amount: data.xp_earned, dimension: task.dimension })
      setTimeout(() => setXpToast(null), 2500)
    }
    if (data.leveled_up && data.new_level) {
      // Slight delay so XP toast shows first
      setTimeout(() => {
        setLevelUpToast({ level: data.new_level!, dimension: task.dimension })
        setTimeout(() => setLevelUpToast(null), 3000)
      }, 600)
    }
  } finally {
    setCompletingId(null)
  }
}
```

**Add toast renders** — inside the `return (...)`, just before the closing `</main>`:

```tsx
{/* XP Flash Toast */}
{xpToast && (
  <div
    style={{
      position: 'fixed',
      bottom: 110,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(52,211,153,0.12)',
      border: '1px solid rgba(52,211,153,0.35)',
      borderRadius: 100,
      padding: '8px 20px',
      fontSize: 14,
      fontWeight: 600,
      color: '#34d399',
      zIndex: 60,
      pointerEvents: 'none',
      animation: 'xp-float 2.5s ease-out forwards',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}
  >
    ✦ +{xpToast.amount} XP
  </div>
)}

{/* Level Up Toast */}
{levelUpToast && (() => {
  const dimColor =
    levelUpToast.dimension === 'career' ? '#EF9F27'
    : levelUpToast.dimension === 'social' ? '#F0997B'
    : '#1D9E75'
  const dimLabel =
    levelUpToast.dimension === 'career' ? 'Forge'
    : levelUpToast.dimension === 'social' ? 'Echo'
    : 'Vault'
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 110,
        left: '50%',
        transform: 'translateX(-50%)',
        background: `${dimColor}18`,
        border: `1px solid ${dimColor}55`,
        borderRadius: 14,
        padding: '12px 20px',
        fontSize: 13,
        color: dimColor,
        zIndex: 60,
        pointerEvents: 'none',
        animation: 'xp-float 3s ease-out forwards',
        textAlign: 'center',
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: 18, marginBottom: 4 }}>⬆</div>
      <div style={{ fontWeight: 600 }}>{dimLabel} Level {levelUpToast.level}</div>
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Level up!</div>
    </div>
  )
})()}
```

**Add the `xp-float` keyframe to `src/app/globals.css`:**
```css
@keyframes xp-float {
  0%   { opacity: 0; transform: translateX(-50%) translateY(12px); }
  15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  75%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-16px); }
}
```

---

## Change 6 — XP flash in character pages (Forge / Echo / Vault)

The character pages (src/app/forge/page.tsx, echo/page.tsx, vault/page.tsx) also have task completion. Apply the same pattern:

1. Add `xpToast` and `levelUpToast` state
2. In task completion handler, read `xp_earned` / `leveled_up` / `new_level` from the complete API response
3. Render the same toast components (copy from tasks page)

The `xp-float` keyframe is already in globals.css from Change 5 — no duplication needed.

---

## Supabase migration checklist

Run this in Supabase SQL Editor before deploying:

```sql
-- voice_notes table (new)
create table if not exists voice_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  content     text not null,
  oracle_reply text,
  created_at  timestamptz default now()
);
create index if not exists voice_notes_user_created
  on voice_notes (user_id, created_at desc);

-- check_ins table (may already exist — run if missing)
create table if not exists check_ins (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  date         date not null,
  transcript   text,
  energy_level int,
  mood         text,
  social_battery int,
  main_concern text,
  main_desire  text,
  arc_response text,
  created_at   timestamptz default now(),
  unique (user_id, date)
);
```

---

## Files touched — summary

| File | Action |
|------|--------|
| `src/app/dashboard/page.tsx` | Add check-in button + `hasCheckedInToday` state + fetch |
| `src/app/api/checkin/today/route.ts` | **New** — checks if user checked in today |
| `src/app/api/notes/route.ts` | **New** — POST/GET voice notes |
| `src/components/OracleSheet.tsx` | Upgrade NOTE branch: call `/api/arc` + save to `/api/notes` |
| `src/app/tasks/page.tsx` | XP toast + level-up toast in `handleComplete` |
| `src/app/forge/page.tsx` | Same XP toast pattern |
| `src/app/echo/page.tsx` | Same XP toast pattern |
| `src/app/vault/page.tsx` | Same XP toast pattern |
| `src/app/globals.css` | Add `xp-float` keyframe |

---

## Testing checklist

- [ ] Dashboard shows check-in button when not checked in today
- [ ] Check-in button disappears after tapping (optimistic) and after reload (DB check)
- [ ] Typing "Good morning, I'm feeling [X]" in Oracle → all 7 specialists fire (check server logs for `Specialist X` calls)
- [ ] Oracle NOTE response is warm and specific (not the generic classify reply)
- [ ] Voice note appears in Supabase `voice_notes` table after sending
- [ ] Completing a task in Tasks page shows `+50 XP` toast
- [ ] Completing multiple tasks levels up correctly and shows level-up toast
- [ ] XP changes persist in `quest_dimension_xp` table
- [ ] Character page XP bars reflect completed task XP after page reload
