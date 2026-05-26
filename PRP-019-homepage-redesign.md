# PRP-019 · Homepage Redesign — Vital State + Today + Champions

**Status:** Approved — ready for implementation  
**Priority:** High  
**Depends on:** PRP-018 (all 7 characters + slugs must exist)

---

## Overview

Replace the current scrollable MissionCard list with a single page that answers three questions in ≤5 seconds:

1. **How am I doing?** → Vital State: HP orb + biometric circles + Oracle verdict
2. **What do I need to do?** → Today: unified task + calendar timeline
3. **How am I progressing?** → Champions: all 7 character cards with XP + streaks

A new **Protagonist character** (the player — Ivana) sits at the top as the central hero figure, distinct from the seven specialist characters.

---

## Section 0 — Protagonist Hero

A crowned, caped SVG character in purple (`#7C3AED`) positioned top-left of the Vital State section. This is "you" — not one of the seven specialists. It floats using the existing `protagonist-float` keyframe.

```tsx
function ProtagonistCharacter() {
  return (
    <svg width="58" height="70" viewBox="0 0 58 70" fill="none">
      {/* crown */}
      <path d="M18 14 L21 8 L24 12 L29 6 L34 12 L37 8 L40 14Z" fill="#A855F7" opacity={0.9}/>
      <rect x="16" y="13" width="26" height="4" rx="2" fill="#7C3AED"/>
      {/* head/body */}
      <rect x="12" y="18" width="34" height="26" rx="10" fill="#7C3AED"/>
      {/* eyes */}
      <circle cx="22" cy="31" r="6.5" fill="#1A0030"/>
      <circle cx="36" cy="31" r="6.5" fill="#1A0030"/>
      <circle cx="20" cy="29" r="2.2" fill="white" opacity={0.65}/>
      <circle cx="34" cy="29" r="2.2" fill="white" opacity={0.65}/>
      {/* cape */}
      <path d="M12 26 Q4 34 8 46 L12 44Z" fill="#5B21B6" opacity={0.7}/>
      <path d="M46 26 Q54 34 50 46 L46 44Z" fill="#5B21B6" opacity={0.7}/>
      {/* body lower */}
      <rect x="16" y="46" width="26" height="20" rx="6" fill="#5B21B6"/>
      {/* star emblem */}
      <path d="M29 52 L30.5 56 L34.5 56 L31.5 58.5 L32.7 62.5 L29 60 L25.3 62.5 L26.5 58.5 L23.5 56 L27.5 56Z"
        fill="#A855F7" opacity={0.7}/>
    </svg>
  )
}
```

---

## Section 1 — Vital State

### Layout

Three-column row at the top of the page:

```
[ ProtagonistCharacter ]  [ HP Orb ]  [ Biometric circles + Cycle pill ]
```

### HP score

```ts
HP = Math.round(
  (readiness_score ?? 50) * 0.4 +
  (sleep_score    ?? 50) * 0.3 +
  (activity_score ?? 50) * 0.3
)
```

Range 0–100. Show `--` while loading.

### HP orb

SVG ring (82px diameter, stroke-width 7px). Ring fills clockwise from top using `stroke-dasharray` / `stroke-dashoffset`. Animates from 0 to final value on mount (600ms ease-out). Background track: `rgba(255,255,255,0.07)`.

| HP | Ring colour | Label |
|----|-------------|-------|
| 85–100 | `#34d399` | Peak |
| 70–84  | `#a3e635` | Ready |
| 55–69  | `#fb923c` | Fair |
| 40–54  | `#f87171` | Low |
| 0–39   | `#ef4444` | Drained |

Inside the orb: HP integer (bold, 24px) + "HP" label (9px, `#6A5A8A`).

Ring circumference for r=34: `2π × 34 ≈ 213.6`.
`stroke-dashoffset = 213.6 × (1 − HP/100)`

### Biometric circles

Three stacked 32px diameter circles to the right of the HP orb:

| Label | Field | Border + text colour |
|-------|-------|----------------------|
| Ready | `readiness_score` | `#34d399` |
| Sleep | `sleep_score`     | `#60a5fa` |
| Move  | `activity_score`  | `#fb923c` |

Each circle: dark background fill (`#16523A` / `#1A2E4A` / `#3B1A0A`), 2px coloured border, score as integer inside (11px, bold), label below in 9px `#5A4A7A`. Show `--` if null.

### Cycle phase pill

Below the biometric circles, inline pill if `cycle_phase` is non-null:

```
◐  Follicular · Day 9
```

Background `#2A1040`, border `0.5px solid #4A1555`, text `#f472b6`, font-size 9px.

---

## Section 2 — Oracle Verdict

A tappable row below the three-column vital state block:

```
🔮  [Oracle verdict text — italic, coloured]
```

Background `#160C30`, border `0.5px solid #3D2070`, border-radius 10px.

