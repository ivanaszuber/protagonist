import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ALL_DIMENSIONS } from '@/lib/character'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const { userId } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ portrait: null })
  }

  // Fetch all dimension memories
  const { data: memories } = await supabase
    .from('dimension_memories')
    .select('dimension_id, content, importance, created_at')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .limit(100)

  if (!memories || memories.length === 0) {
    return NextResponse.json({
      portrait: {
        summary: "Your story is just beginning. As you check in with Oracle, share your thoughts, complete challenges, and grow — Arc will weave your experiences into a living portrait of who you're becoming.",
        dimensions: {},
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // Group memories by dimension
  const byDimension: Record<string, string[]> = {}
  for (const dim of ALL_DIMENSIONS) {
    byDimension[dim] = []
  }
  for (const m of memories) {
    const dim = m.dimension_id as string
    if (byDimension[dim]) {
      byDimension[dim].push(m.content as string)
    }
  }

  const memoryContext = ALL_DIMENSIONS.map((dim) => {
    const dimMems = byDimension[dim]
    if (dimMems.length === 0) return null
    return `## ${dim.toUpperCase()}\n${dimMems.slice(0, 8).join('\n')}`
  }).filter(Boolean).join('\n\n')

  const prompt = `You are Arc, a wise and compassionate life coach AI. You have been observing ${userId}'s journey across all life dimensions. Based on the memories and experiences below, write a rich, insightful, and personal psychological portrait of this person.

The portrait should feel like it was written by someone who deeply knows this person — celebrating their growth, naming their patterns (both beautiful and challenging), and pointing toward their emerging self.

Write in second person ("You are...", "You tend to...", "You've been growing..."). Be warm, specific, and honest. Don't be generic. Reference actual themes from their memories.

Structure your response as JSON with these fields:
- "essence": 2-3 sentence core identity statement (who they fundamentally are)
- "strengths": array of 3 specific strength observations with evidence
- "patterns": array of 2-3 recurring patterns or themes (can include shadow patterns)
- "growth": 2-3 sentences on how they've evolved recently
- "calling": 1-2 sentences on what seems to be pulling them forward
- "dimensionInsights": object with 1-sentence insight for each dimension that has memories (use keys: career, social, wealth, vitality, mind, love, family)

Keep each field concise but meaningful. Total response should feel like a reading that resonates deeply.

MEMORIES:
${memoryContext}

Respond ONLY with valid JSON.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw.trim()) as Record<string, unknown>
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      parsed = match ? (JSON.parse(match[0]) as Record<string, unknown>) : {}
    }

    return NextResponse.json({
      portrait: {
        ...parsed,
        generatedAt: new Date().toISOString(),
        memoryCount: memories.length,
      }
    })
  } catch (error) {
    console.error('Portrait generation error:', error)
    return NextResponse.json({ error: 'Failed to generate portrait' }, { status: 500 })
  }
}
