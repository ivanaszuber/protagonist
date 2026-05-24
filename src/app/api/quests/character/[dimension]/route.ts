import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isQuestDbConfigured, QUEST_XP_TABLE } from '@/lib/quest-db'
import { supabase } from '@/lib/supabase'

const VALID_DIMENSIONS = new Set(['career', 'social', 'wealth'])

async function resolveUserId(request: Request): Promise<string | null> {
  const fromQuery = new URL(request.url).searchParams.get('userId')
  if (fromQuery) return fromQuery
  const cookieStore = await cookies()
  return cookieStore.get('protagonist_user_id')?.value ?? null
}

export async function GET(
  request: Request,
  context: { params: Promise<{ dimension: string }> }
) {
  const { dimension } = await context.params
  const userId = await resolveUserId(request)

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!VALID_DIMENSIONS.has(dimension)) {
    return NextResponse.json({ error: 'Invalid dimension' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ quest: null })
  }

  const { data: quest, error: questError } = await supabase
    .from('main_quests')
    .select('*')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('active', true)
    .maybeSingle()

  if (questError) {
    return NextResponse.json({ error: questError.message }, { status: 500 })
  }

  if (!quest) {
    return NextResponse.json({ quest: null })
  }

  const { data: milestones } = await supabase
    .from('milestones')
    .select('*')
    .eq('quest_id', quest.id)
    .order('sort_order', { ascending: true })

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const since = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .gte('task_date', since)
    .order('task_date', { ascending: false })
    .order('created_at', { ascending: false })

  const { data: xpRow } = await supabase
    .from(QUEST_XP_TABLE)
    .select('xp')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .maybeSingle()

  return NextResponse.json({
    quest: {
      ...quest,
      milestones: milestones ?? [],
      recent_tasks: tasks ?? [],
      xp: xpRow?.xp ?? 0,
    },
  })
}
