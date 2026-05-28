import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase, isSupabaseConfigured } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface TraitPill {
  label: string
  color: 'blue' | 'green' | 'purple' | 'orange' | 'amber'
}

export interface DimensionInsight {
  dimension: string
  insight: string
  color: string
}

export interface IdentityData {
  chapterTitle: string
  essenceQuote: string
  strengths: TraitPill[]
  growthEdges: TraitPill[]
  dimensionInsights: DimensionInsight[]
  generatedAt: string
}

const DIM_COLORS: Record<string, string> = {
  career:   '#C4A8FF',
  social:   '#4DC4FF',
  wealth:   '#6EE7A4',
  vitality: '#FF9A5C',
  mind:     '#4DC4FF',
  love:     '#FF7A8A',
  family:   '#6EE7A4',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  // Fetch all dimension memories for this user
  const { data: memories, error } = await supabase
    .from('dimension_memories')
    .select('dimension_id, content, importance')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .limit(60)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!memories || memories.length === 0) {
    return NextResponse.json({ error: 'No memories found — import context first' }, { status: 404 })
  }

  // Format memories grouped by dimension
  const grouped: Record<string, string[]> = {}
  for (const m of memories) {
    const dim = m.dimension_id as string
    if (!grouped[dim]) grouped[dim] = []
    grouped[dim].push(m.content as string)
  }

  const memoriesText = Object.entries(grouped)
    .map(([dim, contents]) => `[${dim.toUpperCase()}]\n${contents.join('\n')}`)
    .join('\n\n')

  const prompt = `You are Arc, a perceptive life coach AI. Based on the memories below about a person named Ivana, synthesize a concise identity profile.

Output ONLY valid JSON matching this exact shape:

{
  "chapterTitle": "3-5 word evocative title for her current life chapter (e.g. 'The Reinvention', 'Building the Foundation')",
  "essenceQuote": "One powerful sentence capturing who she is right now — her core drive or defining quality. First person, present tense, 12-20 words.",
  "strengths": [
    { "label": "3-4 word trait", "color": "blue|green|purple|orange" }
  ],
  "growthEdges": [
    { "label": "3-4 word growth area", "color": "amber" }
  ],
  "dimensionInsights": [
    { "dimension": "career|social|wealth|vitality|mind|love|family", "insight": "One specific sentence about her in this dimension. Max 15 words.", "color": "#hex" }
  ]
}

Color guide for strengths:
- blue (#4DC4FF): cognitive traits (analytical, strategic, big-picture thinking, systems)
- green (#6EE7A4): achievement traits (high performer, results-driven, disciplined, resilient)
- purple (#C4A8FF): emotional/self-awareness traits (introspective, empathetic, authentic, sensitive)
- orange (#FF9A5C): drive/ambition traits (ambitious, builder, pioneer, bold)

growthEdges should ALWAYS use "amber" — these are growth areas, not flaws.

Rules:
- strengths: 5–8 pills, mix of colors
- growthEdges: 2–4 pills, all amber
- dimensionInsights: only include dimensions with actual memories, max 6
- Be specific about HER — no generic platitudes
- chapterTitle must feel meaningful, not generic like "Personal Growth"

MEMORIES:
${memoriesText}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse identity response' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0]) as Omit<IdentityData, 'generatedAt'>

    // Attach dimension hex colors to insights
    if (Array.isArray(parsed.dimensionInsights)) {
      parsed.dimensionInsights = parsed.dimensionInsights.map(d => ({
        ...d,
        color: DIM_COLORS[d.dimension] ?? '#C4A8FF',
      }))
    }

    const result: IdentityData = {
      ...parsed,
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[identity/synthesize] error:', err)
    return NextResponse.json({ error: 'Synthesis failed' }, { status: 500 })
  }
}