- Text colour matches HP tier colour
- Text content: reuse `getOracleVerdict(oura, moodScore)` from `src/lib/oura.ts` — after mood is picked, call `getOracleVerdict` with updated `moodScore` and re-render
- Tapping fires `window.dispatchEvent(new CustomEvent('protagonist:open-oracle', { detail: { prefill: 'How should I approach today based on my readiness?' } }))`

---

## Section 3 — Mood Tracker

Row of five 28px coloured circles, left-aligned with a "How do you feel?" label:

| Value | Border + text | Background |
|-------|---------------|------------|
| 1 | `#ef4444` | `#3B0010` |
| 2 | `#fb923c` | `#3B1A0A` |
| 3 | `#fbbf24` | `#2A2500` |
| 4 | `#4ade80` | `#0D2A10` |
| 5 | `#a855f7` | `#1A0830` |

On tap: selected circle scales to 1.2× with a coloured ring shadow; unselected circles drop to 50% opacity. Updates the Oracle verdict text. Mood value is passed to `getOracleVerdict`.

---

## Section 4 — Oracle Check-In

Below mood tracker:

**Unchecked state:**
```
[ 🌅  Good morning — check in with Oracle ]   ← full-width button
```
Background `#1A0D40`, border `0.5px solid #4A2080`, text `#C084FC`, border-radius 12px.

Tapping fires `window.dispatchEvent(new CustomEvent('protagonist:open-oracle', { detail: { prefill: 'Good morning' } }))`.

**Checked state** (when `hasCheckedInToday` is true):
```
Checked in today ✓
```
Centred, font-size 11px, colour `#34d399`. No button.

Check-in detection: unchanged from current implementation — query `voice_notes` for any row today.

---

## Section 5 — Today

### Section header

```
Today                                      Sun 25 May
```

Font-size 13px, weight 500, `#E8E0F0` left / `#5A4A7A` right (current date formatted as `EEE D MMM`).

### Tabs — underline style

Three full-width equal tabs flush to the section header, underlined with `border-bottom`:

```
All          Tasks        Calendar
```

- Active tab: `border-bottom: 2px solid #9333EA`, text `#C084FC`, weight 500
- Inactive tab: `border-bottom: 2px solid transparent`, text `#5A4A7A`
- Tab strip itself has `border-bottom: 0.5px solid #2D1B55`
- No background, no pill, no box — underline only
- Default: `All`

### Data

Merge into a single `TodayItem[]` list:

```ts
interface TodayItem {
  id: string
  type: 'task' | 'event'
  title: string
  time: string | null        // HH:MM or null
  dimension: Dimension | null
  completed: boolean
  xp_reward: number          // 0 for events
  color: string              // dim color or '#3b82f6' for events
}
```

**Tasks**: `today_task` from each quest in `/api/quests/main`. Include both completed and incomplete (dim completed ones).

**Calendar events**: `/api/calendar/next?userId=X&limit=10`, filtered to today's date.

Sort: time ascending; null-time items first.

### Item rendering

**Calendar event:**
```
  9:00   ●  Standup with team          🗓
```
- Time in `#5A4A7A` (9px), fixed 34px width right-aligned
- 6px blue dot (`#3b82f6`)
- Title 12px `#C8C0E0`
- Calendar icon (Tabler `ti-calendar`) at 13px `#3b82f6` opacity 60%
- Not tappable (no action)

**Task:**
```
         ○  Send follow-up to recruiter
             Forge · +50 XP
```
- Empty time column (34px)
- 16px circle checkbox: border `1.5px solid [dim colour]`, transparent bg — on completion: filled `#34d399` + green checkmark SVG inside
- Title 12px `#C8C0E0`
- Subtitle row: dim name + `· +{xp} XP` in 9px dim colour
- Completed: title struck through + 40% opacity + checkbox filled green
- Tap on row triggers task completion: optimistic update → POST `/api/quests/tasks/{id}/complete` → `showXpFeedback` toast → silent re-fetch
- `cursor: pointer`, `role="button"`

### Empty state

`Nothing scheduled for today. Ask Oracle to build your plan.` — tapping opens Oracle.

---

## Section 6 — Champions

### Header

```
Champions
```

Font-size 13px, weight 500, `#E8E0F0`.

### Grid

`display: grid; grid-template-columns: 1fr 1fr; gap: 8px`

First 6 characters fill the grid normally. The **7th character (Root / family) spans `grid-column: 1 / -1`** (full width) with a horizontal layout (character SVG left, content right).

### Card anatomy (standard — 2-col)

```
┌──────────────────────────────┐
│ [CharSvg]         [Lv badge] │  ← floating SVG + level pill top-right
│ Name                          │
│ Vision truncated 1 line       │
│ ░░░░░░░░░████████░░░░░░░░░░  │  ← 3px XP bar
│ [tier tag]          [🔥 12d] │
└──────────────────────────────┘
```

