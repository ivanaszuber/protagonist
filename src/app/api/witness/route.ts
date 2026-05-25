import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DIMENSION_LABELS: Record<string, string> = {
  vitality: 'Vitality',
  mind: 'Mind',
  create: 'Forge · Career',
  social: 'Echo · Social',
  love: 'Love',
  family: 'Family',
  wealth: 'Vault · Finances',
}

function parseWitnessJson(raw: string): { insight: string; primaryDimension: string | null } {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as { insight: string; primaryDimension: string | null }
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (match) {
      return JSON.parse(match[0]) as { insight: string; primaryDimension: string | null }
    }
    return { insight: trimmed, primaryDimension: null }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ insight: null }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ insight: null })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from('witness_insights')
    .select('*')
    .eq('user_id', userId)
    .gte('generated_at', sevenDaysAgo)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({
      insight: cached.insight,
      dimensionId: cached.dimension_id,
      memoryCount: cached.memory_count,
      generatedAt: cached.generated_at,
      cached: true,
    })
  }

  const { data: allMemories } = await supabase
    .from('dimension_memories')
    .select('dimension_id, content, created_at, importance')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (!allMemories || allMemories.length === 0) {
    return NextResponse.json({ insight: null, reason: 'no_memories' })
  }

  if (allMemories.length < 3) {
    return NextResponse.json({
      insight: null,
      reason: 'not_enough_memories',
      memoryCount: allMemories.length,
    })
  }

  const byDimension: Record<string, { content: string; date: string }[]> = {}
  for (const m of allMemories) {
    if (!byDimension[m.dimension_id]) byDimension[m.dimension_id] = []
    byDimension[m.dimension_id].push({
      content: m.content,
      date: m.created_at.split('T')[0],
    })
  }

  const memoryContext = Object.entries(byDimension)
    .map(([dim, mems]) => {
      const label = DIMENSION_LABELS[dim] ?? dim
      const lines = mems.map((mem) => `  [${mem.date}] ${mem.content}`).join('\n')
      return `${label}:\n${lines}`
    })
    .join('\n\n')

  const today = new Date().toISOString().split('T')[0]

  const prompt = `You are The Witness — a quiet, perceptive observer who has been watching this person's life across multiple dimensions for some time. You have access to everything their Oracle has noticed and remembered about them.

Today is ${today}. Here is everything you know:

${memoryContext}

Your task: write ONE sentence — or at most two — that surfaces a meaningful moment of growth, change, or pattern. 

Rules:
- Be SPECIFIC — reference actual things from the memories (dates, events, specific words they used)
- Contrast past vs present when possible: "A week ago X, now Y"
- If there's no clear contrast yet (early user), surface the most interesting pattern you see instead
- Never be generic ("you're doing great!") — that's worthless
- Never use: "journey", "growth mindset", "wellness", "self-care"
- Tone: warm, quiet, slightly awed — like a friend who has been paying close attention
- If the memories mention Zara (the user's daughter), treat those moments with extra tenderness
- Length: 1-2 sentences maximum. No more.

Respond with ONLY valid JSON:
{
  "insight": "the one or two sentence witness insight",
  "primaryDimension": "the dimension this insight is mainly about, or null if cross-dimensional"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const parsed = parseWitnessJson(raw)

    if (!parsed.insight) {
      return NextResponse.json({ insight: null, reason: 'generation_failed' })
    }

    await supabase.from('witness_insights').insert({
      user_id: userId,
      insight: parsed.insight,
      dimension_id: parsed.primaryDimension,
      memory_count: allMemories.length,
    })

    return NextResponse.json({
      insight: parsed.insight,
      dimensionId: parsed.primaryDimension,
      memoryCount: allMemories.length,
      cached: false,
    })
  } catch (error) {
    console.error('Witness error:', error)
    return NextResponse.json({ insight: null, reason: 'error' })
  }
}
