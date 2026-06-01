import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase'

const client = new Anthropic()

const SEED_PROMPTS: Record<string, string> = {
  love: 'Generate 3 thoughtful, open-ended conversation starter questions for a romantic partnership. These should spark genuine connection and self-reflection between partners. Not therapy questions — real, warm, curious questions two people in love might ask each other.',
  vitality: 'Generate 3 reflective questions someone might journal about or discuss with a coach about their physical health, energy, and wellbeing. Practical, not clinical.',
  mind: 'Generate 3 introspective questions about mental clarity, focus, emotional patterns, or mindset. Sharp, not self-help clichés.',
  career: 'Generate 3 questions about work, purpose, career direction, and professional identity. Honest, not motivational poster material.',
  social: 'Generate 3 questions about friendships, social energy, connection, and belonging. Warm and grounded.',
  wealth: 'Generate 3 questions about one\'s relationship with money, financial values, and long-term security. Practical and real.',
  family: 'Generate 3 questions about family dynamics, parenting, and intergenerational patterns. Specific and honest.',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const dimensionId = searchParams.get('dimensionId')
  const refresh = searchParams.get('refresh') === 'true'
  if (!userId || !dimensionId) return NextResponse.json({ error: 'userId and dimensionId required' }, { status: 400 })

  // Return cached if not refreshing and cache is < 24h old
  if (!refresh) {
    const { data: cached } = await supabase
      .from('dimension_conversation_seeds')
      .select('seeds, generated_at')
      .eq('user_id', userId)
      .eq('dimension_id', dimensionId)
      .maybeSingle()

    if (cached && cached.seeds) {
      const age = Date.now() - new Date(cached.generated_at as string).getTime()
      if (age < 24 * 60 * 60 * 1000) {
        return NextResponse.json({ seeds: cached.seeds, cached: true })
      }
    }
  }

  // Fetch dimension memories for context
  const { data: memories } = await supabase
    .from('dimension_memories')
    .select('content')
    .eq('user_id', userId)
    .eq('dimension_id', dimensionId)
    .order('importance', { ascending: false })
    .limit(5)

  const memoryContext = memories && memories.length > 0
    ? `\n\nContext about this person's ${dimensionId} life:\n${memories.map(m => `- ${m.content}`).join('\n')}`
    : ''

  const basePrompt = SEED_PROMPTS[dimensionId] ?? SEED_PROMPTS.love
  const prompt = `${basePrompt}${memoryContext}

Return ONLY a JSON array of 3 strings. No markdown, no explanation:
["Question one?", "Question two?", "Question three?"]`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '[]'
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array')
    const seeds = JSON.parse(match[0]) as string[]

    // Cache
    await supabase
      .from('dimension_conversation_seeds')
      .upsert({ user_id: userId, dimension_id: dimensionId, seeds, generated_at: new Date().toISOString() }, { onConflict: 'user_id,dimension_id' })

    return NextResponse.json({ seeds, cached: false })
  } catch {
    return NextResponse.json({
      seeds: [
        'What would the best version of your relationship look like right now?',
        'Is there something you\'ve been carrying that you haven\'t said out loud yet?',
        'What\'s one thing you appreciate about your partner that you rarely say?',
      ],
      cached: false,
    })
  }
}