- Background `#140C28`, border `0.5px solid #2D1B55`, border-radius 12px, padding `10px 8px`
- Left accent bar: 3px wide, full height, dimension colour, `border-radius: 0`
- Character SVG: scaled to ~32×38 (use `width="32" height="38"` on the `<svg>`)
- Level badge: `#1E0D40` bg, border-radius 6px, 9px `#7A5FA0`
- Name: 11px `#E8E0F0`
- Vision: 9px `#5A4A7A`, 1 line, ellipsis overflow
- XP bar: 3px tall, `#2D1B55` track, fill = `(xp % 500) / 500 * 100%`, dim colour fill
- Tier name: 9px `#7A5FA0` — from `getTierName(xp)`
- Streak: if `streak_days > 0`, show `🔥 {n}d` in 9px `#fb923c`

### Card anatomy (Root — full width)

Horizontal layout: SVG left, text content right (same fields, just horizontal flex).

### Tap

Entire card → `router.push(CHAR_PAGE[dimension])`. `role="button"`, `cursor: pointer`.

---

## New API: `/api/dashboard/vitality`

**GET** `/api/dashboard/vitality?userId=X`

Single endpoint for the Vital State section — avoids waterfall.

```ts
// Response
{
  hp: number                     // computed 0–100
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
  cycle_day: number | null
  cycle_phase: string | null
  mood_today: number | null      // 1–5, most recent mood log today
}
```

Implementation:
1. Query `oura_daily` for today's date (fall back to yesterday if today row absent)
2. Query `mood_logs` WHERE `user_id = X` AND `created_at >= today 00:00` ORDER BY `created_at DESC` LIMIT 1
3. Compute HP using the formula above
4. Return combined object

---

## Page layout

```
<main>                                  ← scrollable, padding 16px, pb-24
  <VitalStateRow />                     ← protagonist + HP + circles
  <OracleVerdictBar />                  ← tappable verdict
  <MoodTracker />                       ← 5 coloured circles
  <CheckInButton | CheckedInBadge />    ← conditional
  <divider />
  <TodaySection />                      ← header + underline tabs + list
  <divider />
  <ChampionsSection />                  ← header + 2-col grid
</main>
```

Bottom padding: `padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px))` — clears BottomNav.

---

## Files to create / modify

| File | Action |
|---|---|
| `src/app/dashboard/page.tsx` | Full rewrite |
| `src/app/api/dashboard/vitality/route.ts` | Create new |

---

## Reused unchanged

| File | What's reused |
|---|---|
| `src/components/XpToastOverlay.tsx` | `showXpFeedback`, `XpToastOverlay` |
| `src/lib/oura.ts` | `getOracleVerdict`, `getReadinessGuidance` |
| `src/lib/xp.ts` | `getLevel`, `getTierName` |
| `src/lib/character.ts` | `CHARACTERS`, `ALL_DIMENSIONS`, `Dimension` |
| `src/lib/tierName.ts` | `DIMENSION_TO_SLUG` |
| `src/lib/user.ts` | `getUserId` |
| All 7 character SVG components | Copy from current `dashboard/page.tsx` |
| `ProtagonistCharacter` SVG | New, defined in this spec (Section 0) |

---

## Constraints (non-negotiable)

- **Never** add calories, weight, BMI, or body composition anywhere
- `temperature_deviation` is in °C (±2°C range) — never use as a 0–100 score
- `SUPABASE_SERVICE_ROLE_KEY` must not appear in any `NEXT_PUBLIC_` variable
- TypeScript strict mode — must pass `npx tsc --noEmit` before merge

---

## Acceptance criteria

- [ ] Protagonist character (crowned hero) renders top-left, floats
- [ ] HP orb ring animates in on load, correct colour tier
- [ ] HP shows `--` while loading (not 0)
- [ ] Three biometric circles show correct score + colour
- [ ] Cycle phase pill appears if data available
- [ ] Oracle verdict tappable → opens Oracle with prefill
- [ ] Mood circles: tap selects, deselects others, updates verdict colour + text
- [ ] Check-in button present when not checked in; replaced by ✓ when checked in
- [ ] Today tabs are underline-only, no pill/box styling
- [ ] Switching tabs correctly filters to tasks-only or events-only
- [ ] Task rows have circle checkbox with dimension colour
- [ ] Tapping task row triggers optimistic completion + XP toast
- [ ] Completed tasks show strikethrough + green check
- [ ] Calendar events show calendar icon, are not tappable
- [ ] All 7 champion cards render with correct character SVG + colour accent + XP bar
- [ ] Root card spans full width, horizontal layout
- [ ] Tapping a champion card navigates to correct character page
- [ ] No TypeScript errors (`npx tsc --noEmit` passes)
- [ ] No horizontal scroll on mobile
- [ ] Scrollbar hidden (already in globals.css)
