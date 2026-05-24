import { NextResponse } from 'next/server'
import { isQuestDbConfigured } from '@/lib/quest-db'
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

  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('task_date', today)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const quests = (data ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    description: '',
    dimension: task.dimension === 'career' ? 'create' : task.dimension,
    xp_reward: task.xp_reward ?? 50,
    completed: Boolean(task.completed),
  }))

  return NextResponse.json({ quests })
}
