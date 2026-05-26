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
  -- "I slipped" state
  last_slip_at       TIMESTAMPTZ,          -- null = no slip today; set to NOW() on log
  last_slip_amount   NUMERIC,              -- the amount logged
  last_slip_category TEXT,                 -- e.g. 'shopping', 'restaurants', 'going_out'
  last_slip_note     TEXT,                 -- optional user note
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

### 7a · Button placement

A small red button lives at the bottom-right of `VaultNetWorthCard`, always visible but intentionally quiet — you have to mean it to tap it:

```tsx
<div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
  <button
    onClick={() => setSlipOpen(true)}
    style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: '#2A0808',
      border: '0.5px solid #8B2020',
      borderRadius: 20,
      padding: '5px 12px',
      cursor: 'pointer',
    }}
  >
    {/* flame icon */}
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M12 3C10 8 6 10 6 14C6 17.3 8.7 20 12 20C15.3 20 18 17.3 18 14C18 10 14 8 12 3Z"
        stroke="#E05050" strokeWidth="1.5" />
    </svg>
    <span style={{ fontSize: 11, color: '#E05050', fontWeight: 500 }}>I slipped</span>
  </button>
</div>
```

### 7b · Inline expansion

When tapped, the confession form slides down **within the card** (no modal/overlay) using a `max-height` CSS transition (`0 → 480px, 0.35s ease`). The net worth card itself is unchanged above it.

**Confession form layout** (matches the approved screenshot exactly):

```tsx
{slipOpen && (
  <div style={{
    marginTop: 14,
    background: '#12101E',
    borderRadius: 14,
    borderLeft: '3px solid #1D9E75',
    padding: '16px 14px 20px',
    overflow: 'hidden',
  }}>
    {/* Robot + title row */}
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
      {/* Sad animated robot — see 7c */}
      <SlipRobot />
      <div>
        <p style={{ fontSize: 17, fontWeight: 600, color: '#E8824A', marginBottom: 6 }}>
          Vault is hurt 🥺
        </p>
        <p style={{ fontSize: 13, color: '#7A6A8A', lineHeight: 1.55 }}>
          Shadow gap widened by £{slipAmount || '…'}.<br />
          Auto-recovers tomorrow.
        </p>
      </div>
    </div>

    {/* Form */}
    <div style={{ background: '#1A1630', borderRadius: 14, padding: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#6A5A8A', letterSpacing: '0.1em',
                  textTransform: 'uppercase', marginBottom: 12 }}>
        What did you spend on?
      </p>
      {/* Category chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {SLIP_CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => setSlipCat(cat.key)}
            style={{
              background: slipCat === cat.key ? '#1E1A34' : '#12101E',
              border: `0.5px solid ${slipCat === cat.key ? '#5A40A0' : '#2A2040'}`,
              borderRadius: 22, padding: '7px 14px',
              fontSize: 13, color: slipCat === cat.key ? '#C8B8F0' : '#8A7AAA',
              cursor: 'pointer',
            }}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>
      {/* Amount */}
      <div style={{ background: '#12101E', border: '0.5px solid #2A2040', borderRadius: 12,
                    padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 18, color: '#5A4A7A' }}>£</span>
        <input type="number" placeholder="How much?"
          value={slipAmount} onChange={e => setSlipAmount(Number(e.target.value))}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
                   fontSize: 18, color: '#E8E0F0' }} />
      </div>
      {/* Note */}
      <div style={{ background: '#12101E', border: '0.5px solid #2A2040', borderRadius: 12,
                    padding: '14px 16px', marginBottom: 12 }}>
        <input type="text" placeholder="What was it? (optional)"
          value={slipNote} onChange={e => setSlipNote(e.target.value)}
          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none',
                   fontSize: 13, color: '#C0B0D8' }} />
      </div>
      {/* Submit */}
      <button onClick={handleLogSlip}
        style={{ width: '100%', background: '#2A0E0E', border: '0.5px solid #7A2020',
                 borderRadius: 12, padding: 16, fontSize: 15, fontWeight: 500,
                 color: '#E05050', cursor: 'pointer' }}>
        I know, I know... log it
      </button>
    </div>
  </div>
)}
```

**Category definitions** (`SLIP_CATEGORIES`):
```ts
const SLIP_CATEGORIES = [
  { key: 'shopping',    emoji: '🛍',  label: 'Shopping'    },
  { key: 'restaurants', emoji: '🍽',  label: 'Restaurants' },
  { key: 'going_out',   emoji: '🎉',  label: 'Going out'   },
  { key: 'beauty',      emoji: '💄',  label: 'Beauty'      },
  { key: 'other',       emoji: '❓',  label: 'Other'       },
]
```

### 7c · Sad robot (`SlipRobot`)

A small sub-component rendering `VaultCharacterLarge` in its sad state with CSS animations.

