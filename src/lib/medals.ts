import { isQuestDbConfigured } from '@/lib/quest-db'
import { supabase } from '@/lib/supabase'
import type { Dimension } from '@/lib/character'
import { getLevel } from '@/lib/xp'

export interface MedalDefinition {
  key: string
  label: string
  hint: string
  icon: 'sword' | 'pulse' | 'skull' | 'flame' | 'star' | 'shield' | 'trophy' | 'coin'
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

export const MEDAL_DEFINITIONS_BY_DIMENSION: Record<string, MedalDefinition[]> = {
  wealth: VAULT_MEDAL_DEFINITIONS,
}

export function getMedalDefinitions(dimension: string): MedalDefinition[] {
  return MEDAL_DEFINITIONS_BY_DIMENSION[dimension] ?? MEDAL_DEFINITIONS
}

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

export interface VaultMedalCheckContext {
  userId: string
  invested: number
  cash: number
  nwGoal: number
  shadowGap: number
  shadowGapPrev: number
  hasLegend: boolean
  tasksCompletedCount: number
  bossesSlain: number
  totalNetWorth: number
  monthlyIncome: number
}

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

  await tryAward('vault_legend_born', ctx.hasLegend)
  await tryAward('vault_first_task', ctx.tasksCompletedCount >= 1)
  await tryAward('vault_first_challenge', ctx.bossesSlain >= 1)
  await tryAward('vault_relentless', ctx.bossesSlain >= 3)
  await tryAward(
    'vault_shadow_positive',
    ctx.shadowGap <= 0 && ctx.totalNetWorth > 0
  )
  await tryAward(
    'vault_slip_recovery',
    ctx.shadowGapPrev > 0 && ctx.shadowGap <= 0
  )
  await tryAward('vault_emergency_fund', ctx.cash >= ctx.monthlyIncome * 3)
  await tryAward('vault_investor', ctx.invested >= 50_000)
  await tryAward('vault_six_figures', ctx.totalNetWorth >= 100_000)
  await tryAward('vault_goal_reached', ctx.totalNetWorth >= ctx.nwGoal && ctx.nwGoal > 0)

  return newlyEarned
}

function vaultNum(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function fetchVaultMedalQuestStats(
  userId: string
): Promise<{
  hasLegend: boolean
  tasksCompletedCount: number
  bossesSlain: number
}> {
  if (!isQuestDbConfigured()) {
    return { hasLegend: false, tasksCompletedCount: 0, bossesSlain: 0 }
  }

  const [{ data: quest }, { count: taskCount }, { count: killCount }] = await Promise.all([
    supabase
      .from('main_quests')
      .select('vision')
      .eq('user_id', userId)
      .eq('dimension', 'wealth')
      .maybeSingle(),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('dimension', 'wealth')
      .eq('completed', true),
    supabase
      .from('boss_kills')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('dimension', 'wealth')
      .eq('outcome', 'slain'),
  ])

  return {
    hasLegend: Boolean(quest?.vision?.trim()),
    tasksCompletedCount: taskCount ?? 0,
    bossesSlain: killCount ?? 0,
  }
}

export async function runVaultMedalCheck(
  userId: string,
  vaultRow: {
    invested: unknown
    cash: unknown
    nw_goal: unknown
    shadow_gap: unknown
    monthly_income: unknown
  },
  shadowGapPrev: number,
  questStats?: {
    hasLegend: boolean
    tasksCompletedCount: number
    bossesSlain: number
  }
): Promise<string[]> {
  const stats = questStats ?? (await fetchVaultMedalQuestStats(userId))
  const invested = vaultNum(vaultRow.invested)
  const cash = vaultNum(vaultRow.cash)

  return checkAndAwardVaultMedals({
    userId,
    invested,
    cash,
    nwGoal: vaultNum(vaultRow.nw_goal),
    shadowGap: vaultNum(vaultRow.shadow_gap),
    shadowGapPrev,
    hasLegend: stats.hasLegend,
    tasksCompletedCount: stats.tasksCompletedCount,
    bossesSlain: stats.bossesSlain,
    totalNetWorth: invested + cash,
    monthlyIncome: vaultNum(vaultRow.monthly_income),
  })
}
