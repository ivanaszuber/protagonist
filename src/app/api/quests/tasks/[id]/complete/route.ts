import { NextResponse } from 'next/server'
import { decrementBossHp, slayBoss } from '@/lib/bosses'
import { addQuestDimensionXp, isQuestDbConfigured } from '@/lib/quest-db'
import { saveDimensionMemory } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const body = await request.json()
  const { userId } = body

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  if (task.completed) {
    return NextResponse.json({ error: 'Already completed' }, { status: 400 })
  }

  const xpEarned = task.xp_reward ?? 50

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await supabase.from('xp_log').insert({
    user_id: userId,
    dimension: task.dimension,
    xp_amount: xpEarned,
    source: 'task',
    source_id: task.id,
  })

  const { totalXp, leveledUp, newLevel } = await addQuestDimensionXp(
    userId,
    task.dimension,
    xpEarned
  )

  // Passive memory: write on every 5th task completed in this dimension today
  try {
    const todayStr = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('dimension', task.dimension)
      .eq('completed', true)
      .gte('completed_at', `${todayStr}T00:00:00.000Z`)

    const completedToday = (count ?? 0) // includes the one we just completed
    if (completedToday > 0 && completedToday % 5 === 0) {
      const memory = `[${todayStr}] Completed ${completedToday} tasks in ${task.dimension} today — including "${task.title}".`
      void saveDimensionMemory(task.dimension, memory, 'task_milestone', 6, userId)
    }
  } catch {
    // non-critical — don't fail the response
  }

  let bossHit: {
    boss_id: string
    hp_remaining: number
    slain: boolean
    reward_xp?: number
  } | null = null

  if (task.boss_battle_id) {
    const damage = (task.hp_damage as number) ?? 1
    const { boss: updatedBoss, slain } = await decrementBossHp(
      task.boss_battle_id as string,
      damage
    )
    if (updatedBoss) {
      bossHit = {
        boss_id: updatedBoss.id,
        hp_remaining: updatedBoss.hp_remaining,
        slain,
      }
      if (slain) {
        const slayResult = await slayBoss(userId, updatedBoss.id)
        bossHit.reward_xp = slayResult.rewardXp
      }
    }
  }

  return NextResponse.json({
    xp_earned: xpEarned,
    total_xp: totalXp,
    leveled_up: leveledUp,
    new_level: newLevel,
    boss: bossHit,
  })
}