**SVG modifications from normal:**
- Body fill stays `#1D9E75` (green — same character, just sad)
- Eye gleam circles: `cy` shifted +1.5px (looking down)
- Brow paths added: `M9 20 L14 22` and `M22 22 L27 20` — angled inward, stroke `#9FE1CB`
- Mouth: flipped to frown `d="M10 33Q18 29 26 33"`
- Tear drops: two `<div>` absolutely positioned below each eye, `width: 5px, height: 9px, background: #9FE1CB, borderRadius: '0 0 5px 5px'`

**CSS animations to add to `globals.css`:**
```css
@keyframes vault-slip-wobble {
  0%, 100% { transform: rotate(0deg) translateX(0px); }
  20%       { transform: rotate(-4deg) translateX(-3px); }
  40%       { transform: rotate(3deg) translateX(2px); }
  60%       { transform: rotate(-2deg) translateX(-1px); }
  80%       { transform: rotate(1deg) translateX(1px); }
}
@keyframes vault-tear-fall {
  0%   { transform: translateY(0px); opacity: 0.8; }
  100% { transform: translateY(14px); opacity: 0; }
}
```

Applied:
- Robot SVG wrapper: `animation: vault-slip-wobble 1.4s ease-in-out infinite`
- Left tear div: `animation: vault-tear-fall 1.1s ease-in infinite`
- Right tear div: `animation: vault-tear-fall 1.1s ease-in 0.4s infinite`

### 7d · `handleLogSlip` — what happens on "I know, I know... log it"

```ts
async function handleLogSlip() {
  if (!slipAmount || slipAmount <= 0) return
  setSlipOpen(false)

  // 1. Update shadow_gap and record the slip
  await fetch('/api/vault/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      patch: {
        shadow_gap: (settings.shadow_gap ?? 0) + slipAmount,
        last_slip_at: new Date().toISOString(),
        last_slip_amount: slipAmount,
        last_slip_category: slipCat ?? 'other',
        last_slip_note: slipNote ?? null,
      },
    }),
  })

  // 2. Ask Oracle to create a recovery task
  await fetch('/api/oracle/create-slip-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, category: slipCat, amount: slipAmount }),
  })

  // 3. Refresh card data
  refetch()
}
```

### 7e · Oracle recovery task creation

**New route:** `POST /api/oracle/create-slip-task`

Called silently after a slip is logged. Creates a task in the wealth dimension with a personalised title based on category.

```ts
// Category → recovery task title mapping
const RECOVERY_TASKS: Record<string, string> = {
  shopping:    'No impulse buys for 7 days',
  restaurants: 'Cook at home 5 times this week',
  going_out:   'No nights out for 5 days',
  beauty:      'Skip non-essential beauty purchases this week',
  other:       'Cut one non-essential spend this week',
}

// Route handler
export async function POST(req: Request) {
  const { userId, category, amount } = await req.json()
  const title = RECOVERY_TASKS[category ?? 'other']
    ?? 'Cut one non-essential spend this week'

  await supabase.from('tasks').insert({
    user_id:     userId,
    dimension:   'wealth',
    title,
    description: `Recovery task after a £${amount} slip. Complete to get back on track.`,
    completed:   false,
    created_at:  new Date().toISOString(),
  })

  return Response.json({ ok: true })
}
```

The created task appears normally in Vault's task list on the character page. No special flag needed — it's just a regular wealth task with a relevant title.

### 7f · Sad hero state

When `last_slip_at` is set and its **date is today** (compare `toDateString()`), the Vault character page enters sad state. This is checked in `CharacterPage.tsx` when `dimension === 'wealth'` and `vaultSettings` is loaded.

**Hero section changes (sad state only):**

```tsx
const isSlipDay = vaultSettings?.last_slip_at
  ? new Date(vaultSettings.last_slip_at).toDateString() === new Date().toDateString()
  : false
```

1. **Robot wrapper** gets the bounce + wobble animation:
```tsx
<div style={{
  flexShrink: 0,
  animation: isSlipDay
    ? 'vault-slip-wobble 1.8s ease-in-out infinite'
    : 'protagonist-float 3.2s ease-in-out infinite',
  transformOrigin: 'center bottom',
  position: 'relative',
}}>
  <HeroArt />
  {isSlipDay && (
    <>
      {/* Animated tears overlaid on robot */}
      <div style={{
        position: 'absolute', left: 18, top: 52,
        width: 5, height: 9, background: '#9FE1CB',
        borderRadius: '0 0 5px 5px',
        animation: 'vault-tear-fall 1.1s ease-in infinite',
      }} />
      <div style={{
        position: 'absolute', left: 36, top: 52,
        width: 5, height: 9, background: '#9FE1CB',
        borderRadius: '0 0 5px 5px',
        animation: 'vault-tear-fall 1.1s ease-in 0.45s infinite',
      }} />
    </>
  )}
</div>
```

