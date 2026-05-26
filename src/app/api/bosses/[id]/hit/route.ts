import { NextResponse } from 'next/server'
import { decrementBossHp } from '@/lib/bosses'
import { isQuestDbConfigured } from '@/lib/quest-db'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const body = await request.json()
  const { userId, hpDamage } = body as { userId?: string; hpDamage?: number }

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }
  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { data: boss } = await supabase
    .from('boss_battles')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!boss) {
    return NextResponse.json({ error: 'Boss not found' }, { status: 404 })
  }
  if (boss.status !== 'active') {
    return NextResponse.json({ error: 'Boss is not active' }, { status: 400 })
  }

  const damage = hpDamage ?? 1
  const { boss: updated, slain } = await decrementBossHp(id, damage)

  return NextResponse.json({
    boss: updated,
    slain,
    hp_remaining: updated?.hp_remaining ?? 0,
  })
}
