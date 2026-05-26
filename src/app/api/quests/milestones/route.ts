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
  const { milestoneId, userId, completed, title, targetDate, is_focused } = body as {
    milestoneId?: string
    userId?: string
    completed?: boolean
    title?: string
    targetDate?: string | null
    is_focused?: boolean
  }

  if (!milestoneId) {
    return NextResponse.json({ error: 'milestoneId required' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  // --- Mark complete/incomplete ---
  if (typeof completed === 'boolean') {
    const { data, error } = await supabase
      .from('milestones')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', milestoneId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ milestone: data })
  }

  // --- Focus / unfocus ---
  if (typeof is_focused === 'boolean') {
    if (is_focused) {
      // Look up which quest this milestone belongs to
      const { data: ms } = await supabase
        .from('milestones')
        .select('quest_id')
        .eq('id', milestoneId)
        .single()

      if (ms?.quest_id) {
        // Unfocus all milestones in this quest first
        await supabase
          .from('milestones')
          .update({ is_focused: false })
          .eq('quest_id', ms.quest_id as string)
      }
    }

    const { data, error } = await supabase
      .from('milestones')
      .update({ is_focused })
      .eq('id', milestoneId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ milestone: data })
  }

  // --- Edit title / target date ---
  if (title !== undefined) {
    const updates: Record<string, unknown> = {}
    if (title !== undefined) updates.title = title.trim()
    if (targetDate !== undefined) updates.target_date = targetDate ?? null

    const { data, error } = await supabase
      .from('milestones')
      .update(updates)
      .eq('id', milestoneId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ milestone: data })
  }

  return NextResponse.json({ error: 'No valid operation provided' }, { status: 400 })
}
