import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

/**
 * GET /api/dimension-score?userId=xxx
 * Returns { scores: Record<dimension, baseline_number> }
 *
 * PUT /api/dimension-score
 * Body: { userId, dimension, baseline }
 * Upserts a single dimension's baseline score.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('dimension_scores')
    .select('dimension, baseline')
    .eq('user_id', userId)

  if (error) {
    console.error('GET dimension-score error:', error)
    return NextResponse.json({ scores: {} })
  }

  const scores: Record<string, number> = {}
  for (const row of data ?? []) {
    scores[row.dimension as string] = row.baseline as number
  }

  return NextResponse.json({ scores })
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    userId?: string
    dimension?: string
    baseline?: number
  }
  const { userId, dimension, baseline } = body

  if (!userId || !dimension || baseline == null) {
    return NextResponse.json({ error: 'userId, dimension, baseline required' }, { status: 400 })
  }
  if (baseline < 1 || baseline > 10 || !Number.isInteger(baseline)) {
    return NextResponse.json({ error: 'baseline must be integer 1–10' }, { status: 400 })
  }

  const { error } = await supabase
    .from('dimension_scores')
    .upsert(
      { user_id: userId, dimension, baseline, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,dimension' }
    )

  if (error) {
    console.error('PUT dimension-score error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
