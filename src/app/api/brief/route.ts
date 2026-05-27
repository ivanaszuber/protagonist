import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isQuestDbConfigured } from '@/lib/quest-db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]
  const startOfDay = `${today}T00:00:00.000Z`
  const endOfDay = `${today}T23:59:59.999Z`

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [todayNoteRes, todayTasksRes, historyRes] = await Promise.all([
    // Today's morning check-in brief (must have focus_list)
    supabase
      .from('voice_notes')
      .select('id, oracle_reply, mood_signal, focus_list, suggestions, calendar_matches, created_at')
      .eq('user_id', userId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .not('focus_list', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // All tasks for today
    isQuestDbConfigured()
      ? supabase
          .from('tasks')
          .select('id, title, dimension, xp_reward, completed, task_date')
          .eq('user_id', userId)
          .eq('task_date', today)
          .order('created_at')
      : Promise.resolve({ data: [] }),

    // Past briefs (up to 7 days back, excluding today)
    supabase
      .from('voice_notes')
      .select('id, oracle_reply, focus_list, created_at')
      .eq('user_id', userId)
      .lt('created_at', startOfDay)
      .gte('created_at', sevenDaysAgo.toISOString())
      .not('focus_list', 'is', null)
      .order('created_at', { ascending: false }),
  ])

  const todayNote = todayNoteRes.data
  const todayTasks = todayTasksRes.data ?? []
  const historyNotes = historyRes.data ?? []

  return NextResponse.json({
    today: todayNote
      ? { ...todayNote, tasks: todayTasks }
      : null,
    history: historyNotes.map((note) => {
      const focusList = (note.focus_list as Array<{ done?: boolean }>) ?? []
      return {
        id: note.id,
        oracle_message: note.oracle_reply as string | null,
        focus_list: note.focus_list,
        created_at: note.created_at,
        tasks_done: focusList.filter((f) => f.done).length,
        total_focus: focusList.length,
      }
    }),
  })
}
