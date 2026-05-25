# PRP-018: Seven-Dimension Expansion

**Status:** Ready for Cursor  
**Priority:** High  
**Depends on:** PRP-014 (Character Pages), PRP-015 (Oracle + Tasks), PRP-016 (XP), PRP-017 (Witness)

---

## Overview

Expand Protagonist from 3 dimensions (career, social, wealth) to all **7 dimensions**, each with a named character, dedicated page, quests, milestones, tasks, and a specialist agent. Add a **configurable bottom nav** where users can pin their active 3 characters (Home and Tasks are always fixed), a **Settings page** accessible via a hamburger/gear icon on the dashboard, and update Oracle's classify and tasks to understand all 7 dimensions.

---

## The 7 Dimensions

| ID | Character | Colour | Page route | Tier labels |
|---|---|---|---|---|
| `career` | **Forge** | `#EF9F27` | `/forge` | Apprentice Maker → Craftsman → Master Maker |
| `social` | **Echo** | `#F0997B` | `/echo` | Newcomer → Connector → Community Sage |
| `wealth` | **Vault** | `#1D9E75` | `/vault` | Saver → Investor → Financially Free |
| `vitality` | **Blaze** | `#F43F5E` | `/blaze` | Spark → Ember → Flame |
| `mind` | **Sage** | `#818CF8` | `/sage` | Curious → Scholar → Illuminated |
| `love` | **Sol** | `#F472B6` | `/sol` | Tender → Devoted → Radiant |
| `family` | **Root** | `#4ADE80` | `/root` | Seedling → Grounded → Rooted |

---

## Part 1 — Data Model Extensions

### 1.1 `src/lib/character.ts`

Extend `Dimension` type and `CHARACTERS` record. Replace the existing file entirely:

```typescript
import { getTier } from '@/lib/xp'

export type Dimension =
  | 'career'
  | 'social'
  | 'wealth'
  | 'vitality'
  | 'mind'
  | 'love'
  | 'family'

export interface CharacterConfig {
  name: string
  dimension: Dimension
  color: string
  bgColor: string
  badgeBg: string
  badgeBorder: string
  tierLabels: [string, string, string]
  /** memory dimension_id used in dimension_memories table */
  memoryId: string
  /** short description shown on Settings page */
  tagline: string
}

export const CHARACTERS: Record<Dimension, CharacterConfig> = {
  career: {
    name: 'Forge',
    dimension: 'career',
    color: '#EF9F27',
    bgColor: 'rgba(239,159,39,0.12)',
    badgeBg: 'rgba(239,159,39,0.12)',
    badgeBorder: 'rgba(239,159,39,0.28)',
    tierLabels: ['Apprentice Maker', 'Craftsman', 'Master Maker'],
    memoryId: 'create',
    tagline: 'Work, career & purpose',
  },
  social: {
    name: 'Echo',
    dimension: 'social',
    color: '#F0997B',
    bgColor: 'rgba(240,153,123,0.12)',
    badgeBg: 'rgba(240,153,123,0.12)',
    badgeBorder: 'rgba(240,153,123,0.28)',
    tierLabels: ['Newcomer', 'Connector', 'Community Sage'],
    memoryId: 'social',
    tagline: 'Friendships & community',
  },
  wealth: {
    name: 'Vault',
    dimension: 'wealth',
    color: '#1D9E75',
    bgColor: 'rgba(29,158,117,0.12)',
    badgeBg: 'rgba(29,158,117,0.12)',
    badgeBorder: 'rgba(29,158,117,0.28)',
    tierLabels: ['Saver', 'Investor', 'Financially Free'],
    memoryId: 'wealth',
    tagline: 'Money, savings & growth',
  },
  vitality: {
    name: 'Blaze',
    dimension: 'vitality',
    color: '#F43F5E',
    bgColor: 'rgba(244,63,94,0.12)',
    badgeBg: 'rgba(244,63,94,0.12)',
    badgeBorder: 'rgba(244,63,94,0.28)',
    tierLabels: ['Spark', 'Ember', 'Flame'],
    memoryId: 'vitality',
    tagline: 'Body, movement & energy',
  },
  mind: {
    name: 'Sage',
    dimension: 'mind',
    color: '#818CF8',
    bgColor: 'rgba(129,140,248,0.12)',
    badgeBg: 'rgba(129,140,248,0.12)',
    badgeBorder: 'rgba(129,140,248,0.28)',
    tierLabels: ['Curious', 'Scholar', 'Illuminated'],
    memoryId: 'mind',
    tagline: 'Learning, focus & clarity',
  },
  love: {
    name: 'Sol',
    dimension: 'love',
    color: '#F472B6',
    bgColor: 'rgba(244,114,182,0.12)',
    badgeBg: 'rgba(244,114,182,0.12)',
    badgeBorder: 'rgba(244,114,182,0.28)',
    tierLabels: ['Tender', 'Devoted', 'Radiant'],
    memoryId: 'love',
    tagline: 'Romance & intimacy',
  },
  family: {
    name: 'Root',
    dimension: 'family',
    color: '#4ADE80',
    bgColor: 'rgba(74,222,128,0.12)',
    badgeBg: 'rgba(74,222,128,0.12)',
    badgeBorder: 'rgba(74,222,128,0.28)',
    tierLabels: ['Seedling', 'Grounded', 'Rooted'],
    memoryId: 'family',
    tagline: 'Family & home',
  },
}

export const ALL_DIMENSIONS: Dimension[] = [
  'career', 'social', 'wealth', 'vitality', 'mind', 'love', 'family',
]

export const DEFAULT_PINNED_DIMENSIONS: Dimension[] = ['career', 'social', 'wealth']

export function getCharacterTierLabel(dimension: Dimension, xp: number): string {
  const tier = getTier(xp)
  return CHARACTERS[dimension].tierLabels[tier - 1]
}
```

