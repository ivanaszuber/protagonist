import {
  DimensionXPState,
  INITIAL_XP,
  DimensionId,
  Quest,
} from '@/types'

const XP_STORAGE_KEY = 'protagonist_dimension_xp'
const COMPLETED_QUESTS_KEY = 'protagonist_completed_quests'
const TODAYS_QUESTS_KEY = 'protagonist_todays_quests'
const QUEST_DATE_KEY = 'protagonist_quest_date'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function loadXP(): DimensionXPState {
  if (typeof window === 'undefined') return { ...INITIAL_XP }
  try {
    const stored = localStorage.getItem(XP_STORAGE_KEY)
    return stored ? { ...INITIAL_XP, ...JSON.parse(stored) } : { ...INITIAL_XP }
  } catch {
    return { ...INITIAL_XP }
  }
}

export function saveXP(xp: DimensionXPState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(XP_STORAGE_KEY, JSON.stringify(xp))
}

export function addXP(
  current: DimensionXPState,
  dimensionId: DimensionId,
  amount: number
): DimensionXPState {
  const updated = {
    ...current,
    [dimensionId]: (current[dimensionId] || 0) + amount,
  }
  saveXP(updated)
  return updated
}

export function getTotalXP(xp: DimensionXPState): number {
  return Object.values(xp).reduce((sum, v) => sum + v, 0)
}

export function getLevel(totalXP: number): number {
  return Math.floor(totalXP / 500) + 1
}

export function getXPToNextLevel(totalXP: number): { current: number; needed: number } {
  const xpInCurrentLevel = totalXP % 500
  return { current: xpInCurrentLevel, needed: 500 }
}

export function getDimensionLevel(xp: number): number {
  return Math.floor(xp / 200) + 1
}

export function getDimensionXPPercent(xp: number): number {
  const xpInLevel = xp % 200
  return Math.round((xpInLevel / 200) * 100)
}

export function loadCompletedQuests(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(COMPLETED_QUESTS_KEY)
    const questDate = localStorage.getItem(QUEST_DATE_KEY)
    if (questDate !== todayString()) return new Set()
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function saveCompletedQuest(questId: string): void {
  if (typeof window === 'undefined') return
  const existing = loadCompletedQuests()
  existing.add(questId)
  localStorage.setItem(COMPLETED_QUESTS_KEY, JSON.stringify([...existing]))
}

export function loadTodayQuests(): Quest[] {
  if (typeof window === 'undefined') return []
  try {
    const questDate = localStorage.getItem(QUEST_DATE_KEY)
    if (questDate !== todayString()) return []
    const stored = localStorage.getItem(TODAYS_QUESTS_KEY)
    return stored ? (JSON.parse(stored) as Quest[]) : []
  } catch {
    return []
  }
}

export function saveTodayQuests(quests: Quest[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TODAYS_QUESTS_KEY, JSON.stringify(quests))
  localStorage.setItem(QUEST_DATE_KEY, todayString())
}

export function clearTodayQuestProgress(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(COMPLETED_QUESTS_KEY)
  localStorage.removeItem(TODAYS_QUESTS_KEY)
}
