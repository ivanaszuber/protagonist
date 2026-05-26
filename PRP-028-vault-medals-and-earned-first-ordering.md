# PRP-028 · Vault Medals + Earned-First Medal Ordering

**Status:** Approved — ready for implementation  
**Priority:** Medium  
**Depends on:** PRP-027 (vault_settings table), PRP-020 (medal system)

---

## Overview

Two changes:

1. **Vault-specific medal set** — replace the generic 7 medals on the Vault character page with 10 wealth-specific medals that track real financial progress (net worth milestones, ISA, shadow vault, challenges)
2. **Earned-first ordering** — across every character page, earned (lit) medals always appear before unearned (greyed) medals in the scroll row

---

## Change 1 · Earned-first ordering in `MedalsRow`

**File:** `src/components/characters/MedalsRow.tsx`

One line change in the render. Before mapping, sort the definitions so earned keys come first:

```tsx
export function MedalsRow({ definitions, earned, accentColor }: MedalsRowProps) {
  // Sort: earned first, then unearned — preserve original order within each group
  const sorted = [...definitions].sort((a, b) => {
    const aEarned = earned.includes(a.key) ? 0 : 1
    const bEarned = earned.includes(b.key) ? 0 : 1
    return aEarned - bEarned
  })

  return (
    <section style={{ marginBottom: 24 }}>
      ...
      {sorted.map((medal) => { ... })}  {/* was: definitions.map */}
    </section>
  )
}
```

That's the entire change for ordering — applies to all 7 character pages automatically.

---

## Change 2 · Dimension-aware medal definitions

Currently `CharacterPage` always passes the single global `MEDAL_DEFINITIONS` array. We need the Vault page to receive a different set.

### 2a · New icon type: `coin`

**File:** `src/lib/medals.ts`

Add `'coin'` to the `MedalDefinition` icon union:

```ts
icon: 'sword' | 'pulse' | 'skull' | 'flame' | 'star' | 'shield' | 'trophy' | 'coin'
```

**File:** `src/components/characters/MedalsRow.tsx`

Add the `coin` case to `MedalIcon`:

```tsx
case 'coin':
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.5" fill={fill} />
      <path d="M12 8v8M9 10.5h4.5a1.5 1.5 0 0 1 0 3H9" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
```

### 2b · Vault medal definitions

**File:** `src/lib/medals.ts`

Add after `MEDAL_DEFINITIONS`:

```ts
export const VAULT_MEDAL_DEFINITIONS: MedalDefinition[] = [
  {
    key: 'vault_legend_born',
    label: 'Legend Born',
    hint: 'Define your Vault Legend',
    icon: 'trophy',
  },
  {
    key: 'vault_first_task',
    label: 'First Deposit',
    hint: 'Complete your first Vault task',
    icon: 'coin',
  },
  {
    key: 'vault_first_challenge',
    label: 'First Victory',
    hint: 'Complete your first Vault challenge',
    icon: 'star',
  },
  {
    key: 'vault_relentless',
    label: 'Relentless Saver',
    hint: 'Complete 3 Vault challenges',
    icon: 'flame',
  },
  {
    key: 'vault_shadow_positive',
    label: 'Ahead of Shadow',
    hint: 'Your actuals beat the budget plan',
    icon: 'pulse',
  },
  {
    key: 'vault_slip_recovery',
    label: 'Bounce Back',
    hint: 'Get back on track after a slip',
    icon: 'shield',
  },
  {
    key: 'vault_emergency_fund',
    label: 'Safety Net',
    hint: 'Build a 3-month emergency fund',
    icon: 'shield',
  },
  {
    key: 'vault_investor',
    label: 'Investor',
    hint: 'Reach £50k invested',
    icon: 'coin',
  },
  {
    key: 'vault_six_figures',
    label: 'Six Figures',
    hint: 'Reach £100k net worth',
    icon: 'trophy',
  },
  {
    key: 'vault_goal_reached',
    label: 'Goal Unlocked',
    hint: 'Hit your net worth goal',
    icon: 'star',
  },
]
```

### 2c · Dimension-to-definitions map

