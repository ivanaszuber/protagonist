# PRP-027 · Vault — Net Worth Card + Settings + Oracle NW Update

**Status:** Approved — ready for implementation  
**Priority:** High  
**Depends on:** PRP-014 (CharacterPage), PRP-015 (OracleSheet)

---

## Overview

Three additions to the Vault (wealth) character page:

1. **`VaultNetWorthCard`** — an animated coin-fill card showing net worth progress toward a short-term goal, with an expandable shadow vault comparison
2. **Vault settings screen** — `/vault/settings` page where the user manually inputs net worth, income, budget categories, investment rates, and FIRE target
3. **Oracle `VAULT_UPDATE` intent** — lets the user say "my Revolut savings is now £56k" and Oracle updates the vault settings automatically

---

## 1 · Database: `vault_settings` table

Create via Supabase migration:

```sql
CREATE TABLE vault_settings (
  user_id            TEXT PRIMARY KEY,
  invested           NUMERIC NOT NULL DEFAULT 0,
  cash               NUMERIC NOT NULL DEFAULT 0,
  monthly_income     NUMERIC NOT NULL DEFAULT 0,
  monthly_savings_target NUMERIC NOT NULL DEFAULT 0,
  fire_number        NUMERIC NOT NULL DEFAULT 1500000,
  fire_target_year   INTEGER NOT NULL DEFAULT 2030,
  fire_annual_spend  NUMERIC NOT NULL DEFAULT 60000,
  nw_goal            NUMERIC NOT NULL DEFAULT 200000,
  nw_goal_deadline   DATE,
  coin_denomination  NUMERIC NOT NULL DEFAULT 10000,
  shadow_interest_rate NUMERIC NOT NULL DEFAULT 7,
  expected_return_rate NUMERIC NOT NULL DEFAULT 7,
  isa_allowance_used NUMERIC NOT NULL DEFAULT 0,
  budget_categories  JSONB NOT NULL DEFAULT '[]',
  shadow_gap         NUMERIC NOT NULL DEFAULT 0,
  shadow_gap_updated_at TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`budget_categories` shape:**
```json
[
  { "key": "housing",       "label": "Housing & rent",      "budget": 1200, "color": "#F0997B" },
  { "key": "groceries",     "label": "Groceries",           "budget": 400,  "color": "#1D9E75" },
  { "key": "restaurants",   "label": "Restaurants",         "budget": 300,  "color": "#F472B6" },
  { "key": "going_out",     "label": "Going out",           "budget": 250,  "color": "#818CF8" },
  { "key": "transport",     "label": "Transport",           "budget": 200,  "color": "#38BDF8" },
  { "key": "beauty",        "label": "Beauty & wellness",   "budget": 200,  "color": "#F43F5E" },
  { "key": "shopping",      "label": "Shopping & clothes",  "budget": 150,  "color": "#EF9F27" },
  { "key": "utilities",     "label": "Utilities",           "budget": 130,  "color": "#4ADE80" },
  { "key": "subscriptions", "label": "Subscriptions",       "budget": 100,  "color": "#9B7FCC" },
  { "key": "other",         "label": "Other",               "budget": 70,   "color": "#6B5E8C" }
]
```

**Shadow gap logic:**
- `shadow_gap` = running total of (budget surplus − actual surplus) since goal start
- Positive = behind plan (user spent more than budget)
- Negative = ahead of plan (user spent less than budget)
- Updated whenever Oracle processes a `VAULT_UPDATE` intent:
  ```
  new_total = new_invested + new_cash
  old_total = old_invested + old_cash
  actual_delta = new_total - old_total
  budget_surplus = monthly_income - sum(budget_categories[].budget)
  expected_delta = budget_surplus  (assumes 1-month cadence for manual updates)
  shadow_gap += expected_delta - actual_delta
  ```
- `shadow_gap_updated_at` = timestamp of last update (used to compute months elapsed)

**5-year compound figure:**
```
shadow_5yr = shadow_gap * ((1 + shadow_interest_rate/100) ^ 5)
```
Computed at read time — not stored.

---

## 2 · API routes

### `GET /api/vault/settings?userId=...`

Returns the full `vault_settings` row. If no row exists, returns sensible defaults (the DEFAULT values above).

```ts
// response shape
{
  settings: VaultSettings | null,
  totalNetWorth: number,          // invested + cash
  monthlySurplus: number,         // monthly_income - sum(categories)
  shadow5yr: number,              // shadow_gap * 1.07^5
  fireProgressPct: number,        // (invested + cash) / fire_number * 100
  coinsFilled: number,            // floor((invested + cash) / coin_denomination)
  coinsPartialPct: number,        // remainder as 0–100
  coinsToGoal: number,            // ceil(nw_goal / coin_denomination) - coinsFilled
}
```

### `PUT /api/vault/settings`

Body: `{ userId: string, patch: Partial<VaultSettings> }`

Upserts the row. When `invested` or `cash` changes, recalculates and updates `shadow_gap` as described above. Always sets `updated_at = NOW()`.

---

## 3 · `VaultNetWorthCard` component

**File:** `src/components/vault/VaultNetWorthCard.tsx`

### Props
```ts
interface VaultNetWorthCardProps {
  userId: string
  accentColor: string   // '#1D9E75'
}
```

### Behaviour

Fetches `/api/vault/settings?userId=...` on mount. Shows a left-accent card (same `LeftBorderCard` pattern as `CharacterPage`).

### Coin tower layout

- Two columns side by side, coins stacked bottom-to-top
- Left column: first 10 filled coins
- Right column: next 10 (partial + goal markers)
- Each coin: `width: 28px, height: 7px, borderRadius: 3px, gap: 2px`
- **Filled coins** — three depth tones of the accent colour:
  - Coins 1–5: `#085041` (darkest)
  - Coins 6–10: `#0F6E56`
  - Coins 11–15: `#1D9E75` (brightest, most recent)
  - Top filled coin has a `rgba(255,255,255,0.18)` highlight bar at `top: 1px`
