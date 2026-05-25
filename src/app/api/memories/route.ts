import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const dimension = searchParams.get('dimension')
  const limit = Number(searchParams.get('limit') ?? '5')

  if (!userId || !dimension) {
    return NextResponse.json({ memories: [] })
  }

  const { data, error } = await supabase
    .from('dimension_memories')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('dimension_id', dimension)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return NextResponse.json({ memories: [] })
  }

  const memories = data.map((row) => `[${row.created_at.split('T')[0]}] ${row.content}`)

  return NextResponse.json({ memories })
}