### 1.2 `src/lib/tierName.ts`

Add the 4 new dimension-to-slug entries:

```typescript
export const DIMENSION_TO_SLUG: Record<string, string> = {
  career: 'forge',
  social: 'echo',
  wealth: 'vault',
  vitality: 'blaze',
  mind: 'sage',
  love: 'sol',
  family: 'root',
}
```

### 1.3 Supabase — ensure tables support new dimensions

The `quest_dimension_xp`, `tasks`, `main_quests`, `milestones`, and `dimension_memories` tables all store `dimension` as a free text string — no migration needed. The 4 new dimension IDs just start being used.

Run this SQL to seed empty XP rows for existing users (optional, graceful fallback if row absent):

```sql
-- Insert missing XP rows for new dimensions
INSERT INTO quest_dimension_xp (user_id, dimension, xp)
SELECT DISTINCT user_id, unnest(ARRAY['vitality','mind','love','family']) AS dimension, 0
FROM quest_dimension_xp
ON CONFLICT (user_id, dimension) DO NOTHING;
```

---

## Part 2 — Character Art Components

### 2.1 New file: `src/components/characters/BlazeCharacter.tsx`

```tsx
/** Blaze — vitality/body — #F43F5E rose-red */
export function BlazeCharacterLarge() {
  return (
    <svg width="96" height="118" viewBox="0 0 44 54" fill="none">
      {/* Flame crown */}
      <path
        d="M18 8 C18 4 22 2 22 2 C22 2 26 4 26 8 C26 12 22 14 22 14 C22 14 18 12 18 8Z"
        fill="#F43F5E"
        opacity={0.9}
      />
      <path
        d="M20 9 C20 6.5 22 5 22 5 C22 5 24 6.5 24 9 C24 11 22 12.5 22 12.5 C22 12.5 20 11 20 9Z"
        fill="#FF6B85"
        opacity={0.7}
      />
      {/* Head */}
      <rect x="3" y="12" width="30" height="24" rx="9" fill="#F43F5E" />
      {/* Eyes */}
      <circle cx="13" cy="24" r="6" fill="#3B0010" />
      <circle cx="26" cy="24" r="6" fill="#3B0010" />
      <circle cx="11" cy="22" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="22" r="2" fill="white" opacity={0.6} />
      {/* Body with EKG line */}
      <rect x="7" y="38" width="22" height="16" rx="5" fill="#BE123C" />
      <polyline
        points="9,47 12,47 14,43 16,51 18,45 20,47 23,47 25,47 27,47"
        stroke="#F43F5E"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.7}
      />
    </svg>
  )
}
```

