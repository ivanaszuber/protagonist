import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ hasCheckIn: false })

  const today = new Date().toISOString().split('T')[0]
  // voice_notes are written when Oracle processes any NOTE intent.
  // The morning check-in button prefills Oracle with a note, so any voice_note
  // created today counts as "checked in". This avoids needing a separate table.
  const startOfDay = `${today}T00:00:00.000Z`
  const endOfDay = `${today}T23:59:59.999Z`

  const { data } = await supabase
    .from('voice_notes')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ hasCheckIn: Boolean(data) })
}
