import { NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/api-user'
import { getActiveBoss, getBossTasks } from '@/lib/bosses'
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

export async function GET(request: Request) {
  const userId = await resolveUserId(request)
  const dimension = new URL(request.url).searchParams.get('dimension')

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!dimension || !VALID_DIMENSIONS.has(dimension)) {
    return NextResponse.json({ error: 'Invalid dimension' }, { status: 400 })
  }
  if (!isQuestDbConfigured()) {
    return NextResponse.json({ boss: null, tasks: [] })
  }

  const boss = await getActiveBoss(userId, dimension)
  if (!boss) {
    const { data: escapedBoss } = await supabase
      .from('boss_battles')
      .select('*')
      .eq('user_id', userId)
      .eq('dimension', dimension)
      .eq('status', 'escaped')
      .order('escaped_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return NextResponse.json({ boss: null, tasks: [], escapedBoss: escapedBoss ?? null })
  }

  const tasks = await getBossTasks(userId, boss.id)
  return NextResponse.json({ boss, tasks, escapedBoss: null })
}
