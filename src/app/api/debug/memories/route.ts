import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  // If userId provided, check that specific user
  if (userId) {
    const { data, error } = await supabase
      .from('dimension_memories')
      .select('id, dimension_id, content, source, importance, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message, userId }, { status: 500 })
    }

    return NextResponse.json({
      userId,
      count: data?.length ?? 0,
      memories: data ?? [],
    })
  }

  // No userId — return ALL recent memories across all users to find where data landed
  const { data, error } = await supabase
    .from('dimension_memories')
    .select('id, user_id, dimension_id, content, source, importance, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by user_id to show distinct users
  const byUser: Record<string, number> = {}
  for (const row of data ?? []) {
    byUser[row.user_id as string] = (byUser[row.user_id as string] ?? 0) + 1
  }

  return NextResponse.json({
    totalRecent: data?.length ?? 0,
    userBreakdown: byUser,
    mostRecent: (data ?? []).slice(0, 5).map(r => ({
      user_id: r.user_id,
      dimension_id: r.dimension_id,
      source: r.source,
      created_at: r.created_at,
      preview: (r.content as string).slice(0, 60),
    })),
  })
}
