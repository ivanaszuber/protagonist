# PRP-020 · Character Page — Legend, Bosses, Hall of Kills, Medals

**Status:** Approved — ready for implementation  
**Priority:** High  
**Depends on:** PRP-018 (all 7 character pages exist via `CharacterPage` component)

---

## Overview

Transform each character page from a simple quest list into a full RPG character screen. The page tells the story of one dimension of your life: who you're becoming (The Legend), what you're working toward (Main Quests), what you're fighting right now (Boss Battle), and what you've achieved (Hall of Kills + Medals).

This spec uses Forge (career) as the reference example throughout. All 7 dimensions follow identical structure.

---

## Section 1 — Hero Header (unchanged structure, minor additions)

Existing: character SVG, name, level, tier, XP bar, stat row.

**Add to stat row:** "Bosses Slain" count sourced from the new `boss_kills` table (count of slain bosses for this dimension + user).

**Add dimension category pill** next to character name:
```
Forge  [Career]
```
Pill: `background: #2A1800`, `border: 0.5px solid {char.color}`, `border-radius: 20px`, `padding: 2px 8px`, `font-size: 10px`, `color: {char.color}`.

---

## Section 2 — The Legend

A pinned card at the top of the scrollable content, below the hero header.

```
★  The Legend
"CPTO & Board Adviser · Industry Voice in London"
The mountain you're climbing. Everything else serves this.
```

- Background `#140C1A`, border `0.5px solid {char.color}`, border-radius 12px
- Star icon SVG left of "The Legend" label (9px, spaced 1px, uppercase)
- Vision text: 13px, italic, `#F0E8D0` tint, line-height 1.5
- Subtitle: 10px, `#7A5A2A` (or muted dim colour variant)
- Edit button (pencil icon, top-right) → opens Oracle with prefill: *"I want to update my Legend for [character name]. Currently it says: [current legend]. Help me refine it."*

### First-time setup (no legend yet)

If `vision` is null for this dimension's main quest, show an invite card instead:

```
★  No Legend yet
Oracle will help you define your ultimate vision for [Career].
[ 🔮  Define your Legend with Oracle ↗ ]
```

Button fires Oracle with prefill: *"Let's define my Legend for [character name]. This is my long-term vision for [dimension label] — who I want to become. Ask me questions and help me write a one-sentence legend."*

Oracle's NOTE intent handler saves the result back to `main_quests.vision` for this dimension.

---

## Section 3 — Main Quests

**Header row:** `Main Quests` label left + `+ Add ↗` button right.

`+ Add` fires Oracle with prefill: *"I want to add a new main quest for [character name] — [dimension label]. Help me define it with a clear goal, milestone, and target date."*

### Quest card (active)

```
┌─────────────────────────────────────────┐
│ ● Land CPTO role at Series B startup  [Active] │
│   Milestone: Clear 5 senior interviews · 18d left │
│   ░░░░░░░████████░░░░░░░░░  60%        │
└─────────────────────────────────────────┘
```

- Left accent dot = dimension colour
- Status badge: `Active` in amber or `Planned` in muted
- Milestone line: if `active_milestone` exists, show title + days until target date
- Progress bar: milestone completion percentage (tasks completed / tasks total for this milestone, or XP-based if milestone has no task count)
- Tap → expands to show all milestones (future iteration, not this PRP)

### Quest card (planned)

Same structure, 60% opacity, no progress bar, status badge = `Planned`.

---

## Section 4 — Boss Battle

### One active boss per dimension

Each dimension has at most one `active` boss at a time. The boss card is the most visually prominent section.

### Boss data model

New Supabase table: **`boss_battles`**

```sql
create table boss_battles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id),
  dimension     text not null,
  quest_id      uuid references main_quests(id),
  name          text not null,           -- e.g. "The Interview Gauntlet"
  hp_total      int not null,            -- total tasks to slay boss (8–12)
  hp_remaining  int not null,            -- decrements as tasks complete
  deadline      date not null,
  status        text not null default 'active',  -- active | slain | escaped
  reward_xp     int not null default 300,
  slain_at      timestamptz,
  escaped_at    timestamptz,
  created_at    timestamptz default now()
);
```

Boss tasks are regular tasks in the `tasks` table with a `boss_battle_id` foreign key column added:

```sql
alter table tasks add column boss_battle_id uuid references boss_battles(id);
alter table tasks add column hp_damage int not null default 1;
```

### Boss card UI

```
⚔  Boss Battle
┌─────────────────────────────────────────┐
│ [BossSVG]  The Interview Gauntlet        │
│            Slay before Jun 1 · 6d left   │
│  HP ████████████░░░░  6/10              │
│  4 hits to defeat · reward: +300 XP     │
│                                          │
│  ATTACK MOVES                            │
│  ○  Do a mock system design interview  -1HP │
│  ○  Prepare 3 leadership STAR stories  -1HP │
│  ✓  Send follow-up to recruiter        -1HP │  ← completed, dimmed
└─────────────────────────────────────────┘
```