**File:** `src/lib/medals.ts`

Add after both definition arrays:

```ts
export const MEDAL_DEFINITIONS_BY_DIMENSION: Record<string, MedalDefinition[]> = {
  wealth: VAULT_MEDAL_DEFINITIONS,
}

export function getMedalDefinitions(dimension: string): MedalDefinition[] {
  return MEDAL_DEFINITIONS_BY_DIMENSION[dimension] ?? MEDAL_DEFINITIONS
}
```

### 2d · CharacterPage — use dimension-aware definitions

**File:** `src/components/CharacterPage.tsx`

Change the import:
```ts
// Before:
import { MEDAL_DEFINITIONS } from '@/lib/medals'

// After:
import { getMedalDefinitions } from '@/lib/medals'
```

Change the `MedalsRow` call:
```tsx
// Before:
<MedalsRow
  definitions={MEDAL_DEFINITIONS}
  earned={earnedMedals}
  accentColor={accentColor}
/>

// After:
<MedalsRow
  definitions={getMedalDefinitions(dimension)}
  earned={earnedMedals}
  accentColor={accentColor}
/>
```

---

## Change 3 · Vault medal check logic

### 3a · New check context type

**File:** `src/lib/medals.ts`

Add alongside `MedalCheckContext`:

```ts
export interface VaultMedalCheckContext {
  userId: string
  // from vault_settings
  invested: number
  cash: number
  nwGoal: number
  shadowGap: number          // positive = behind, negative = ahead
  shadowGapPrev: number      // value before last update (for bounce-back detection)
  // from quest/task data
  hasLegend: boolean
  tasksCompletedCount: number
  bossesSlain: number
  // derived
  totalNetWorth: number      // invested + cash
  monthlyIncome: number
}
```

### 3b · `checkAndAwardVaultMedals` function

**File:** `src/lib/medals.ts`

```ts
export async function checkAndAwardVaultMedals(
  ctx: VaultMedalCheckContext
): Promise<string[]> {
  const earned = await getEarnedMedalKeys(ctx.userId, 'wealth')
  const newlyEarned: string[] = []

  const tryAward = async (key: string, condition: boolean) => {
    if (!condition || earned.includes(key) || newlyEarned.includes(key)) return
    const ok = await awardMedal(ctx.userId, 'wealth', key)
    if (ok) newlyEarned.push(key)
  }

  await tryAward('vault_legend_born',    ctx.hasLegend)
  await tryAward('vault_first_task',     ctx.tasksCompletedCount >= 1)
  await tryAward('vault_first_challenge', ctx.bossesSlain >= 1)
  await tryAward('vault_relentless',     ctx.bossesSlain >= 3)
  // Ahead of shadow = shadowGap <= 0 (actuals beat budget)
  await tryAward('vault_shadow_positive', ctx.shadowGap <= 0 && ctx.totalNetWorth > 0)
  // Bounce back = was behind (shadowGapPrev > 0) and now ahead (shadowGap <= 0)
  await tryAward('vault_slip_recovery',
    ctx.shadowGapPrev > 0 && ctx.shadowGap <= 0)
  // Emergency fund = cash >= 3 months of (income - net savings target)
  // Use monthly_income as proxy: cash >= 3 * monthly_income * 0.5 (conservative)
  await tryAward('vault_emergency_fund', ctx.cash >= ctx.monthlyIncome * 3)
  await tryAward('vault_investor',       ctx.invested >= 50_000)
  await tryAward('vault_six_figures',    ctx.totalNetWorth >= 100_000)
  await tryAward('vault_goal_reached',   ctx.totalNetWorth >= ctx.nwGoal)

  return newlyEarned
}
```

### 3c · Where to call `checkAndAwardVaultMedals`

Call it from `PUT /api/vault/settings` (the route created in PRP-027) after every successful upsert:

