import { NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/api-user'
import { getBossKillStats } from '@/lib/bosses'
import { isQuestDbConfigured, QUEST_XP_TABLE } from '@/lib/quest-db'
import { computeDimensionStreak } from '@/lib/streak'
import { supabase } from '@/lib/supabase'

const VALID_DIMENSIONS = new Set([
  'career',
  'social',
  'wealth',
  'vitality',
  'mind',
  'love',
  'family',
])

export async function GET(
  request: Request,
  context: { params: Promise<{ dimension: string }> }
) {
  const { dimension } = await context.params
  const userId = await resolveUserId(request)

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!VALID_DIMENSIONS.has(dimension)) {
    return NextResponse.json({ error: 'Invalid dimension' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ quest: null })
  }

  const { data: quest, error: questError } = await supabase
    .from('main_quests')
    .select('*')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('active', true)
    .maybeSingle()

  if (questError) {
    return NextResponse.json({ error: questError.message }, { status: 500 })
  }

  if (!quest) {
    return NextResponse.json({ quest: null })
  }

  const { data: milestones } = await supabase
    .from('milestones')
    .select('*')
    .eq('quest_id', quest.id)
    .order('sort_order', { ascending: true })

  const milestoneIds = (milestones ?? []).map((m) => m.id)
  const { data: milestoneTasks } =
    milestoneIds.length > 0
      ? await supabase
          .from('tasks')
          .select('milestone_id, completed')
          .in('milestone_id', milestoneIds)
      : { data: [] }

  const taskStatsByMilestone = new Map<string, { total: number; done: number }>()
  for (const t of milestoneTasks ?? []) {
    const mid = t.milestone_id as string
    if (!mid) continue
    const cur = taskStatsByMilestone.get(mid) ?? { total: 0, done: 0 }
    cur.total++
    if (t.completed) cur.done++
    taskStatsByMilestone.set(mid, cur)
  }

  const bossStats = await getBossKillStats(userId, dimension)

  const enrichedMilestones = (milestones ?? []).map((m, idx) => {
    const stats = taskStatsByMilestone.get(m.id) ?? { total: 0, done: 0 }
    let progress =
      stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
    // If this milestone has no direct tasks, infer progress from boss kills
    // (each completed challenge counts as ~33%, so 3 conquests = 100%)
    if (stats.total === 0 && idx === 0) {
      progress = Math.min(bossStats.slain * 33, 100)
    }
    return { ...m, progress_percent: progress, task_total: stats.total }
  })
  const streak_days = await computeDimensionStreak(userId, dimension)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const since = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .gte('task_date', since)
    .order('task_date', { ascending: false })
    .order('created_at', { ascending: false })

  const { data: xpRow } = await supabase
    .from(QUEST_XP_TABLE)
    .select('xp')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .maybeSingle()

  let computedXp = (xpRow?.xp as number) ?? 0

  // Fallback: if quest_dimension_xp has no entry (or 0), sum from xp_log
  // This handles users who completed tasks before quest_dimension_xp was wired up
  if (computedXp === 0) {
    const { data: logRows } = await supabase
      .from('xp_log')
      .select('xp_amount')
      .eq('user_id', userId)
      .eq('dimension', dimension)
    const logTotal = (logRows ?? []).reduce(
      (sum: number, r: { xp_amount: number }) => sum + ((r.xp_amount as number) ?? 0),
      0
    )
    // Also add boss kill XP from boss_kills table (not in xp_log)
    const { data: bossKillRows } = await supabase
      .from('boss_kills')
      .select('xp_awarded')
      .eq('user_id', userId)
      .eq('dimension', dimension)
      .eq('outcome', 'slain')
    const bossXp = (bossKillRows ?? []).reduce(
      (sum: number, r: { xp_awarded: number }) => sum + ((r.xp_awarded as number) ?? 0),
      0
    )
    // Also sum reward_xp from slain boss_battles not in boss_kills (legacy)
    const { data: legacyBosses } = await supabase
      .from('boss_battles')
      .select('reward_xp, id')
      .eq('user_id', userId)
      .eq('dimension', dimension)
      .eq('status', 'slain')
    const bossKillIds = new Set((bossKillRows ?? []).map((r: { xp_awarded: number } & { boss_battle_id?: string }) => (r as unknown as { boss_battle_id?: string }).boss_battle_id).filter(Boolean))
    const legacyBossXp = (legacyBosses ?? []).reduce(
      (sum: number, r: { reward_xp: number; id: string }) =>
        bossKillIds.has(r.id) ? sum : sum + ((r.reward_xp as number) ?? 0),
      0
    )
    const totalFromLogs = logTotal + bossXp + legacyBossXp
    if (totalFromLogs > 0) {
      computedXp = totalFromLogs
      // Backfill quest_dimension_xp so future reads are fast
      void supabase.from(QUEST_XP_TABLE).upsert(
        {
          user_id: userId,
          dimension,
          xp: totalFromLogs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,dimension' }
      )
    }
  }

  return NextResponse.json({
    quest: {
      ...quest,
      milestones: enrichedMilestones,
      recent_tasks: tasks ?? [],
      xp: computedXp,
      bosses_slain: bossStats.slain,
      streak_days,
    },
  })
}
