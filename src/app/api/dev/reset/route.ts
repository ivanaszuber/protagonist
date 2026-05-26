import { NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_RESET) {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { userId } = (await request.json()) as { userId?: string }
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  await supabaseAdmin.from('boss_kills').delete().eq('user_id', userId)
  await supabaseAdmin.from('boss_battles').delete().eq('user_id', userId)
  await supabaseAdmin.from('medals').delete().eq('user_id', userId)
  await supabaseAdmin.from('tasks').delete().eq('user_id', userId)
  await supabaseAdmin.from('milestones').delete().eq('user_id', userId)
  await supabaseAdmin.from('voice_notes').delete().eq('user_id', userId)
  await supabaseAdmin.from('mood_entries').delete().eq('user_id', userId)
  await supabaseAdmin.from('xp_log').delete().eq('user_id', userId)
  await supabaseAdmin.from('quest_dimension_xp').delete().eq('user_id', userId)
  await supabaseAdmin.from('main_quests').delete().eq('user_id', userId)

  return NextResponse.json({ ok: true, message: 'All user data reset' })
}