### 2.2 New file: `src/components/characters/SageCharacter.tsx`

```tsx
/** Sage — mind — #818CF8 soft indigo */
export function SageCharacterLarge() {
  return (
    <svg width="96" height="118" viewBox="0 0 44 54" fill="none">
      {/* Thought-bubble crown */}
      <circle cx="22" cy="6" r="3" fill="#818CF8" opacity={0.9} />
      <circle cx="26" cy="3" r="2.2" fill="#818CF8" opacity={0.65} />
      <circle cx="29" cy="1.5" r="1.4" fill="#818CF8" opacity={0.4} />
      {/* Head */}
      <rect x="3" y="10" width="30" height="24" rx="9" fill="#818CF8" />
      {/* Eyes — wider */}
      <circle cx="12.5" cy="22" r="6.5" fill="#1E1B4B" />
      <circle cx="26" cy="22" r="6.5" fill="#1E1B4B" />
      <circle cx="10" cy="19.5" r="2.5" fill="white" opacity={0.6} />
      <circle cx="23.5" cy="19.5" r="2.5" fill="white" opacity={0.6} />
      {/* Body with neural network */}
      <rect x="7" y="36" width="22" height="16" rx="5" fill="#4338CA" />
      <circle cx="12" cy="41" r="1.8" fill="#818CF8" opacity={0.7} />
      <circle cx="18" cy="44" r="1.8" fill="#818CF8" opacity={0.7} />
      <circle cx="24" cy="41" r="1.8" fill="#818CF8" opacity={0.7} />
      <line x1="12" y1="41" x2="18" y2="44" stroke="#818CF8" strokeWidth="1" opacity={0.5} />
      <line x1="18" y1="44" x2="24" y2="41" stroke="#818CF8" strokeWidth="1" opacity={0.5} />
      <line x1="12" y1="41" x2="24" y2="41" stroke="#818CF8" strokeWidth="0.8" opacity={0.3} />
    </svg>
  )
}
```

### 2.3 New file: `src/components/characters/SolCharacter.tsx`

```tsx
/** Sol — love — #F472B6 warm pink */
export function SolCharacterLarge() {
  return (
    <svg width="96" height="118" viewBox="0 0 44 54" fill="none">
      {/* Heart crown */}
      <path
        d="M22 10 C22 10 17 5 17 3 C17 1 19 0 20.5 1 C21.2 1.5 22 2.5 22 2.5 C22 2.5 22.8 1.5 23.5 1 C25 0 27 1 27 3 C27 5 22 10 22 10Z"
        fill="#F472B6"
        opacity={0.9}
      />
      {/* Head */}
      <rect x="3" y="11" width="30" height="24" rx="9" fill="#F472B6" />
      {/* Eyes */}
      <circle cx="13" cy="23" r="6" fill="#4A0020" />
      <circle cx="26" cy="23" r="6" fill="#4A0020" />
      <circle cx="11" cy="21" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="21" r="2" fill="white" opacity={0.6} />
      {/* Body with two linked rings */}
      <rect x="7" y="37" width="22" height="16" rx="5" fill="#BE185D" />
      <circle cx="15" cy="45" r="4.5" fill="none" stroke="#F472B6" strokeWidth="1.5" opacity={0.7} />
      <circle cx="21" cy="45" r="4.5" fill="none" stroke="#F472B6" strokeWidth="1.5" opacity={0.7} />
    </svg>
  )
}
```

