import { NextResponse } from 'next/server'
import { isQuestDbConfigured, QUEST_XP_TABLE } from '@/lib/quest-db'
import { computeDimensionStreak } from '@/lib/streak'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ quests: [] })
  }

  const { data: quests, error } = await supabase
    .from('main_quests')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const dateParam = searchParams.get('date')
  const today = dateParam ?? new Date().toISOString().split('T')[0]

  const enriched = await Promise.all(
    (quests ?? []).map(async (quest) => {
      const { data: milestones } = await supabase
        .from('milestones')
        .select('*')
        .eq('quest_id', quest.id)
        .eq('completed', false)
        .order('sort_order')
        .limit(1)

      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('dimension', quest.dimension)
        .eq('task_date', today)
        .order('created_at')

      const { data: xpRow } = await supabase
        .from(QUEST_XP_TABLE)
        .select('xp')
        .eq('user_id', userId)
        .eq('dimension', quest.dimension)
        .maybeSingle()

      const taskList = tasks ?? []
      const focusTask =
        taskList.find((task) => !task.completed) ?? taskList[0] ?? null

      const activeMilestone = milestones?.[0]
      const daysLeft = activeMilestone?.target_date
        ? Math.ceil(
            (new Date(activeMilestone.target_date).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        : 0

      const streak_days = await computeDimensionStreak(userId, quest.dimension as string)

      return {
        ...quest,
        streak_days,
        active_milestone: activeMilestone
          ? {
              id: activeMilestone.id,
              title: activeMilestone.title,
              target_date: activeMilestone.target_date,
              days_left: daysLeft,
            }
          : null,
        today_task: focusTask
          ? {
              id: focusTask.id,
              title: focusTask.title,
              completed: Boolean(focusTask.completed),
              xp_reward: focusTask.xp_reward ?? 50,
            }
          : null,
        todays_tasks: taskList,
        xp: xpRow?.xp ?? 0,
      }
    })
  )

  // Fetch XP for all 7 dimensions so the dashboard champion cards always
  // show the correct level even for dimensions without an active quest.
  const { data: allXpRows } = await supabase
    .from('quest_dimension_xp')
    .select('dimension, xp')
    .eq('user_id', userId)

  const dimXpMap: Record<string, number> = {}
  for (const row of allXpRows ?? []) {
    dimXpMap[row.dimension as string] = (row.xp as number) ?? 0
  }

  // For any dimension still at 0, fall back to xp_log + boss_kills (same logic
  // as /api/quests/character/[dimension]) and backfill quest_dimension_xp.
  const ALL_DIMS = ['career', 'social', 'wealth', 'vitality', 'mind', 'love', 'family']
  const zeroDims = ALL_DIMS.filter((d) => (dimXpMap[d] ?? 0) === 0)
  if (zeroDims.length > 0) {
    const [xpLogRes, bossKillRes, bossRes] = await Promise.all([
      supabase.from('xp_log').select('dimension, xp_amount').eq('user_id', userId).in('dimension', zeroDims),
      supabase.from('boss_kills').select('dimension, xp_awarded, boss_battle_id').eq('user_id', userId).eq('outcome', 'slain').in('dimension', zeroDims),
      supabase.from('boss_battles').select('dimension, reward_xp, id').eq('user_id', userId).eq('status', 'slain').in('dimension', zeroDims),
    ])

    const logByDim = new Map<string, number>()
    for (const r of xpLogRes.data ?? []) {
      const d = r.dimension as string
      logByDim.set(d, (logByDim.get(d) ?? 0) + ((r.xp_amount as number) ?? 0))
    }

    const bossKillByDim = new Map<string, number>()
    const bossKillBattleIds = new Set<string>()
    for (const r of bossKillRes.data ?? []) {
      const d = r.dimension as string
      bossKillByDim.set(d, (bossKillByDim.get(d) ?? 0) + ((r.xp_awarded as number) ?? 0))
      if (r.boss_battle_id) bossKillBattleIds.add(r.boss_battle_id as string)
    }

    const legacyByDim = new Map<string, number>()
    for (const r of bossRes.data ?? []) {
      if (!bossKillBattleIds.has(r.id as string)) {
        const d = r.dimension as string
        legacyByDim.set(d, (legacyByDim.get(d) ?? 0) + ((r.reward_xp as number) ?? 0))
      }
    }

    const upserts: Array<{ user_id: string; dimension: string; xp: number; updated_at: string }> = []
    for (const dim of zeroDims) {
      const total = (logByDim.get(dim) ?? 0) + (bossKillByDim.get(dim) ?? 0) + (legacyByDim.get(dim) ?? 0)
      if (total > 0) {
        dimXpMap[dim] = total
        upserts.push({ user_id: userId, dimension: dim, xp: total, updated_at: new Date().toISOString() })
      }
    }
    if (upserts.length > 0) {
      void supabase.from('quest_dimension_xp').upsert(upserts, { onConflict: 'user_id,dimension' })
    }
  }

  return NextResponse.json({ quests: enriched, dimXpMap })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { userId, dimension, character_name, character_class, vision } = body

  if (!userId || !dimension || !vision) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { data, error } = await supabase
    .from('main_quests')
    .upsert(
      {
        user_id: userId,
        dimension,
        character_name: character_name ?? dimension,
        character_class: character_class ?? 'Adventurer',
        vision,
        active: true,
      },
      { onConflict: 'user_id,dimension' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ quest: data })
}