- **Partial coin** (the one currently filling):
  - Background `#0A0718`, border `0.5px solid rgba(29,158,117,0.5)`
  - Inner fill div: `width: {coinsPartialPct}%, background: #1D9E75`
  - CSS animation `pulse-glow` (keyframe: box-shadow oscillates between 4px and 16px teal glow)
  - CSS animation `shimmer` sweep across it (translateX -100%→400%, 2.5s infinite)
- **Goal coins** (between partial and goal marker): `border: 1px dashed rgba(61,32,112,0.6), background: rgba(61,32,112,0.06)`
- **Goal label** above columns: `font-size: 7px, color: #4A2878` — reads "£{nw_goal/1000}k goal"
- **Coin drop animation** on mount: staggered `coin-drop` keyframe (translateY -8px→0, opacity 0→1) with 50ms delay per coin

### Right-side content

```
Net worth          [label: 10px uppercase #4A3870]
£151,934           [34px, weight 500, color #E8E0F0]
£48k to go         [10px #2D5A44]
[progress bar]     [flex-1 height 4px, filled teal to goal %]
Invested   Cash    [two mini cards: #0A1F17 / #100820]
£98k       £54k    [12px teal / purple]
[FIRE bar]         [2px height, 10.1% filled #2D5A44, label "FIRE 2030 · 10.1%"]
[floating £ coin]  [SVG, position: absolute top-right, float-coin animation]
```

**Floating £ coin SVG** (top-right of right column, `position: absolute, top: -4px, right: -4px`):
```svg
<circle r="14" fill="#EF9F27" opacity="0.12"/>
<circle r="11" stroke="#BA7517" strokeWidth="1" fill="none" opacity="0.4"/>
<text fill="#BA7517" fontSize="13" opacity="0.7">£</text>
```
Animation: `float-coin` keyframe (translateY 0→-4px, rotate -5deg→5deg, 3s infinite).

### Shadow row

Always at the bottom, separated by `border-top: 0.5px solid #1E0D40`.

**Deficit state** (`shadow_gap > 0`, i.e. behind plan):
```
[amber pill] ⚠ Behind shadow  −£3,266  →  −£4,580 in 5yr   [▾ chevron]
pill bg: rgba(186,117,23,0.12), border: 0.5px solid rgba(186,117,23,0.35)
text colors: label #BA7517, amount #EF9F27, 5yr #7A5520
```

**Surplus state** (`shadow_gap < 0`, i.e. ahead of plan):
```
[green pill] ✓ Ahead of shadow  +£3,300  →  +£4,630 in 5yr   [▾ chevron]
pill bg: rgba(29,158,117,0.10), border: 0.5px solid rgba(29,158,117,0.3)
text colors: all #1D9E75 / #2D5A44
```

**Neutral** (`shadow_gap === 0`): show "On track with shadow" in muted teal.

