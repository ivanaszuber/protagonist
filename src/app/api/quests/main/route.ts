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

  return NextResponse.json({ quests: enriched })
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