### 2.4 New file: `src/components/characters/RootCharacter.tsx`

```tsx
/** Root — family — #4ADE80 leaf green */
export function RootCharacterLarge() {
  return (
    <svg width="96" height="118" viewBox="0 0 44 54" fill="none">
      {/* Leaf/sprout crown */}
      <path
        d="M22 10 C22 10 18 6 18 3 C18 1 20 0 22 2 C24 0 26 1 26 3 C26 6 22 10 22 10Z"
        fill="#4ADE80"
        opacity={0.9}
      />
      <line x1="22" y1="10" x2="22" y2="13" stroke="#4ADE80" strokeWidth="1.2" opacity={0.6} />
      <path d="M22 11 C22 11 20 9 19 10" stroke="#4ADE80" strokeWidth="1" strokeLinecap="round" fill="none" opacity={0.5} />
      {/* Head */}
      <rect x="3" y="12" width="30" height="24" rx="9" fill="#4ADE80" />
      {/* Eyes */}
      <circle cx="13" cy="24" r="6" fill="#052E16" />
      <circle cx="26" cy="24" r="6" fill="#052E16" />
      <circle cx="11" cy="22" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="22" r="2" fill="white" opacity={0.6} />
      {/* Body with parent + child silhouette */}
      <rect x="7" y="38" width="22" height="16" rx="5" fill="#16A34A" />
      {/* Parent robot */}
      <rect x="11" y="41" width="6" height="8" rx="2" fill="#4ADE80" opacity={0.5} />
      <circle cx="14" cy="40" r="2.5" fill="#4ADE80" opacity={0.6} />
      {/* Child robot */}
      <rect x="20" y="44" width="4" height="6" rx="1.5" fill="#4ADE80" opacity={0.4} />
      <circle cx="22" cy="43" r="1.8" fill="#4ADE80" opacity={0.5} />
    </svg>
  )
}
```

### 2.5 Update `src/components/characters/CharacterHeroArt.tsx`

Add imports and re-exports at the bottom of the existing file:

```tsx
// Add these exports at the bottom of CharacterHeroArt.tsx

export { BlazeCharacterLarge } from './BlazeCharacter'
export { SageCharacterLarge } from './SageCharacter'
export { SolCharacterLarge } from './SolCharacter'
export { RootCharacterLarge } from './RootCharacter'
```

---

## Part 3 — CharacterPage Component

### 3.1 Update `src/components/CharacterPage.tsx`

**A. Update imports:**

```tsx
import {
  EchoCharacterLarge,
  ForgeCharacterLarge,
  VaultCharacterLarge,
  BlazeCharacterLarge,
  SageCharacterLarge,
  SolCharacterLarge,
  RootCharacterLarge,
} from '@/components/characters/CharacterHeroArt'
import { getLevel } from '@/lib/xp'
import { CHARACTERS, type Dimension } from '@/lib/character'
```

**B. Update `HERO_ART` map:**

```tsx
const HERO_ART: Record<Dimension, React.ComponentType> = {
  career: ForgeCharacterLarge,
  social: EchoCharacterLarge,
  wealth: VaultCharacterLarge,
  vitality: BlazeCharacterLarge,
  mind: SageCharacterLarge,
  love: SolCharacterLarge,
  family: RootCharacterLarge,
}
```

**C. Replace `MEMORY_DIMENSION_ID` — use `CHARACTERS[dimension].memoryId` directly:**

Remove the hardcoded `MEMORY_DIMENSION_ID` map. In the `useEffect`, replace:

```tsx
const memoryDim = MEMORY_DIMENSION_ID[dimension]
```

with:

```tsx
const memoryDim = CHARACTERS[dimension].memoryId
```

**D. Update `floatDelay`:**