```ts
// In PUT /api/vault/settings handler, after upsert succeeds:
import { checkAndAwardVaultMedals } from '@/lib/medals'

// Fetch quest data for the user in wealth dimension
const { data: questData } = await supabase
  .from('tasks')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('dimension', 'wealth')
  .eq('completed', true)

const { data: killData } = await supabase
  .from('boss_kills')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('dimension', 'wealth')
  .eq('outcome', 'slain')

const { data: legendData } = await supabase
  .from('main_quests')
  .select('vision')
  .eq('user_id', userId)
  .eq('dimension', 'wealth')
  .single()

// shadow_gap before this update was stored — read previous row before upsert
// (capture it as `prevGap` before the upsert call)

await checkAndAwardVaultMedals({
  userId,
  invested: newSettings.invested,
  cash: newSettings.cash,
  nwGoal: newSettings.nw_goal,
  shadowGap: newSettings.shadow_gap,
  shadowGapPrev: prevGap,
  hasLegend: Boolean(legendData?.vision?.trim()),
  tasksCompletedCount: questData?.count ?? 0,
  bossesSlain: killData?.count ?? 0,
  totalNetWorth: newSettings.invested + newSettings.cash,
  monthlyIncome: newSettings.monthly_income,
})
```

Also call it from the existing `/api/medals/check` route (already called on character page load) — add a vault branch:

**File:** `src/app/api/medals/check/route.ts`

```ts
// Add alongside the existing checkAndAwardMedals call:
if (dimension === 'wealth') {
  const { data: vaultSettings } = await supabase
    .from('vault_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (vaultSettings) {
    const vaultNewlyEarned = await checkAndAwardVaultMedals({
      userId,
      invested: vaultSettings.invested,
      cash: vaultSettings.cash,
      nwGoal: vaultSettings.nw_goal,
      shadowGap: vaultSettings.shadow_gap,
      shadowGapPrev: vaultSettings.shadow_gap, // no prev on page load — use same
      hasLegend: Boolean(/* from existing questData */),
      tasksCompletedCount: ctx.tasksCompletedCount,
      bossesSlain: ctx.bossesSlain,
      totalNetWorth: vaultSettings.invested + vaultSettings.cash,
      monthlyIncome: vaultSettings.monthly_income,
    })
    allNewlyEarned.push(...vaultNewlyEarned)
  }
}
```

---

## File checklist

| File | Change |
|------|--------|
| `src/lib/medals.ts` | Add `'coin'` to icon union · Add `VAULT_MEDAL_DEFINITIONS` · Add `getMedalDefinitions()` · Add `VaultMedalCheckContext` · Add `checkAndAwardVaultMedals()` |
| `src/components/characters/MedalsRow.tsx` | Add `coin` SVG icon case · Sort `definitions` earned-first before rendering |
| `src/components/CharacterPage.tsx` | Import `getMedalDefinitions` · Pass `getMedalDefinitions(dimension)` to `MedalsRow` |
| `src/app/api/vault/settings/route.ts` | Call `checkAndAwardVaultMedals` after each successful PUT (PRP-027 file) |
| `src/app/api/medals/check/route.ts` | Add vault branch that calls `checkAndAwardVaultMedals` when dimension = 'wealth' |

---

## Acceptance criteria

- [ ] On every character page, earned medals appear before unearned ones in the scroll row
- [ ] Within each group (earned / unearned), original definition order is preserved
- [ ] Vault character page shows the 10 Vault-specific medals, not the generic 7
- [ ] All other character pages still show the generic medal set
- [ ] `coin` icon renders correctly in earned (teal stroke) and unearned (grey, 30% opacity) states
- [ ] `vault_six_figures` is awarded when `invested + cash >= 100,000`
- [ ] `vault_goal_reached` is awarded when `invested + cash >= nw_goal`
- [ ] `vault_shadow_positive` is awarded when `shadow_gap <= 0`
- [ ] `vault_slip_recovery` is awarded on the transition from positive to zero/negative `shadow_gap`
- [ ] `vault_emergency_fund` is awarded when `cash >= monthly_income * 3`
- [ ] `vault_investor` is awarded when `invested >= 50,000`
- [ ] Challenge-based vault medals (`vault_first_challenge`, `vault_relentless`) fire from boss_kills table on the wealth dimension
- [ ] Medals check runs on page load (via `/api/medals/check`) and after every vault settings save
