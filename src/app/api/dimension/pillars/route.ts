import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const dimensionId = searchParams.get('dimensionId')
  if (!userId || !dimensionId) return NextResponse.json({ error: 'userId and dimensionId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('dimension_pillars')
    .select('*')
    .eq('user_id', userId)
    .eq('dimension_id', dimensionId)
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { userId: string; dimensionId: string; text: string; emoji?: string }
  const { userId, dimensionId, text, emoji } = body
  if (!userId || !dimensionId || !text) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  // get current max sort_order
  const { data: existing } = await supabase
    .from('dimension_pillars')
    .select('sort_order')
    .eq('user_id', userId)
    .eq('dimension_id', dimensionId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = ((existing?.[0]?.sort_order as number | undefined) ?? -1) + 1

  const { data, error } = await supabase
    .from('dimension_pillars')
    .insert({ user_id: userId, dimension_id: dimensionId, text, emoji: emoji ?? '⭐', sort_order: nextOrder })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id: string; text?: string; emoji?: string; sort_order?: number }
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('dimension_pillars')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('dimension_pillars').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