```tsx
const FLOAT_DELAYS: Record<Dimension, string> = {
  career: '0s', social: '0.5s', wealth: '1s',
  vitality: '0.25s', mind: '0.75s', love: '1.25s', family: '1.5s',
}
const floatDelay = FLOAT_DELAYS[dimension]
```

---

## Part 4 — New Character Page Routes

### 4.1 `src/app/blaze/page.tsx`

```tsx
import { CharacterPage } from '@/components/CharacterPage'
export default function BlazePage() {
  return <CharacterPage dimension="vitality" />
}
```

### 4.2 `src/app/sage/page.tsx`

```tsx
import { CharacterPage } from '@/components/CharacterPage'
export default function SagePage() {
  return <CharacterPage dimension="mind" />
}
```

### 4.3 `src/app/sol/page.tsx`

```tsx
import { CharacterPage } from '@/components/CharacterPage'
export default function SolPage() {
  return <CharacterPage dimension="love" />
}
```

### 4.4 `src/app/root/page.tsx`

```tsx
import { CharacterPage } from '@/components/CharacterPage'
export default function RootPage() {
  return <CharacterPage dimension="family" />
}
```

---

## Part 5 — Configurable Bottom Nav

The nav always has 5 slots: **Home** (fixed left) + **3 pinnable character slots** + **Tasks** (fixed right).

Default pinned: `['career', 'social', 'wealth']` — stored in `localStorage` as `protagonist:pinned_dimensions`.

### 5.1 `src/lib/pinnedDimensions.ts` (new file)

```typescript
import { type Dimension, DEFAULT_PINNED_DIMENSIONS, ALL_DIMENSIONS } from '@/lib/character'

const STORAGE_KEY = 'protagonist:pinned_dimensions'

export function getPinnedDimensions(): [Dimension, Dimension, Dimension] {
  if (typeof window === 'undefined') return [...DEFAULT_PINNED_DIMENSIONS] as [Dimension, Dimension, Dimension]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_PINNED_DIMENSIONS] as [Dimension, Dimension, Dimension]
    const parsed = JSON.parse(raw) as unknown[]
    const valid = parsed
      .filter((d): d is Dimension => ALL_DIMENSIONS.includes(d as Dimension))
      .slice(0, 3) as Dimension[]
    while (valid.length < 3) {
      const fallback = DEFAULT_PINNED_DIMENSIONS.find((d) => !valid.includes(d))
      if (fallback) valid.push(fallback)
      else break
    }
    return valid as [Dimension, Dimension, Dimension]
  } catch {
    return [...DEFAULT_PINNED_DIMENSIONS] as [Dimension, Dimension, Dimension]
  }
}

export function savePinnedDimensions(dims: Dimension[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dims.slice(0, 3)))
}
```

### 5.2 Update `src/components/BottomNav.tsx`

Replace the entire component with the new version:

**Key changes:**
- Remove hardcoded Forge/Echo/Vault items; derive from `getPinnedDimensions()`
- Add long-press (500ms touch hold) on any character item → dispatch `protagonist:open-nav-editor` custom event (the Settings page handles the actual editing, but we can also show an inline swap UI)
- Add a small `···` indicator on long-press to show the item is "pressable"
- Import character icon rendering from a shared `DimensionIcon` component

**Suggested implementation pattern:**

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef, type ReactNode } from 'react'
import { getLevel } from '@/lib/xp'
import { getUserId } from '@/lib/user'
import { getPinnedDimensions } from '@/lib/pinnedDimensions'
import { CHARACTERS, type Dimension } from '@/lib/character'

// Character icon SVGs are defined inline per dimension (see DimensionNavIcon below)
// Home and Tasks icons remain the same as the current BottomNav

