import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const dimensionId = searchParams.get('dimensionId')
  if (!userId || !dimensionId) return NextResponse.json({ error: 'userId and dimensionId required' }, { status: 400 })

  const { data } = await supabase
    .from('dimension_context')
    .select('data')
    .eq('user_id', userId)
    .eq('dimension_id', dimensionId)
    .maybeSingle()

  return NextResponse.json(data?.data ?? null)
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as { userId: string; dimensionId: string; data: Record<string, unknown> }
  const { userId, dimensionId, data } = body
  if (!userId || !dimensionId || !data) return NextResponse.json({ error: 'userId, dimensionId and data required' }, { status: 400 })

  const { data: saved, error } = await supabase
    .from('dimension_context')
    .upsert({ user_id: userId, dimension_id: dimensionId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,dimension_id' })
    .select('data')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(saved?.data ?? data)
}