**Boss SVG:** A shadowy antagonist figure, always rendered in dark reds (`#2A0808` fill, `#ef4444` glowing eyes). The same generic boss SVG is used for all bosses — differentiated only by name. (Future: unique boss art per archetype.)

**HP bar:**
- Track `#2A0808`, fill `#ef4444`
- When HP ≤ 40%: fill switches to `#fb923c`
- When HP ≤ 20%: fill switches to `#fbbf24` (boss is almost dead)
- Animates on task completion

**Attack moves:** These are the tasks linked to this boss (`boss_battle_id = boss.id`). Rendered as completable rows identical to Today task rows. Completing one:
1. Optimistic update: checkbox fills, HP bar decrements, text dims
2. POST `/api/quests/tasks/{taskId}/complete` (existing endpoint)
3. PATCH `/api/bosses/{bossId}` to decrement `hp_remaining`
4. If `hp_remaining === 0`: trigger boss slay flow (see below)

**Boss slay flow:**
- HP bar empties with animation
- Card transforms to a victory state:
  ```
  ⚔  Boss Slain!
  The Interview Gauntlet has been defeated.
  [+300 XP  ·  Added to Hall of Kills]
  ```
- POST `/api/bosses/{bossId}/slay` → sets `status = 'slain'`, `slain_at = now()`, adds XP, creates `boss_kill` entry in Hall of Kills
- After 2 seconds, card collapses; a "New Boss" prompt appears (see Oracle flow below)

### No active boss state

```
⚔  No active boss
Oracle will generate your next challenge.
[ 🔮  Start a new Boss Battle ↗ ]
```

Fires Oracle with prefill: *"I need a new boss battle for [character name] — my [dimension label] character. My current main quest is: [quest title]. Generate a boss name, set HP to 10, create 10 attack move tasks spread over the next 30 days, and assign HP damage (1–3) to each based on difficulty."*

Oracle's task-generation handler creates the boss record + all tasks and links them.

---

## Section 5 — Boss Escape Mechanic

A nightly cron job (or check on page load) compares `boss_battles.deadline` against today:

```
if status = 'active' AND deadline < today:
  set status = 'escaped'
  set escaped_at = now()
  deduct XP_ESCAPE_PENALTY (= 50 XP) from user's dimension XP
  add entry to boss_kills table with outcome = 'escaped'
```

**UI when boss has escaped:**

```
⚔  The Interview Gauntlet — ESCAPED
It dealt -50 XP before fleeing.
The threat level resets but the boss is still out there.
[ 🔮  Hunt it down again ↗ ]
```

Background shifts to `#1A0A08`, border `0.5px solid #6B1A1A`.

"Hunt it down" fires Oracle with prefill: *"My boss [boss name] escaped before I could slay it. I lost 50 XP. Help me restart the challenge — same boss name, new deadline 30 days from today, fresh set of attack tasks."*

Oracle creates a new boss record (new row, same name, `hp_total = 10`, new deadline, new tasks).

**XP deduction:** applied to `quest_dimension_xp.xp` for this dimension. Floor at 0 — can never go negative.

---

## Section 6 — Hall of Kills

A scrollable list below the Boss Battle section.

**Header:** `Hall of Kills` left, kill count right (e.g. `3 slain · 1 escaped`).

Each entry is one row:

```
⚔  The Networking Gauntlet       Slain · 9 days · Mar 2026
    Landing the CPTO Quest
☠  The Cold Outreach Massacre    Escaped · Feb 2026
    Landing the CPTO Quest
```

- Slain: `⚔` icon, dim-colour text, date slain, days it took (`slain_at - created_at`)
- Escaped: `☠` icon, muted red text, date escaped
- Quest name shown as subtitle

### `boss_kills` table

```sql
create table boss_kills (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id),
  dimension      text not null,
  boss_battle_id uuid references boss_battles(id),
  boss_name      text not null,
  quest_name     text,
  outcome        text not null,  -- 'slain' | 'escaped'
  hp_total       int,
  tasks_completed int,
  days_taken     int,            -- null if escaped
  xp_awarded     int default 0,
  killed_at      timestamptz default now()
);
```

---

## Section 7 — Medals

A horizontal scrollable row of medal circles.

**Earned medals:** full opacity, dimension-colour border, icon filled.
**Locked medals:** 30% opacity, muted border, icon outline only, label shows hint.

### Starter medal set (all dimensions)

| Medal | Trigger | Icon |
|-------|---------|------|
| First Blood | Complete first task in this dimension | sword |
| On a Roll | 7-day streak | activity/pulse |
| Boss Slayer | Slay first boss | skull |
| Relentless | Slay 3 bosses | flame |
| Legend Born | Set The Legend for this character | star |
| Comeback | Slay a boss that previously escaped | shield |
| Veteran | Reach Level 10 | trophy |

Medal checking: evaluated server-side on task completion, boss slay, and page load. Stored in a new `medals` table:

```sql
create table medals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  dimension   text not null,
  medal_key   text not null,    -- e.g. 'first_blood', 'boss_slayer'
  earned_at   timestamptz default now(),
  unique(user_id, dimension, medal_key)
);
```

---

## New API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/bosses/active?userId=X&dimension=Y` | Fetch active boss + its tasks |
| POST | `/api/bosses` | Oracle creates new boss (name, hp, deadline, tasks) |
| PATCH | `/api/bosses/[id]/hit` | Decrement hp_remaining by task's hp_damage |
| POST | `/api/bosses/[id]/slay` | Mark slain, award XP, write boss_kill row |
| GET | `/api/bosses/kills?userId=X&dimension=Y` | Hall of Kills for this dimension |
| GET | `/api/medals?userId=X&dimension=Y` | Earned medals for this dimension |
| POST | `/api/medals/check` | Evaluate + award any newly earned medals |

---

## Oracle integration

### Boss creation prompt (system context injected by Oracle handler)

When Oracle detects intent `BOSS_CREATE` for a dimension:

```
You are creating a boss battle for the {dimension} dimension.
Current main quest: {quest.title}
Current milestone: {milestone.title} (due {milestone.target_date})
Today: {today}

Generate:
1. A dramatic boss name (e.g. "The Interview Gauntlet", "The Networking Colossus")
2. Exactly 10 attack move tasks — specific, actionable, relevant to the quest
3. HP damage per task: 1 (easy/small), 2 (medium), or 3 (hard/high impact) — total must equal 10
4. Spread tasks across the next 30 days based on difficulty (harder tasks earlier)
5. A deadline 30 days from today

Return as JSON:
{
  "boss_name": "...",
  "deadline": "YYYY-MM-DD",
  "hp_total": 10,
  "tasks": [
    { "title": "...", "due_date": "YYYY-MM-DD", "hp_damage": 1|2|3 }
  ]
}
```

### Legend creation prompt

When Oracle detects intent `LEGEND_CREATE` for a dimension:

```
Help the user define their Legend for the {dimension} dimension ({character_name}).
The Legend is a single sentence that captures their ultimate 5–10 year vision.

Ask 2–3 questions, then synthesise into one memorable sentence.
When confirmed, save it as the vision for their {dimension} main quest.
```

---

## Files to create

| File | Purpose |
|------|---------|
| `src/app/api/bosses/active/route.ts` | GET active boss + tasks |
| `src/app/api/bosses/route.ts` | POST create boss |
| `src/app/api/bosses/[id]/hit/route.ts` | PATCH decrement HP |
| `src/app/api/bosses/[id]/slay/route.ts` | POST slay boss |
| `src/app/api/bosses/kills/route.ts` | GET Hall of Kills |
| `src/app/api/medals/route.ts` | GET medals |
| `src/app/api/medals/check/route.ts` | POST check + award medals |
| `src/components/characters/BossCard.tsx` | Boss battle UI card |
| `src/components/characters/HallOfKills.tsx` | Kill history list |
| `src/components/characters/MedalsRow.tsx` | Horizontal medal scroll |
| `src/components/characters/LegendCard.tsx` | Legend display + edit |

## Files to modify

| File | Change |
|------|--------|
| `src/components/CharacterPage.tsx` | Add Legend, BossCard, HallOfKills, MedalsRow sections |
| `src/lib/agents/specialists.ts` | Add `BOSS_CREATE` and `LEGEND_CREATE` intent handlers |
| `src/app/api/quests/tasks/[taskId]/complete/route.ts` | After completion, call `/api/bosses/{bossId}/hit` if task has `boss_battle_id` |
| Supabase migrations | Add `boss_battles`, `boss_kills`, `medals` tables; add `boss_battle_id` + `hp_damage` cols to `tasks` |

---

## Constraints

- **Never** add calories, weight, BMI, or body composition anywhere
- TypeScript strict mode — `npx tsc --noEmit` must pass
- `SUPABASE_SERVICE_ROLE_KEY` never in `NEXT_PUBLIC_` vars
- XP floor is 0 — escape penalty cannot push dimension XP below zero

---

## Acceptance criteria

- [ ] Legend card renders; edit button opens Oracle with correct prefill
- [ ] First-time empty state shows "Define your Legend" button
- [ ] Main Quests show active (with progress) and planned (dimmed)
- [ ] `+ Add` quest button opens Oracle with correct prefill
- [ ] Active boss card renders with correct HP bar and attack moves
- [ ] Completing an attack move decrements HP bar optimistically
- [ ] HP bar changes colour at ≤40% and ≤20%
- [ ] Boss slay triggers victory card + XP award + Hall of Kills entry
- [ ] Boss escape: status shows "Escaped", `-50 XP` applied (floor 0), "Hunt it down" button works
- [ ] Hall of Kills lists all slain and escaped bosses with correct metadata
- [ ] Medals row shows earned (full) and locked (30% opacity) medals
- [ ] All new endpoints return correct data and handle missing records gracefully
- [ ] `npx tsc --noEmit` passes