export default function BottomNav() {
  const pathname = usePathname()
  const [pinned, setPinned] = useState<[Dimension, Dimension, Dimension]>(['career','social','wealth'])

  // Re-read pinned whenever the user navigates (catches Settings changes)
  useEffect(() => {
    setPinned(getPinnedDimensions())
  }, [pathname])

  // Long-press handler — navigate to settings with the slot pre-selected
  const router = useRouter()
  function handleLongPress(slotIndex: number) {
    router.push(`/settings?editSlot=${slotIndex}`)
  }

  // Home item (fixed)
  // ... (same SVG as current BottomNav)

  // Tasks item (fixed)
  // ... (same SVG as current BottomNav)

  // Render 3 character slots dynamically
  // Each character slot: 
  //   - href = DIMENSION_TO_SLUG[dim] (e.g. '/forge', '/blaze')
  //   - icon = DimensionNavIcon({ dimension: dim, active })
  //   - label = CHARACTERS[dim].name
  //   - accent color = CHARACTERS[dim].color
  //   - long-press → handleLongPress(slotIndex)

  return (
    <nav ...>
      {/* Home (fixed) */}
      {/* pinned[0] character */}
      {/* pinned[1] character */}
      {/* pinned[2] character */}
      {/* Tasks (fixed) */}
    </nav>
  )
}
```

**`DimensionNavIcon` component** — renders the correct character mascot as a small nav icon for each of the 7 dimensions. Use the same SVG paths as the existing Forge/Echo/Vault icons but parameterised by `dimension` and `active` boolean.

The nav icon for each new character:

**Blaze** (vitality) — same goggle structure but `fill={active ? '#F43F5E' : '#2D1B55'}`, add a tiny flame shape above.

**Sage** (mind) — same goggle structure but `fill={active ? '#818CF8' : '#2D1B55'}`, add three small thought-bubble circles above.

**Sol** (love) — same goggle structure but `fill={active ? '#F472B6' : '#2D1B55'}`, add a tiny heart above.

**Root** (family) — same goggle structure but `fill={active ? '#4ADE80' : '#2D1B55'}`, add a small leaf above.

---

## Part 6 — Settings Page

### 6.1 `src/app/settings/page.tsx` (new file)

Full page showing all 7 characters as pinnable cards. User picks exactly 3 to appear in the nav.

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CHARACTERS, ALL_DIMENSIONS, type Dimension } from '@/lib/character'
import { getPinnedDimensions, savePinnedDimensions } from '@/lib/pinnedDimensions'
import { DIMENSION_TO_SLUG } from '@/lib/tierName'

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editSlot = searchParams.get('editSlot') ? Number(searchParams.get('editSlot')) : null

  const [pinned, setPinned] = useState<Dimension[]>(['career','social','wealth'])

  useEffect(() => {
    setPinned(getPinnedDimensions())
  }, [])

  function togglePin(dim: Dimension) {
    setPinned((prev) => {
      if (prev.includes(dim)) {
        // Don't allow fewer than 3 — swap with editSlot or do nothing
        return prev
      }
      if (prev.length >= 3) {
        // Replace the slot being edited, or replace the last one
        const slot = editSlot ?? 2
        const next = [...prev]
        next[slot] = dim
        return next
      }
      return [...prev, dim]
    })
  }

  function handleSave() {
    savePinnedDimensions(pinned)
    router.back()
  }

  return (
    <main style={{ background: '#0D0820', minHeight: '100dvh', paddingBottom: 40, fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif' }}>
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '0 16px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 4px 24px' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9333EA' }}
          >
            ← 
          </button>
          <span style={{ fontSize: 22, fontWeight: 500, color: '#E8E0F0' }}>Settings</span>
        </div>

        {/* Nav customisation section */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 11, color: '#5A4A7A', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            Pinned characters · {pinned.length}/3
          </p>
          <p style={{ fontSize: 12, color: '#3D3358', marginBottom: 16 }}>
            Choose 3 characters to show in your bottom nav. Long-press a nav item anytime to swap.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ALL_DIMENSIONS.map((dim) => {
              const char = CHARACTERS[dim]
              const isPinned = pinned.includes(dim)
              const slotIndex = pinned.indexOf(dim)
              return (
                <button
                  key={dim}
                  onClick={() => togglePin(dim)}
                  style={{
                    background: isPinned ? `${char.bgColor}` : '#140C28',
                    border: `1.5px solid ${isPinned ? char.color : '#2D1B55'}`,
                    borderRadius: 14,
                    padding: '14px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    position: 'relative',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {isPinned && (
                    <div style={{
                      position: 'absolute',
                      top: 8, right: 8,
                      width: 18, height: 18,
                      borderRadius: '50%',
                      background: char.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#0D0820', fontWeight: 700,
                    }}>
                      {slotIndex + 1}
                    </div>
                  )}
                  <div style={{ fontSize: 15, fontWeight: 500, color: isPinned ? char.color : '#C0B0E0', marginBottom: 2 }}>
                    {char.name}
                  </div>
                  <div style={{ fontSize: 11, color: isPinned ? char.color : '#5A4A7A', opacity: isPinned ? 0.8 : 1 }}>
                    {char.tagline}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '14px 0',
            background: '#9333EA',
            border: 'none',
            borderRadius: 12,
            color: 'white',
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Save
        </button>
      </div>
    </main>
  )
}
```

