import { NextResponse } from 'next/server'
import { isQuestDbConfigured } from '@/lib/quest-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!isQuestDbConfigured() || !isSupabaseConfigured()) {
    return NextResponse.json({ earned: {} })
  }

  const { data } = await supabase
    .from('medals')
    .select('dimension, medal_key')
    .eq('user_id', userId)

  // Group by dimension: { career: ['first_blood', ...], wealth: ['vault_legend_born', ...], ... }
  const earned: Record<string, string[]> = {}
  for (const row of data ?? []) {
    const dim = row.dimension as string
    const key = row.medal_key as string
    if (!earned[dim]) earned[dim] = []
    earned[dim].push(key)
  }

  return NextResponse.json({ earned })
}