**Expanded panel** (max-height transition, 0→320px):
- Explanation sentence (11px, #6B5E8C)
- Dark breakdown card (#100818, border #1E0D40):
  - Budget surplus (Jan–present)
  - Actual surplus
  - Divider
  - Gap now (red if deficit)
  - In 5yr at 7% (red if deficit)

### CSS keyframes to add to `globals.css`

```css
@keyframes vault-pulse-glow {
  0%, 100% { box-shadow: 0 0 4px rgba(29,158,117,0.4), 0 0 8px rgba(29,158,117,0.2); }
  50%       { box-shadow: 0 0 8px rgba(29,158,117,0.8), 0 0 16px rgba(29,158,117,0.4); }
}
@keyframes vault-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
@keyframes vault-coin-drop {
  0%   { transform: translateY(-8px); opacity: 0; }
  100% { transform: translateY(0);    opacity: 1; }
}
@keyframes vault-float-coin {
  0%, 100% { transform: translateY(0px) rotate(-5deg); }
  50%       { transform: translateY(-4px) rotate(5deg); }
}
```

---

## 4 · CharacterPage integration

**File:** `src/components/CharacterPage.tsx`

Add after the `{dimension === 'vitality' && ...}` Oura block:

```tsx
{dimension === 'wealth' && (
  <VaultNetWorthCard userId={getUserId()} accentColor={accentColor} />
)}
```

Import at top: `import { VaultNetWorthCard } from '@/components/vault/VaultNetWorthCard'`

---

## 5 · Vault settings page

**File:** `src/app/vault/settings/page.tsx`

A new full-page settings screen accessible via a settings icon link on the Vault character page.

### Entry point

Add a small settings link to `CharacterPage.tsx`, rendered only when `dimension === 'wealth'`, positioned in the top-right area of the `VaultNetWorthCard` or just below the hero section:

```tsx
{dimension === 'wealth' && (
  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
    <Link href="/vault/settings" style={{ fontSize: 10, color: '#4A2878', display: 'flex', alignItems: 'center', gap: 4 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33..."/>
      </svg>
      Vault settings
    </Link>
  </div>
)}
```

### Page sections (in order)

All sections use the same `LeftBorderCard`-style cards (`background: #140C28, border: 0.5px solid #2D1B55, borderRadius: 14px`) with row items separated by `border-bottom: 0.5px solid #1A0D35`.

Each editable row: label on left with coloured icon, `<input>` on right styled as `background: #0D0820, border: 0.5px solid #3D2070, borderRadius: 8px, padding: 4px 10px, fontSize: 13px, color: #E8E0F0, textAlign: right`.

**Section 1 — Net worth**
- Invested (£)
- Cash & savings (£)
- *Read-only total row* showing `invested + cash`

**Section 2 — Income**
- Monthly net income (£)
- Monthly savings target (£)

**Section 3 — Monthly budget**
- One row per category from `budget_categories` JSONB
- Each row: coloured icon (per category color), label, mini bar (width = budget/income * 100%), amount input
- Read-only footer row: total budget + computed monthly surplus (income − total budget)
- Categories are fixed (no add/remove in v1)

**Section 4 — Investments & growth**
- Expected return p.a. (%, default 7)
- ISA allowance used (£)
- Shadow compound rate (%, default 7) — used for 5yr impact calc

**Section 5 — FIRE target**
- FIRE number (£)
- Target year
- Annual spend in FIRE (£)
- *Read-only* "On current trajectory" row — computes FIRE year from current NW + monthly surplus + expected return rate

**Section 6 — Short-term goal (coin tracker)**
- Net worth goal (£) — default 200,000
- Goal deadline (date)
- Each coin = (£) — default 10,000

### Save button

Full-width teal button `background: #1D9E75, color: #012A1E`. On tap: `PUT /api/vault/settings` with full form state. Show a brief success toast on save.

### State management

Single `useState<VaultSettings>` object. `useEffect` on mount fetches current settings and populates form. On save, PUT and navigate back (`router.back()`).

---

## 6 · Oracle `VAULT_UPDATE` intent

### Classify route addition

**File:** `src/app/api/oracle/classify/route.ts`

Add `VAULT_UPDATE` as intent #10 in the prompt, between `CALENDAR_DELETE` and `CHAT`:

```
10. VAULT_UPDATE — user is reporting a change to their net worth or savings balance.
    Triggers: "my revolut is now", "my savings is now", "cash is now", "just transferred",
    "invested another", "net worth update", "my ISA is now", "my portfolio is",
    "topped up", "withdrew from savings".
    Extract:
    - field: "invested" | "cash" | "both"
    - amount: the new balance in GBP (not a delta — the full new amount)
    - notes: optional context string
    If the user gives a delta ("I added £2k to savings"), convert to absolute if prior
    balance is known from context, otherwise store as delta with field "cash_delta" or
    "invested_delta" and amount = the delta value.
```

Add to JSON response schema:
```json
"vault_update": {
  "field": "invested" | "cash" | "cash_delta" | "invested_delta" | "both",
  "amount": 56000,
  "notes": "Revolut savings pot" | null
} | null
```

The `oracleReply` for `VAULT_UPDATE` should be warm and brief: acknowledge the update and mention the new total net worth if both invested and cash are known.

### OracleSheet handling

**File:** `src/components/OracleSheet.tsx`

Add `'vault-updated'` to `SheetState` type.

Add `vault_update` to `ClassifyResult` interface:
```ts
vault_update?: {
  field: 'invested' | 'cash' | 'cash_delta' | 'invested_delta' | 'both'
  amount: number
  notes?: string
} | null
```

In `handleSubmit`, after the existing CALENDAR_DELETE block, add:

```ts
if (result.intent === 'VAULT_UPDATE' && result.vault_update) {
  const vu = result.vault_update
  // Fetch current settings to compute new values
  const settingsRes = await fetch(`/api/vault/settings?userId=${userId}`)
  const { settings } = await settingsRes.json()
  const current = settings ?? { invested: 0, cash: 0 }

  const patch: Record<string, number> = {}
  if (vu.field === 'cash')          patch.cash = vu.amount
  if (vu.field === 'invested')      patch.invested = vu.amount
  if (vu.field === 'both')          { patch.cash = vu.amount; patch.invested = vu.amount }
  if (vu.field === 'cash_delta')    patch.cash = current.cash + vu.amount
  if (vu.field === 'invested_delta') patch.invested = current.invested + vu.amount

  await fetch('/api/vault/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, patch }),
  })
  setState('vault-updated')
  return
}
```

Add `vault-updated` UI state — same pattern as `activity-done`:
- Header: "Vault updated ✓"
- Subtitle: "Net worth synced"
- Oracle reply bubble with the `oracleReply` text (rendered via `renderMarkdown`)
- A small line showing the new total: `£{(patch.invested ?? current.invested) + (patch.cash ?? current.cash)}`

---

## 7 · "I slipped" button

This button lives at the bottom of `VaultNetWorthCard`. It is **not** the Oracle button — it's a quick-log for impulse spending that increases `shadow_gap`.

On tap:
1. Show a small inline form: spend amount (£) + optional category
2. On confirm: `PUT /api/vault/settings` with `{ patch: { shadow_gap: currentGap + amount } }`
3. The robot face in the button changes to sad state (frown mouth, dimmed eyes, dark red border) for 2 seconds then resets
4. The shadow row updates to reflect the new gap

**Sad robot SVG state** (same `VaultCharacterLarge` SVG, modified):
- Body fill: `#0F6E56` (dimmed)
- Eye gleams: `opacity: 0.15`
- Mouth path: flipped to frown `M13 32 Q18 29 24 32`
- Button border: `0.5px solid rgba(224,82,82,0.4)`, bg: `rgba(90,20,20,0.2)`

---

## 8 · File checklist

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_vault_settings.sql` | New migration — create `vault_settings` table |
| `src/lib/supabase.ts` or `src/lib/db.ts` | Add `getVaultSettings`, `upsertVaultSettings` helpers |
| `src/app/api/vault/settings/route.ts` | New — GET + PUT handlers |
| `src/components/vault/VaultNetWorthCard.tsx` | New component |
| `src/app/vault/settings/page.tsx` | New settings page |
| `src/components/CharacterPage.tsx` | Add `VaultNetWorthCard` block + settings link |
| `src/app/api/oracle/classify/route.ts` | Add `VAULT_UPDATE` intent + `vault_update` JSON field |
| `src/components/OracleSheet.tsx` | Handle `VAULT_UPDATE` intent, add `vault-updated` state |
| `src/app/globals.css` | Add 4 vault CSS keyframes |

---

## 9 · Acceptance criteria

- [ ] Vault character page shows `VaultNetWorthCard` between hero section and Legend card
- [ ] Coins fill correctly based on `(invested + cash) / coin_denomination`
- [ ] Partial coin pulses and shimmers
- [ ] Coin drop animation plays on mount (staggered)
- [ ] Floating £ coin animates in top-right
- [ ] Shadow row shows amber pill when behind, teal when ahead
- [ ] Shadow row expands with breakdown + 5yr compound figure on tap
- [ ] "I slipped" button triggers sad robot state + inline amount entry + updates `shadow_gap`
- [ ] `/vault/settings` page loads with current values from DB
- [ ] All settings fields save correctly on button tap
- [ ] Monthly surplus and FIRE trajectory compute correctly from form values
- [ ] Oracle recognises "my Revolut savings is now £X" → updates `cash` in vault_settings
- [ ] Oracle recognises "I invested another £X" → updates `invested_delta`
- [ ] `vault-updated` Oracle state shows new total net worth
- [ ] `VaultNetWorthCard` re-fetches after Oracle update (emit a custom event or use router refresh)
