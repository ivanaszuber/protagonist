import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const limit = Number(searchParams.get('limit') ?? '30')
  const offset = Number(searchParams.get('offset') ?? '0')
  const dimension = searchParams.get('dimension') // optional filter

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ entries: [] })
  }

  // Fetch voice_notes
  let notesQuery = supabase
    .from('voice_notes')
    .select('id, content, oracle_reply, mood_signal, focus_list, brief, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (dimension) {
    // Filter notes that mention this dimension in focus_list
    // We can't easily filter JSON in supabase anonkey, so we fetch more and filter client-side
    // Instead, just fetch all and return - the client can filter
  }

  const { data: notes, error: notesError } = await notesQuery

  if (notesError) {
    return NextResponse.json({ error: notesError.message }, { status: 500 })
  }

  // Map to journal entries
  const entries = (notes ?? []).map((n) => {
    // Determine entry type
    const hasBrief = !!n.brief
    const focusList = (() => {
      try {
        if (typeof n.focus_list === 'string') return JSON.parse(n.focus_list) as { text: string; dimension: string; done: boolean }[]
        return (n.focus_list as { text: string; dimension: string; done: boolean }[] | null) ?? []
      } catch { return [] }
    })()

    const dimensions = [...new Set(focusList.map((f: { dimension: string }) => f.dimension).filter(Boolean))]

    let type: 'morning-checkin' | 'voice-reflection' | 'achievement'
    if (hasBrief) {
      type = 'morning-checkin'
    } else {
      type = 'voice-reflection'
    }

    return {
      id: n.id as string,
      type,
      content: n.content as string,
      oracleReply: n.oracle_reply as string | null,
      moodSignal: n.mood_signal as string | null,
      dimensions,
      brief: n.brief as string | null,
      createdAt: n.created_at as string,
    }
  })

  // Optionally filter by dimension
  const filtered = dimension
    ? entries.filter((e) => e.dimensions.includes(dimension))
    : entries

  // Also fetch recent completed tasks as achievement entries (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, dimension, xp_reward, task_date, created_at')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('task_date', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(50)

  const achievementEntries = (tasks ?? [])
    .filter((t) => !dimension || t.dimension === dimension)
    .map((t) => ({
      id: `task-${t.id as string}`,
      type: 'achievement' as const,
      content: t.title as string,
      oracleReply: null,
      moodSignal: null,
      dimensions: [t.dimension as string],
      brief: null,
      xpReward: t.xp_reward as number,
      createdAt: t.created_at as string,
    }))

  return NextResponse.json({
    entries: filtered,
    achievements: achievementEntries,
  })
}