2. **Name row** gains a red badge when `isSlipDay`:
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
  <span style={{ fontSize: 22, fontWeight: 500, color: '#E8E0F0' }}>{char.name}</span>
  <span style={{ ... }}>{char.categoryLabel}</span>
  {isSlipDay && (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: '#2A0808', border: '0.5px solid #7A2020',
      borderRadius: 20, padding: '3px 10px',
      fontSize: 11, color: '#E05050',
    }}>
      😢 Vault is hurt · −£{vaultSettings.last_slip_amount?.toLocaleString()}
    </span>
  )}
</div>
```

### 7g · Auto-recovery

No user action required. The sad state is entirely driven by `last_slip_at`:

- If `last_slip_at` date === today → sad state active
- If `last_slip_at` date < today (yesterday or earlier) → normal state automatically

No cron job or DB update needed — the comparison happens at read time on page load. The robot returns to normal the next day simply because the date no longer matches.

---

## 8 · File checklist

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_vault_settings.sql` | New migration — create `vault_settings` table (including `last_slip_at`, `last_slip_amount`, `last_slip_category`, `last_slip_note`) |
| `src/lib/supabase.ts` or `src/lib/db.ts` | Add `getVaultSettings`, `upsertVaultSettings` helpers |
| `src/app/api/vault/settings/route.ts` | New — GET + PUT handlers |
| `src/app/api/oracle/create-slip-task/route.ts` | New — POST handler that creates a personalised recovery task |
| `src/components/vault/VaultNetWorthCard.tsx` | New component — includes "I slipped" button + inline expansion + `SlipRobot` sub-component |
| `src/app/vault/settings/page.tsx` | New settings page — add `paddingBottom: 100` to prevent footer overlap |
| `src/components/CharacterPage.tsx` | Add `VaultNetWorthCard` block + settings link + sad hero state (bouncing robot, tear drops, red badge) when `isSlipDay` |
| `src/app/api/oracle/classify/route.ts` | Add `VAULT_UPDATE` intent + `vault_update` JSON field |
| `src/components/OracleSheet.tsx` | Handle `VAULT_UPDATE` intent, add `vault-updated` state |
| `src/app/globals.css` | Add vault CSS keyframes: `vault-pulse-glow`, `vault-shimmer`, `vault-coin-drop`, `vault-float-coin`, `vault-slip-wobble`, `vault-tear-fall` |

---

## 9 · Acceptance criteria

**Net worth card**
- [ ] `VaultNetWorthCard` appears between hero section and Legend card
- [ ] Coins fill correctly based on `(invested + cash) / coin_denomination`
- [ ] Partial coin pulses (vault-pulse-glow) and shimmers (vault-shimmer)
- [ ] Coin drop animation plays on mount (staggered 50ms per coin)
- [ ] Floating £ coin animates in top-right (vault-float-coin)
- [ ] Shadow row shows amber pill when `shadow_gap > 0` (behind), teal when `shadow_gap < 0` (ahead)
- [ ] Shadow row expands with breakdown + 5yr compound figure on tap

**"I slipped" button**
- [ ] Small red button ("I slipped") appears at bottom-right of `VaultNetWorthCard`
- [ ] Tapping it slides down the confession form inline (no modal) within the card
- [ ] The sad robot animates: wobbles left-right (vault-slip-wobble), tears fall (vault-tear-fall)
- [ ] Category chips (Shopping / Restaurants / Going out / Beauty / Other) are selectable
- [ ] Submitting updates `shadow_gap += slipAmount` and saves `last_slip_at`, `last_slip_category`, `last_slip_amount`, `last_slip_note`
- [ ] A personalised recovery task is created in the wealth dimension via `POST /api/oracle/create-slip-task`
- [ ] Recovery task title matches the category (e.g. shopping → "No impulse buys for 7 days")

**Sad hero state**
- [ ] On slip day (`last_slip_at` date === today), the Vault hero robot bounces with vault-slip-wobble animation
- [ ] Two animated teal teardrops overlay the hero robot (vault-tear-fall)
- [ ] A red "😢 Vault is hurt · −£X" badge appears next to the character name
- [ ] The next day (after midnight), the hero automatically returns to normal state — no user action required
- [ ] Normal float animation (protagonist-float) resumes on recovery

**Settings page**
- [ ] `/vault/settings` page loads with current values from DB
- [ ] All settings fields save correctly via PUT
- [ ] Monthly surplus and FIRE trajectory compute correctly
- [ ] Save button is not hidden behind footer nav (`paddingBottom: 100`)

**Oracle vault update**
- [ ] Oracle recognises "my Revolut savings is now £X" → updates `cash` in vault_settings
- [ ] Oracle recognises "I invested another £X" → updates `invested_delta`
- [ ] `vault-updated` Oracle state shows new total net worth
- [ ] `VaultNetWorthCard` re-fetches after Oracle update
