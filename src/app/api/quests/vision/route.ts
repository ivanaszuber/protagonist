import { NextResponse } from 'next/server'
import { awardMedal } from '@/lib/medals'
import { isQuestDbConfigured } from '@/lib/quest-db'
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

export async function PATCH(request: Request) {
  const body = await request.json()
  const { userId, dimension, vision } = body as {
    userId?: string
    dimension?: string
    vision?: string
  }

  if (!userId || !dimension || vision === undefined) {
    return NextResponse.json({ error: 'userId, dimension, vision required' }, { status: 400 })
  }
  if (!VALID_DIMENSIONS.has(dimension)) {
    return NextResponse.json({ error: 'Invalid dimension' }, { status: 400 })
  }
  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { data, error } = await supabase
    .from('main_quests')
    .update({ vision: vision.trim() })
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Quest not found' }, { status: 404 })
  }

  if (vision.trim()) {
    await awardMedal(userId, dimension, 'legend_born')
  }

  return NextResponse.json({ quest: data })
}
