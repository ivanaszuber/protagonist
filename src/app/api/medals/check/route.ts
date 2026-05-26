import { NextResponse } from 'next/server'
import {
  checkAndAwardMedals,
  getEarnedMedalKeys,
  runVaultMedalCheck,
} from '@/lib/medals'
import { getQuestDimensionXp, isQuestDbConfigured } from '@/lib/quest-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Dimension } from '@/lib/character'

const VALID_DIMENSIONS = new Set([
  'career',
  'social',
  'wealth',
  'vitality',
  'mind',
  'love',
  'family',
])

export async function POST(request: Request) {
  const body = await request.json()
  const { userId, dimension } = body as { userId?: string; dimension?: string }

  if (!userId || !dimension) {
    return NextResponse.json({ error: 'userId and dimension required' }, { status: 400 })
  }
  if (!VALID_DIMENSIONS.has(dimension)) {
    return NextResponse.json({ error: 'Invalid dimension' }, { status: 400 })
  }
  if (!isQuestDbConfigured()) {
    return NextResponse.json({ earned: [], new_medals: [] })
  }

  const dim = dimension as Dimension
  const xp = await getQuestDimensionXp(userId, dim)

  const { data: quest } = await supabase
    .from('main_quests')
    .select('vision')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .maybeSingle()

  const { count: taskCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('completed', true)

  const { data: slainKills } = await supabase
    .from('boss_kills')
    .select('id')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('outcome', 'slain')

  const { data: escapedNames } = await supabase
    .from('boss_kills')
    .select('boss_name')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('outcome', 'escaped')

  const escapedSet = new Set((escapedNames ?? []).map((r) => r.boss_name as string))
  const { data: slainRows } = await supabase
    .from('boss_kills')
    .select('boss_name')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('outcome', 'slain')

  let bossesSlainAfterEscape = 0
  for (const row of slainRows ?? []) {
    if (escapedSet.has(row.boss_name as string)) bossesSlainAfterEscape++
  }

  const { data: recentTasks } = await supabase
    .from('tasks')
    .select('task_date')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('completed', true)
    .order('task_date', { ascending: false })
    .limit(30)

  let streakDays = 0
  const dates = new Set(
    (recentTasks ?? []).map((t) => t.task_date as string).filter(Boolean)
  )
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if (dates.has(key)) streakDays++
    else break
  }

  const allNewMedals: string[] = []

  const genericNew = await checkAndAwardMedals({
    userId,
    dimension: dim,
    dimensionXp: xp,
    hasLegend: Boolean(quest?.vision?.trim()),
    tasksCompletedCount: taskCount ?? 0,
    bossesSlain: (slainKills ?? []).length,
    bossesSlainAfterEscape,
    streakDays,
  })
  allNewMedals.push(...genericNew)

  if (dimension === 'wealth' && isSupabaseConfigured()) {
    const { data: vaultSettings } = await supabase
      .from('vault_settings')
      .select('invested, cash, nw_goal, shadow_gap, monthly_income')
      .eq('user_id', userId)
      .maybeSingle()

    if (vaultSettings) {
      const vaultNewlyEarned = await runVaultMedalCheck(
        userId,
        vaultSettings,
        Number(vaultSettings.shadow_gap) || 0,
        {
          hasLegend: Boolean(quest?.vision?.trim()),
          tasksCompletedCount: taskCount ?? 0,
          bossesSlain: (slainKills ?? []).length,
        }
      )
      allNewMedals.push(...vaultNewlyEarned)
    }
  }

  const earned = await getEarnedMedalKeys(userId, dimension)

  return NextResponse.json({ earned, new_medals: allNewMedals })
}
