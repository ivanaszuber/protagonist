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

  const enrichedMilestones = (milestones ?? []).map((m) => {
    const stats = taskStatsByMilestone.get(m.id) ?? { total: 0, done: 0 }
    const progress =
      stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
    return { ...m, progress_percent: progress, task_total: stats.total }
  })

  const bossStats = await getBossKillStats(userId, dimension)
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

  return NextResponse.json({
    quest: {
      ...quest,
      milestones: enrichedMilestones,
      recent_tasks: tasks ?? [],
      xp: xpRow?.xp ?? 0,
      bosses_slain: bossStats.slain,
      streak_days,
    },
  })
}
