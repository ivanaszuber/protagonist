# PRP-017: The Witness

**Status:** Ready for Cursor implementation  
**Depends on:** PRP-016 (memory system fully working)  
**Date:** 2026-05-25

---

## What this is

The Witness is the feature that makes Protagonist feel genuinely different from every other AI app. It reads everything Oracle has learned about you across all 7 dimensions and surfaces the moments of growth — quietly, specifically, without fanfare.

> *"Six days ago you told me interviews made you anxious. Today you had three of them and you're still standing. That's not luck — that's you."*

The memory infrastructure is fully built. `dimension_memories` stores dated insights from every conversation. This PRP just uses that data.

---

## The experience

- A card appears on the dashboard — subtle, purple-bordered, Oracle-eye icon
- It shows one growth moment: something from the past contrasted with something recent
- It's optional to read, easy to dismiss, never intrusive
- On each character page (Forge/Echo/Vault), a small "Oracle remembers" section shows the 3 most recent memories Oracle has for that dimension
- A user with only a few days of data sees: "Oracle is just starting to know you" with the first memory as a seed

---

## Change 1 — Supabase: `witness_insights` table

Run in Supabase SQL Editor:

```sql
create table if not exists witness_insights (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  insight      text not null,
  dimension_id text,           -- primary dimension this insight is about, or null for cross-dimensional
  memory_count int default 0,  -- how many memories were scanned to produce this
  generated_at timestamptz default now()
);

create index if not exists witness_insights_user_generated
  on witness_insights (user_id, generated_at desc);
```

---

## Change 2 — `GET /api/witness/route.ts`

New file: `src/app/api/witness/route.ts`

This endpoint:
1. Checks if a fresh insight exists (<7 days old) — if so, returns it immediately (no Claude call)
2. If stale or missing: loads all memories across all 7 dimensions, calls Claude Sonnet to write a growth moment, saves + returns it

```typescript
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ALL_DIMENSIONS = ['vitality', 'mind', 'create', 'social', 'love', 'family', 'wealth']

const DIMENSION_LABELS: Record<string, string> = {
  vitality: 'Vitality',
  mind: 'Mind',
  create: 'Forge · Career',
  social: 'Echo · Social',
  love: 'Love',
  family: 'Family',
  wealth: 'Vault · Finances',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ insight: null }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ insight: null })
  }

  // Check for a fresh cached insight (< 7 days old)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from('witness_insights')
    .select('*')
    .eq('user_id', userId)
    .gte('generated_at', sevenDaysAgo)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({
      insight: cached.insight,
      dimensionId: cached.dimension_id,
      memoryCount: cached.memory_count,
      generatedAt: cached.generated_at,
      cached: true,
    })
  }

  // Load all memories across all dimensions (oldest first, so we can see progression)
  const { data: allMemories } = await supabase
    .from('dimension_memories')
    .select('dimension_id, content, created_at, importance')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (!allMemories || allMemories.length === 0) {
    return NextResponse.json({ insight: null, reason: 'no_memories' })
  }

  // Minimum threshold — need at least 3 memories for a meaningful insight
  if (allMemories.length < 3) {
    return NextResponse.json({
      insight: null,
      reason: 'not_enough_memories',
      memoryCount: allMemories.length,
    })
  }

  // Group by dimension with timestamps
  const byDimension: Record<string, { content: string; date: string }[]> = {}
  for (const m of allMemories) {
    if (!byDimension[m.dimension_id]) byDimension[m.dimension_id] = []
    byDimension[m.dimension_id].push({
      content: m.content,
      date: m.created_at.split('T')[0],
    })
  }

  // Build memory context string for Claude
  const memoryContext = Object.entries(byDimension)
    .map(([dim, mems]) => {
      const label = DIMENSION_LABELS[dim] ?? dim
      const lines = mems.map((m) => `  [${m.date}] ${m.content}`).join('\n')
      return `${label}:\n${lines}`
    })
    .join('\n\n')

  const today = new Date().toISOString().split('T')[0]

  const prompt = `You are The Witness — a quiet, perceptive observer who has been watching this person's life across multiple dimensions for some time. You have access to everything their Oracle has noticed and remembered about them.

Today is ${today}. Here is everything you know:

${memoryContext}

Your task: write ONE sentence — or at most two — that surfaces a meaningful moment of growth, change, or pattern. 

