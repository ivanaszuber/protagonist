import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const { userId, content, oracleReply } = await request.json()

  if (!userId || !content) {
    return NextResponse.json({ error: 'userId and content required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('voice_notes')
    .insert({ user_id: userId, content, oracle_reply: oracleReply ?? null })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ note: data })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const limit = Number(searchParams.get('limit') ?? '20')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('voice_notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notes: data ?? [] })
}
