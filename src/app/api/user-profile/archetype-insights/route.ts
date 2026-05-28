import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase, isSupabaseConfigured } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-haiku-4-5-20251001'

export interface ArchetypePill {
  label: string    // 3–6 words shown in the pill
  tooltip: string  // 1 sentence shown on hover
  color: string    // blue | green | purple | orange | amber
}

export interface ArchetypeInsights {
  wiring: ArchetypePill[]  // structural strengths (4 pills)
  watch: ArchetypePill[]   // blind spots / traps (4 pills)
  generatedAt: string
}

const SYNTHESIS_PROMPT = `You are a personality synthesis engine for a life coaching app.

Given a person's enneagram type, sun sign, rising sign, and neurodivergent wiring,
generate 4 WIRING pills and 4 WATCH pills that synthesise what these archetypes mean IN PRACTICE for this person.

WIRING = structural strengths that emerge from the combination of their archetypes
WATCH = blind spots, traps, or patterns to stay aware of

Rules:
- Each pill label: 3–6 words, lowercase, specific and actionable (not generic)
- Each tooltip: 1 tight sentence explaining what this means in lived experience
- WIRING pill colors: choose from blue, green, purple, orange (assign thoughtfully — blue=insight/perception, green=growth/connection, purple=depth/creativity, orange=energy/output)
- WATCH pill colors: always "amber"
- Make them feel personal and accurate, not horoscope-generic
- Reference the interplay between the archetypes (e.g. "3w4 + AuDHD = perfectionism loop")

Return ONLY valid JSON in this exact shape:
{
  "wiring": [
    { "label": "example label", "tooltip": "One sentence explanation.", "color": "blue" },
    { "label": "example label", "tooltip": "One sentence explanation.", "color": "green" },
    { "label": "example label", "tooltip": "One sentence explanation.", "color": "purple" },
    { "label": "example label", "tooltip": "One sentence explanation.", "color": "orange" }
  ],
  "watch": [
    { "label": "example label", "tooltip": "One sentence explanation.", "color": "amber" },
    { "label": "example label", "tooltip": "One sentence explanation.", "color": "amber" },
    { "label": "example label", "tooltip": "One sentence explanation.", "color": "amber" },
    { "label": "example label", "tooltip": "One sentence explanation.", "color": "amber" }
  ]
}

No other text. No markdown. No explanation. Just the JSON object.`

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json() as { userId?: string }

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    // Load profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('enneagram, sun_sign, rising_sign, neurodivergent_notes')
      .eq('user_id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { enneagram, sun_sign, rising_sign, neurodivergent_notes } = profile

    if (!enneagram && !sun_sign && !neurodivergent_notes) {
      return NextResponse.json({ error: 'No archetype data to synthesise' }, { status: 400 })
    }

    const archetypeLines: string[] = []
    if (enneagram)            archetypeLines.push(`Enneagram: ${enneagram}`)
    if (sun_sign)             archetypeLines.push(`Sun Sign: ${sun_sign}`)
    if (rising_sign)          archetypeLines.push(`Rising Sign: ${rising_sign}`)
    if (neurodivergent_notes) archetypeLines.push(`Neurodivergent wiring: ${neurodivergent_notes}`)

    const userPrompt = `Generate WIRING + WATCH pills for this person:\n${archetypeLines.join('\n')}`

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: SYNTHESIS_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    let parsed: { wiring: ArchetypePill[]; watch: ArchetypePill[] }
    try {
      // Strip markdown code fences if present
      const jsonStr = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
      parsed = JSON.parse(jsonStr) as { wiring: ArchetypePill[]; watch: ArchetypePill[] }
    } catch {
      console.error('[archetype-insights] JSON parse error. Raw:', raw)
      return NextResponse.json({ error: 'Failed to parse Haiku response' }, { status: 500 })
    }

    const insights: ArchetypeInsights = {
      wiring: (parsed.wiring ?? []).slice(0, 4),
      watch:  (parsed.watch  ?? []).slice(0, 4),
      generatedAt: new Date().toISOString(),
    }

    // Persist to user_profiles
    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: userId, archetype_insights: insights, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('[archetype-insights] upsert error:', upsertError)
      // Return insights even if save failed — sidebar can use them from this response
    }

    return NextResponse.json({ insights })
  } catch (error) {
    console.error('[archetype-insights] error:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!isSupabaseConfigured()) return NextResponse.json({ insights: null })

  const { data, error } = await supabase
    .from('user_profiles')
    .select('archetype_insights')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return NextResponse.json({ insights: null })

  return NextResponse.json({ insights: data.archetype_insights ?? null })
}
