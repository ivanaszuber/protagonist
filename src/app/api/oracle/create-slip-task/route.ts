import { NextResponse } from 'next/server'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const RECOVERY_TASKS: Record<string, string> = {
  shopping:    'No impulse buys for 7 days',
  restaurants: 'Cook at home 5 times this week',
  going_out:   'No nights out for 5 days',
  beauty:      'Skip non-essential beauty purchases this week',
  other:       'Cut one non-essential spend this week',
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    userId?: string
    category?: string
    amount?: number
  }

  const { userId, category, amount } = body
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const title = RECOVERY_TASKS[category ?? 'other'] ?? 'Cut one non-essential spend this week'
  const today = new Date().toISOString().split('T')[0]

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, title })
  }

  const { error } = await supabase.from('tasks').insert({
    user_id: userId,
    dimension: 'wealth',
    title,
    description: amount
      ? `Recovery task after a £${Math.round(amount)} slip. Complete to get back on track.`
      : 'Recovery task to get back on track.',
    task_date: today,
    completed: false,
    xp_reward: 50,
    created_at: new Date().toISOString(),
  })

  if (error) {
    console.error('create-slip-task error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, title })
}
