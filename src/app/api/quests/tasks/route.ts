import { NextResponse } from 'next/server'
import { isQuestDbConfigured } from '@/lib/quest-db'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const date = searchParams.get('date')
  const someday = searchParams.get('someday') === 'true'
  const dimension = searchParams.get('dimension')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ tasks: [] })
  }

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (someday) {
    query = query.is('task_date', null)
  } else if (date) {
    query = query.eq('task_date', date)
  }

  if (dimension) {
    query = query.eq('dimension', dimension)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tasks: data ?? [] })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')
  const userId = searchParams.get('userId')

  if (!taskId || !userId) {
    return NextResponse.json({ error: 'taskId and userId required' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { userId, dimension, title, xpReward = 50, taskDate, milestoneId } = body

  if (!userId || !dimension || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const resolvedDate =
    taskDate === undefined || taskDate === ''
      ? null
      : taskDate

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      dimension,
      title,
      xp_reward: xpReward,
      task_date: resolvedDate,
      milestone_id: milestoneId ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ task: data })
}