### 6.2 Hamburger / Settings icon on Dashboard

In `src/app/dashboard/page.tsx`, add a settings gear icon in the top-right of the header that links to `/settings`:

Find the dashboard header section and add:

```tsx
import Link from 'next/link'

// Inside the header bar (near the top of the dashboard JSX):
<Link
  href="/settings"
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#140C28',
    border: '0.5px solid #2D1B55',
    color: '#5A4A7A',
  }}
  aria-label="Settings"
>
  {/* Hamburger or gear icon — 3 lines */}
  <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
    <line x1="0" y1="1" x2="16" y2="1" stroke="#5A4A7A" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="0" y1="6" x2="16" y2="6" stroke="#5A4A7A" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="0" y1="11" x2="16" y2="11" stroke="#5A4A7A" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
</Link>
```

---

## Part 7 — Oracle Classify: All 7 Dimensions

### 7.1 Update `src/app/api/oracle/classify/route.ts`

**Change 1** — Update the dimension union in the prompt:

```
- dimension: one of "career", "social", "wealth", "vitality", "mind", "love", "family" — infer from context:
  - career: work, job, interview, project, promotion, side hustle, productivity
  - social: friends, events, networking, community, going out, catch up
  - wealth: money, savings, investments, budget, expenses, salary
  - vitality: exercise, workout, gym, sleep, eating, health, energy, steps, walk, run
  - mind: learning, reading, study, courses, journaling, meditation, focus, clarity
  - love: partner, relationship, date, romance, intimacy, connection with significant other
  - family: kids, parents, siblings, home, chores, family time, household
  If unclear, return null.
```

**Change 2** — Update the JSON schema in the prompt to reflect the new dimension union:

```json
{
  "intent": "TASK" | "NOTE" | "CHAT",
  "task": {
    "title": "...",
    "dimension": "career" | "social" | "wealth" | "vitality" | "mind" | "love" | "family" | null,
    ...
  } | null,
  ...
}
```

**Change 3** — Update any TypeScript type assertions in the route handler to accept the 7 dimension values.

---

## Part 8 — Tasks Page: All 7 Dimensions

### 8.1 Update `src/app/tasks/page.tsx`

**Change 1** — Update `DIMENSION_ORDER` and `DIMENSION_META`:

```typescript
import { ALL_DIMENSIONS, CHARACTERS } from '@/lib/character'
import { DIMENSION_TO_SLUG } from '@/lib/tierName'

const DIMENSION_ORDER = ALL_DIMENSIONS  // all 7

const DIMENSION_META = Object.fromEntries(
  ALL_DIMENSIONS.map((dim) => [
    dim,
    {
      label: `${CHARACTERS[dim].name} · ${CHARACTERS[dim].tagline}`,
      color: CHARACTERS[dim].color,
      dot: CHARACTERS[dim].color,
    },
  ])
) as Record<string, { label: string; color: string; dot: string }>
```

