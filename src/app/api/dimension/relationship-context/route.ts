import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('relationship_context')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? null)
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as {
    userId: string
    partnerName?: string
    partnerEmoji?: string
    togetherSince?: string
    livingSituation?: string
    relationshipStage?: string
    oracleNotes?: string
  }
  const { userId, partnerName, partnerEmoji, togetherSince, livingSituation, relationshipStage, oracleNotes } = body
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const payload = {
    user_id: userId,
    partner_name: partnerName,
    partner_emoji: partnerEmoji,
    together_since: togetherSince ?? null,
    living_situation: livingSituation,
    relationship_stage: relationshipStage,
    oracle_notes: oracleNotes,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('relationship_context')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
