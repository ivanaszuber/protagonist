import { NextResponse } from 'next/server'
import { isQuestDbConfigured } from '@/lib/quest-db'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const body = await request.json()
  const { userId, questId, title, targetDate } = body

  if (!userId || !questId || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { data, error } = await supabase
    .from('milestones')
    .insert({
      quest_id: questId,
      user_id: userId,
      title,
      target_date: targetDate ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ milestone: data })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const milestoneId = searchParams.get('milestoneId')
  const userId = searchParams.get('userId')

  if (!milestoneId || !userId) {
    return NextResponse.json({ error: 'milestoneId and userId required' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { error } = await supabase
    .from('milestones')
    .delete()
    .eq('id', milestoneId)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const { milestoneId, completed } = body

  if (!milestoneId || typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { data, error } = await supabase
    .from('milestones')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', milestoneId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ milestone: data })
}
