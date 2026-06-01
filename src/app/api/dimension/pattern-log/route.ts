import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const dimensionId = searchParams.get('dimensionId')
  if (!userId || !dimensionId) return NextResponse.json({ error: 'userId and dimensionId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('dimension_pattern_log')
    .select('*')
    .eq('user_id', userId)
    .eq('dimension_id', dimensionId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { userId: string; dimensionId: string; type: 'win' | 'shift' | 'hard'; text: string }
  const { userId, dimensionId, type, text } = body
  if (!userId || !dimensionId || !type || !text) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  if (!['win', 'shift', 'hard'].includes(type)) return NextResponse.json({ error: 'invalid type' }, { status: 400 })

  const { data, error } = await supabase
    .from('dimension_pattern_log')
    .insert({ user_id: userId, dimension_id: dimensionId, type, text })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('dimension_pattern_log').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
