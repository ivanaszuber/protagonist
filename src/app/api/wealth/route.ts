import { NextResponse } from 'next/server'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const DEFAULT_FIRE_GOAL = 150_000
const DEFAULT_FIRE_YEAR = 2028

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      net_worth: null,
      fire_goal: DEFAULT_FIRE_GOAL,
      fire_year: DEFAULT_FIRE_YEAR,
      total_resisted: 0,
      last_resist_item: null,
      last_resist_amount: null,
    })
  }

  const { data: netWorthRows } = await supabase
    .from('net_worth_entries')
    .select('amount, entry_date')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(1)

  const { data: resists } = await supabase
    .from('impulse_resists')
    .select('item_name, amount, entry_date')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })

  const netWorth = netWorthRows?.[0]?.amount ?? null
  const totalResisted =
    resists?.reduce((sum, row) => sum + (row.amount ?? 0), 0) ?? 0
  const lastResist = resists?.[0] ?? null

  return NextResponse.json({
    net_worth: netWorth,
    fire_goal: DEFAULT_FIRE_GOAL,
    fire_year: DEFAULT_FIRE_YEAR,
    total_resisted: Math.round(totalResisted),
    last_resist_item: lastResist?.item_name ?? null,
    last_resist_amount: lastResist?.amount ?? null,
  })
}
