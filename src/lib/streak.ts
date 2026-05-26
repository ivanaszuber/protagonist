import { supabase } from '@/lib/supabase'
import { isQuestDbConfigured } from '@/lib/quest-db'

/** Consecutive days with at least one completed task ending today (or yesterday if none today). */
export async function computeDimensionStreak(
  userId: string,
  dimension: string
): Promise<number> {
  if (!isQuestDbConfigured()) return 0

  const { data: recentTasks } = await supabase
    .from('tasks')
    .select('task_date')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('completed', true)
    .not('task_date', 'is', null)
    .order('task_date', { ascending: false })
    .limit(60)

  const dates = new Set(
    (recentTasks ?? []).map((t) => t.task_date as string).filter(Boolean)
  )
  if (dates.size === 0) return 0

  let streak = 0
  const today = new Date()
  for (let i = 0; i < 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if (dates.has(key)) streak++
    else break
  }
  return streak
}
