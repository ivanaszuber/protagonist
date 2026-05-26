import { NextResponse } from 'next/server'
import { slayBoss } from '@/lib/bosses'
import { checkAndAwardMedals, getEarnedMedalKeys } from '@/lib/medals'
import { getQuestDimensionXp, isQuestDbConfigured } from '@/lib/quest-db'
import { supabase } from '@/lib/supabase'
import type { Dimension } from '@/lib/character'

async function buildMedalContext(userId: string, dimension: Dimension) {
  const xp = await getQuestDimensionXp(userId, dimension)

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
  const { data: slainAfterEscape } = await supabase
    .from('boss_kills')
    .select('boss_name')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('outcome', 'slain')

  let bossesSlainAfterEscape = 0
  for (const row of slainAfterEscape ?? []) {
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

  return {
    userId,
    dimension,
    dimensionXp: xp,
    hasLegend: Boolean(quest?.vision?.trim()),
    tasksCompletedCount: taskCount ?? 0,
    bossesSlain: (slainKills ?? []).length + 1,
    bossesSlainAfterEscape,
    streakDays,
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const body = await request.json()
  const { userId } = body as { userId?: string }

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }
  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const result = await slayBoss(userId, id)
    const medalCtx = await buildMedalContext(userId, result.dimension as Dimension)
    const newMedals = await checkAndAwardMedals(medalCtx)
    const allMedals = await getEarnedMedalKeys(userId, result.dimension)

    return NextResponse.json({
      ...result,
      new_medals: newMedals,
      medals: allMedals,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to slay boss'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
