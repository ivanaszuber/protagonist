import { NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS !== 'true') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { userId } = (await request.json()) as { userId?: string }
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]
  const startOfDay = `${today}T00:00:00.000Z`

  await supabaseAdmin
    .from('voice_notes')
    .delete()
    .eq('user_id', userId)
    .gte('created_at', startOfDay)

  await supabaseAdmin
    .from('mood_logs')
    .delete()
    .eq('user_id', userId)
    .gte('created_at', startOfDay)

  const moodEntriesResult = await supabaseAdmin
    .from('mood_entries')
    .delete()
    .eq('user_id', userId)
    .gte('created_at', startOfDay)

  if (moodEntriesResult.error) {
    /* table may not exist or other non-fatal issue */
  }

  return NextResponse.json({ ok: true })
}
