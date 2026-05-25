import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ hasCheckIn: false })

  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('check_ins')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ hasCheckIn: Boolean(data) })
}
