import { isQuestDbConfigured } from '@/lib/quest-db'
import { supabase } from '@/lib/supabase'
import type { Dimension } from '@/lib/character'
import { getLevel } from '@/lib/xp'

export interface MedalDefinition {
  key: string
  label: string
  hint: string
  icon: 'sword' | 'pulse' | 'skull' | 'flame' | 'star' | 'shield' | 'trophy'
}

export const MEDAL_DEFINITIONS: MedalDefinition[] = [
  { key: 'first_blood', label: 'First Task', hint: 'Complete your first task', icon: 'sword' },
  { key: 'on_a_roll', label: 'On a Roll', hint: '7-day task streak', icon: 'pulse' },
  { key: 'boss_slayer', label: 'First Victory', hint: 'Complete your first challenge', icon: 'star' },
  { key: 'relentless', label: 'Relentless', hint: 'Complete 3 challenges', icon: 'flame' },
  { key: 'legend_born', label: 'Legend Born', hint: 'Define your Legend', icon: 'trophy' },
  { key: 'comeback', label: 'Comeback', hint: 'Finish an abandoned challenge', icon: 'shield' },
  { key: 'veteran', label: 'Veteran', hint: 'Reach Level 10', icon: 'pulse' },
]

export interface MedalCheckContext {
  userId: string
  dimension: Dimension
  dimensionXp: number
  hasLegend: boolean
  tasksCompletedCount: number
  bossesSlain: number
  bossesSlainAfterEscape: number
  streakDays: number
}

export async function getEarnedMedalKeys(
  userId: string,
  dimension: string
): Promise<string[]> {
  if (!isQuestDbConfigured()) return []
  const { data } = await supabase
    .from('medals')
    .select('medal_key')
    .eq('user_id', userId)
    .eq('dimension', dimension)
  return (data ?? []).map((r) => r.medal_key as string)
}

export async function awardMedal(
  userId: string,
  dimension: string,
  medalKey: string
): Promise<boolean> {
  if (!isQuestDbConfigured()) return false
  const { error } = await supabase.from('medals').insert({
    user_id: userId,
    dimension,
    medal_key: medalKey,
  })
  return !error
}

export async function checkAndAwardMedals(
  ctx: MedalCheckContext
): Promise<string[]> {
  const earned = await getEarnedMedalKeys(ctx.userId, ctx.dimension)
  const newlyEarned: string[] = []

  const tryAward = async (key: string, condition: boolean) => {
    if (!condition || earned.includes(key) || newlyEarned.includes(key)) return
    const ok = await awardMedal(ctx.userId, ctx.dimension, key)
    if (ok) newlyEarned.push(key)
  }

  await tryAward('first_blood', ctx.tasksCompletedCount >= 1)
  await tryAward('on_a_roll', ctx.streakDays >= 7)
  await tryAward('boss_slayer', ctx.bossesSlain >= 1)
  await tryAward('relentless', ctx.bossesSlain >= 3)
  await tryAward('legend_born', ctx.hasLegend)
  await tryAward('comeback', ctx.bossesSlainAfterEscape >= 1)
  await tryAward('veteran', getLevel(ctx.dimensionXp) >= 10)

  return newlyEarned
}
