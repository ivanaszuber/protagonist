import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { anthropic } from '@/lib/anthropic'

/** Generate a short plain-English summary of the conversation using Haiku */
async function generateBrief(content: string, oracleReply: string | null): Promise<string | null> {
  try {
    const context = oracleReply
      ? `User said: ${content}\n\nOracle replied: ${oracleReply}`
      : `User said: ${content}`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `Summarise this journal entry in ONE short sentence (10–15 words max). Write in first person present tense as if the user is describing it. Be specific about the actual topic — no vague generalities.\n\n${context}\n\nSummary (one sentence only):`,
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null
    // Strip any trailing quotes or punctuation artefacts
    return text ? text.replace(/^["']|["']$/g, '').trim() : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const { userId, content, oracleReply } = await request.json()

  if (!userId || !content) {
    return NextResponse.json({ error: 'userId and content required' }, { status: 400 })
  }

  // Generate brief in parallel with the DB insert — Haiku is fast (~300ms)
  const [insertResult, brief] = await Promise.all([
    supabase
      .from('voice_notes')
      .insert({ user_id: userId, content, oracle_reply: oracleReply ?? null })
      .select()
      .single(),
    generateBrief(content, oracleReply ?? null),
  ])

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message }, { status: 500 })
  }

  // Patch the brief back onto the row if we got one
  if (brief && insertResult.data?.id) {
    await supabase
      .from('voice_notes')
      .update({ brief })
      .eq('id', insertResult.data.id as string)
  }

  return NextResponse.json({ note: { ...insertResult.data, brief } })
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
