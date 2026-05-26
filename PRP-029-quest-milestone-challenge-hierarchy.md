# PRP-029 — Quest → Milestone → Challenge Hierarchy

## Status: Approved for Implementation

## Overview

Protagonist's progression system is restructured into a clear three-tier hierarchy. This replaces the disconnected parallel tracks (Legend + Main Quest + Challenge) with a coherent RPG campaign structure where completing challenges advances milestones, and completing milestones advances the quest.

---

## New Terminology

| Old | New | Description |
|-----|-----|-------------|
| Legend / Vision | **Quest** | The long-term goal for a dimension. One active at a time. Rarely changes. Example: "Become financially independent by 2030." |
| Main Quest / Milestones | **Milestones** | Medium-term chapters. 3–5 per quest. Example: "Build £50k investment portfolio by August 2025." |
| Boss / Challenge | **Challenge** | Short-term sprint (7–30 days). 5–7 tasks created by Oracle. Now linked to the active milestone. |
| Tasks | **Tasks** | Individual actions inside a challenge. Created by Oracle when challenge is generated. |

**Database tables stay the same** — only UI labels change (already done in PRP-029 prep). The `main_quests.vision` field holds the Quest text. Milestones are in the `milestones` table.

---

## New DB Field

Add `milestone_id` (nullable UUID FK) to the `bosses` table:

```sql
ALTER TABLE bosses ADD COLUMN milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL;
```

This links each challenge to the milestone it serves.

---

## User Flow

### Defining a Quest
- Character page → "No Quest yet" card → "Define your Quest with Oracle ↗"
- Oracle opens in quest-definition mode (already implemented in #72/#73)
- User types one sentence: "I want to become the go-to AI engineer in London by 2027"
- Oracle saves to `main_quests.vision` via `PATCH /api/quests/vision` (upsert — fixed in #73)
- Page auto-refreshes (event listener added in #74)

### Defining Milestones
- Character page → Milestones section → "Add milestone" (already exists via MainQuestsSection)
- Each milestone has a title and target date
- 3–5 milestones per quest is the recommended range

### Creating a Challenge (updated flow)
When Oracle creates a challenge:
1. It looks up the user's **active milestone** for that dimension (first incomplete, ordered by sort_order)
2. Challenge is created with `milestone_id` pointing to that milestone
3. If no milestone exists, challenge is created without a milestone link (graceful fallback)

Oracle prompt update: include milestone context more prominently so generated tasks are directly relevant to the milestone's goal.

### Milestone Progress
- Milestone progress = `(completed challenges linked to it) / (total challenges linked to it) × 100%`
- Shown as a progress bar on the milestone card
- When user manually marks a milestone complete, it advances the quest

### Quest Progress
- Quest progress = `(completed milestones) / (total milestones) × 100%`
- Shown as a progress bar on the Quest card (currently the LegendCard)

---

## API Changes Required

### `POST /api/bosses/generate`
- After generating, look up active milestone and set `milestone_id` on the new boss/challenge record
- Return `milestone_id` and `milestone_title` in the response so UI can display context

### `GET /api/quests/character/[dimension]`
- Update `QuestData` type to include milestone progress counts:
  ```ts
  milestones: Array<{
    id: string
    title: string
    target_date: string | null
    completed: boolean
    sort_order: number
    challenge_count: number       // new
    completed_challenge_count: number  // new
  }>
  ```

### New: `GET /api/milestones/[id]/progress`
- Returns `{ total_challenges, completed_challenges, progress_pct }`

---

## UI Changes Required

### CharacterPage — QuestCard (currently LegendCard)
- Show quest text (already shown as vision)
- Show quest progress bar: `X of Y milestones complete`
- Edit button: opens Oracle in quest-edit mode

### CharacterPage — Milestones Section (MainQuestsSection)
- Each milestone shows a mini progress bar: `X of Y challenges complete`
- Show the linked challenges count under each milestone

### CharacterPage — Challenge/BossCard
- Show "In service of: [Milestone Title]" as a small tag below the challenge name
- If no milestone linked, show "Unlinked challenge"

### Oracle — Challenge Creation
- After challenge is created, show which milestone it was linked to
- If no milestone exists: suggest creating one first, or allow creating the challenge anyway

---

## Design Decision (approved)

**Model 2 — One challenge, tasks distributed across milestones**
- One active challenge per dimension at a time (unchanged)
- Oracle fetches ALL active milestones and creates 2–3 tasks per milestone
- Each task has a `milestone_id` FK pointing to the milestone it serves
- Milestone progress = (completed tasks for that milestone) / (total tasks for it)
- Optional `focusMilestoneId` in the generate request pins all tasks to one milestone
- **Challenge duration changed from 30 days → 7 days** (weekly sprints, more engaging)

## Implementation Order

1. ~~DB migration: add `milestone_id` to `bosses`~~ — Not needed for Model 2; `tasks.milestone_id` already existed in schema
2. ✅ Update `/api/bosses/generate` to assign `milestone_id` per task + 7-day deadline
3. Update `QuestData` type + `/api/quests/character/[dimension]` to include per-milestone task counts
4. Update BossCard UI to show "In service of: [Milestone]" tag per task
5. Update MilestonesSection to show task-based progress bar per milestone
6. Update QuestCard (LegendCard) to show overall quest progress
7. Add focus-milestone picker to Oracle challenge-creation flow

---

## What's Already Done (PRP-029 prep work)

- ✅ Legend renamed to Quest in all UI labels (LegendCard, OracleSheet)
- ✅ Vision route upserted (creates main_quest record if none exists)
- ✅ CharacterPage auto-refreshes after Oracle saves quest
- ✅ Challenge changed to 7-day weekly sprints (was 30 days)
- ✅ Tasks distributed across all active milestones (2–3 per milestone, cap 7)
- ✅ Each task saved with `milestone_id` FK
- ✅ Optional `focusMilestoneId` param in POST /api/bosses/generate
- ✅ Oracle quest-definition mode: clean input, guided prompt, saves on submit
- ✅ Inline milestone creation form (no Oracle required)

---

## Notes

- The `main_quests` table is not renamed — it continues to be the backing store for both the Quest definition and character metadata (character_name, character_class). The `vision` field IS the Quest.
- Milestones remain in the `milestones` table with `quest_id` FK — no change.
- The word "boss" remains in internal code/tables but all user-facing labels say "Challenge."
- Medal `legend_born` key is preserved in the medals table but its display label should be updated to "Quest Defined" in the medal definitions.
