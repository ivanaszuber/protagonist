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
    .upsert(
      {
        user_id: userId,
        dimension,
        vision: vision.trim(),
        character_name: dimension,
        character_class: 'Adventurer',
        active: true,
      },
      { onConflict: 'user_id,dimension' }
    )
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (vision.trim()) {
    await awardMedal(userId, dimension, 'legend_born')
  }

  return NextResponse.json({ quest: data })
}