Rules:
- Be SPECIFIC — reference actual things from the memories (dates, events, specific words they used)
- Contrast past vs present when possible: "A week ago X, now Y"
- If there's no clear contrast yet (early user), surface the most interesting pattern you see instead
- Never be generic ("you're doing great!") — that's worthless
- Never use: "journey", "growth mindset", "wellness", "self-care"
- Tone: warm, quiet, slightly awed — like a friend who has been paying close attention
- If the memories mention Zara (the user's daughter), treat those moments with extra tenderness
- Length: 1-2 sentences maximum. No more.

Respond with ONLY valid JSON:
{
  "insight": "the one or two sentence witness insight",
  "primaryDimension": "the dimension this insight is mainly about, or null if cross-dimensional"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    let parsed: { insight: string; primaryDimension: string | null }
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : { insight: raw.trim(), primaryDimension: null }
    }

    if (!parsed.insight) {
      return NextResponse.json({ insight: null, reason: 'generation_failed' })
    }

    // Save to cache
    await supabase.from('witness_insights').insert({
      user_id: userId,
      insight: parsed.insight,
      dimension_id: parsed.primaryDimension,
      memory_count: allMemories.length,
    })

    return NextResponse.json({
      insight: parsed.insight,
      dimensionId: parsed.primaryDimension,
      memoryCount: allMemories.length,
      cached: false,
    })
  } catch (error) {
    console.error('Witness error:', error)
    return NextResponse.json({ insight: null, reason: 'error' })
  }
}
```

---

## Change 3 — Dashboard Witness card

### File: `src/app/dashboard/page.tsx`

**Add state:**
```tsx
const [witnessInsight, setWitnessInsight] = useState<string | null>(null)
const [witnessDimension, setWitnessDimension] = useState<string | null>(null)
const [witnessDismissed, setWitnessDismissed] = useState(false)
```

**Load witness insight lazily (after main content loads):**
```tsx
// In a separate useEffect — runs after the page is interactive, doesn't block render
useEffect(() => {
  // Check if dismissed this week
  const dismissedKey = `witness_dismissed_${new Date().toISOString().split('T')[0].slice(0, 7)}` // YYYY-MM key
  const alreadyDismissed = localStorage.getItem(dismissedKey) === 'true'
  if (alreadyDismissed) {
    setWitnessDismissed(true)
    return
  }

  const uid = getUserId()
  fetch(`/api/witness?userId=${encodeURIComponent(uid)}`)
    .then(r => r.json())
    .then((d: { insight?: string | null; dimensionId?: string | null }) => {
      if (d.insight) {
        setWitnessInsight(d.insight)
        setWitnessDimension(d.dimensionId ?? null)
      }
    })
    .catch(() => {})
}, [])
```

**Witness card component** — add this inline in the dashboard JSX, placed between the Oracle verdict card and the MissionCards section:

```tsx
{witnessInsight && !witnessDismissed && (
  <div
    style={{
      background: 'linear-gradient(135deg, #12083A 0%, #1A0D35 100%)',
      border: '1px solid rgba(147,51,234,0.25)',
      borderLeft: '3px solid #9333EA',
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 12,
      position: 'relative',
    }}
  >
    {/* Dismiss button */}
    <button
      type="button"
      onClick={() => {
        setWitnessDismissed(true)
        const dismissedKey = `witness_dismissed_${new Date().toISOString().split('T')[0].slice(0, 7)}`
        localStorage.setItem(dismissedKey, 'true')
      }}
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        background: 'transparent',
        border: 'none',
        color: '#3D2878',
        cursor: 'pointer',
        fontSize: 16,
        lineHeight: 1,
        padding: '2px 6px',
      }}
      aria-label="Dismiss"
    >
      ×
    </button>

    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingRight: 24 }}>
      {/* Oracle eye */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#200A45',
          border: '1px solid rgba(147,51,234,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="#9333EA" strokeWidth="1.2" />
          <circle cx="8" cy="8" r="2.5" stroke="#C084FC" strokeWidth="1" />
          <circle cx="8" cy="8" r="1.2" fill="#E879F9" />
          <circle cx="7" cy="7" r=".6" fill="white" opacity={0.5} />
        </svg>
      </div>

      <div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: '#6B3FA0',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 5,
          }}
        >
          The Witness
        </div>
        <div
          style={{
            fontSize: 13,
            color: '#C0B0E0',
            lineHeight: 1.6,
            fontStyle: 'italic',
          }}
        >
          &ldquo;{witnessInsight}&rdquo;
        </div>
      </div>
    </div>
  </div>
)}
```

---

## Change 4 — "Oracle remembers" section on character pages

### Files: `src/app/forge/page.tsx`, `src/app/echo/page.tsx`, `src/app/vault/page.tsx`

Each character page maps to a dimension:
- Forge → `create`
- Echo → `social`  
- Vault → `wealth`

**Add state:**
```tsx
const [oracleMemories, setOracleMemories] = useState<string[]>([])
```

**Load memories for this dimension** (add to the existing data-loading useEffect, or a separate one):
```tsx
useEffect(() => {
  const uid = getUserId()
  fetch(`/api/memories?userId=${encodeURIComponent(uid)}&dimension=create&limit=3`)
    .then(r => r.json())
    .then((d: { memories?: string[] }) => setOracleMemories(d.memories ?? []))
    .catch(() => {})
}, [])
```

**"Oracle remembers" section** — add below the ActiveQuestCard and above the milestone history, only when `oracleMemories.length > 0`:

```tsx
{oracleMemories.length > 0 && (
  <div
    style={{
      background: '#0D0820',
      border: '0.5px solid #1E1040',
      borderLeft: '2px solid #9333EA',
      borderRadius: '0 10px 10px 0',
      padding: '12px 14px',
      marginBottom: 16,
    }}
  >
    <div
      style={{
        fontSize: 9,
        fontWeight: 600,
        color: '#4A2878',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
        <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="#6B3FA0" strokeWidth="1.2" />
        <circle cx="8" cy="8" r="2" fill="#6B3FA0" />
      </svg>
      Oracle remembers
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {oracleMemories.map((memory, i) => {
        // Memory format: "[2026-05-20] the actual insight text"
        const dateMatch = memory.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.+)$/)
        const date = dateMatch?.[1]
        const text = dateMatch?.[2] ?? memory
        return (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {date && (
              <span
                style={{
                  fontSize: 9,
                  color: '#3D2060',
                  flexShrink: 0,
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            )}
            <span style={{ fontSize: 12, color: '#7A5FA0', lineHeight: 1.5 }}>
              {text}
            </span>
          </div>
        )
      })}
    </div>
  </div>
)}
```

---

## Change 5 — `GET /api/memories/route.ts`

New file: `src/app/api/memories/route.ts`

Simple endpoint to fetch memories for a given dimension, used by character pages.

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const dimension = searchParams.get('dimension')
  const limit = Number(searchParams.get('limit') ?? '5')

  if (!userId || !dimension) {
    return NextResponse.json({ memories: [] })
  }

  const { data, error } = await supabase
    .from('dimension_memories')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('dimension_id', dimension)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return NextResponse.json({ memories: [] })
  }

  const memories = data.map(
    (row) => `[${row.created_at.split('T')[0]}] ${row.content}`
  )

  return NextResponse.json({ memories })
}
```

---

## Supabase migration checklist

Run in Supabase SQL Editor:

```sql
create table if not exists witness_insights (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  insight      text not null,
  dimension_id text,
  memory_count int default 0,
  generated_at timestamptz default now()
);

create index if not exists witness_insights_user_generated
  on witness_insights (user_id, generated_at desc);
```

---

## Files touched — summary

| File | Action |
|------|--------|
| `src/app/api/witness/route.ts` | **New** — generates + caches The Witness insight |
| `src/app/api/memories/route.ts` | **New** — returns dimension memories for character pages |
| `src/app/dashboard/page.tsx` | Add witness card (lazy load, dismissible per month) |
| `src/app/forge/page.tsx` | Add "Oracle remembers" section (create dimension) |
| `src/app/echo/page.tsx` | Add "Oracle remembers" section (social dimension) |
| `src/app/vault/page.tsx` | Add "Oracle remembers" section (wealth dimension) |

---

## Edge cases

| Situation | Behaviour |
|-----------|-----------|
| < 3 memories total | Witness card doesn't appear — returns `reason: 'not_enough_memories'` |
| Fresh insight (<7 days old) | Served from cache — no Claude call |
| No memories for a character page dimension | "Oracle remembers" section hidden |
| User dismisses the card | Hidden for the rest of the current calendar month (localStorage key by YYYY-MM) |
| API error | Fails silently — dashboard renders without the card |

---

## Testing checklist

- [ ] Talk to Oracle a few times (different topics) — memories appear in Supabase `dimension_memories` table
- [ ] After 3+ memories: Witness insight generated and appears on dashboard
- [ ] Refresh dashboard — insight served from cache (check: `cached: true` in API response)
- [ ] Dismiss card — stays dismissed after refresh (localStorage)
- [ ] Dismiss card in month X — reappears in month X+1
- [ ] Forge/Echo/Vault pages show "Oracle remembers" section with dated memories
- [ ] Character page with 0 memories: section hidden (no error)
- [ ] Witness insight is specific and references actual memory content (not generic)