**Change 2** — The today/someday/upcoming fetch logic doesn't need changing — it fetches all tasks from the API; grouping is client-side.

**Change 3** — The `AddTaskRow` `prefill` should include the dimension name so Oracle knows which dimension:

```tsx
detail: { prefill: `add ${dimension} task — ` }
```

---

## Part 9 — API: Quest Character Endpoint

`src/app/api/quests/character/[dimension]/route.ts` should already work since it queries by dimension string — confirm it doesn't have a union type guard that would reject new dimensions. If it does, update the type assertion to allow all 7.

---

## Part 10 — Specialist Agents (confirm wiring)

The multi-agent system in `src/lib/agents/specialists.ts` already has all 7 specialists built. Confirm the `consultArc()` function in `src/lib/agents/arc.ts` calls the vitality, mind, love, and family specialists and that their `memoryId` values match what the new `CHARACTERS` config specifies:

| Dimension | Expected `memoryId` |
|---|---|
| vitality | `'vitality'` |
| mind | `'mind'` |
| love | `'love'` |
| family | `'family'` |

If `consultArc` uses any hardcoded dimension list, update it to use `ALL_DIMENSIONS` from `src/lib/character.ts`.

---

## Part 11 — DimensionBars Component

`src/components/xp/DimensionBars.tsx` likely only renders career/social/wealth XP bars. Update it to render all 7 dimensions using `ALL_DIMENSIONS` and `CHARACTERS`.

---

## Acceptance Criteria

- [ ] `/blaze`, `/sage`, `/sol`, `/root` all load as full character pages with quests, milestones, and tasks
- [ ] Each new character page shows correct accent colour, character art, and tier labels
- [ ] Oracle correctly classifies "add vitality task — go for a run" with `dimension: "vitality"`
- [ ] Oracle correctly classifies "add mind task — finish the book" with `dimension: "mind"`
- [ ] Tasks page shows all 7 dimension sections (sections with no tasks show an AddTaskRow)
- [ ] Settings page at `/settings` is accessible from the dashboard hamburger icon
- [ ] User can select any 3 of 7 characters to pin; selection persists on reload
- [ ] Bottom nav shows the 3 pinned characters between Home and Tasks
- [ ] Long-pressing a nav character item navigates to `/settings?editSlot=N`
- [ ] `getPinnedDimensions()` falls back to `['career','social','wealth']` if localStorage is empty
- [ ] XP toasts and level-up toasts work on all 4 new character pages
- [ ] The Oura widget only shows on Blaze (vitality) page, not on mind/love/family pages

---

## Files to Create

```
src/app/blaze/page.tsx
src/app/sage/page.tsx
src/app/sol/page.tsx
src/app/root/page.tsx
src/app/settings/page.tsx
src/components/characters/BlazeCharacter.tsx
src/components/characters/SageCharacter.tsx
src/components/characters/SolCharacter.tsx
src/components/characters/RootCharacter.tsx
src/lib/pinnedDimensions.ts
```

## Files to Modify

```
src/lib/character.ts              — extend Dimension type + CHARACTERS
src/lib/tierName.ts               — add 4 new dimension slugs
src/components/CharacterPage.tsx  — support all 7 dimensions
src/components/characters/CharacterHeroArt.tsx — re-export new art
src/components/BottomNav.tsx      — dynamic pinned items + long-press
src/components/xp/DimensionBars.tsx — render all 7 bars
src/app/dashboard/page.tsx        — add settings hamburger icon
src/app/tasks/page.tsx            — all 7 dimensions
src/app/api/oracle/classify/route.ts — all 7 dimensions
src/app/api/quests/character/[dimension]/route.ts — remove dimension guard if any
src/lib/agents/arc.ts             — confirm all 7 specialists wired
```
