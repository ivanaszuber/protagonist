import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export interface DimensionSettings {
  showQuests: boolean
  showMilestones: boolean
  showTasks: boolean
  showPillars: boolean
  showTopOfMind: boolean
  showPatternLog: boolean
  showConversationSeeds: boolean
}

const DEFAULTS: DimensionSettings = {
  showQuests: false,
  showMilestones: false,
  showTasks: true,
  showPillars: true,
  showTopOfMind: true,
  showPatternLog: false,
  showConversationSeeds: false,
}

// love gets conversation seeds on by default
const DIMENSION_DEFAULTS: Record<string, Partial<DimensionSettings>> = {
  love: { showConversationSeeds: true },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const dimensionId = searchParams.get('dimensionId')
  if (!userId || !dimensionId) return NextResponse.json({ error: 'userId and dimensionId required' }, { status: 400 })

  const { data } = await supabase
    .from('dimension_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('dimension_id', dimensionId)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ ...DEFAULTS, ...(DIMENSION_DEFAULTS[dimensionId] ?? {}) })
  }

  return NextResponse.json({
    showQuests: data.show_quests as boolean,
    showMilestones: data.show_milestones as boolean,
    showTasks: data.show_tasks as boolean,
    showPillars: data.show_pillars as boolean,
    showTopOfMind: data.show_top_of_mind as boolean,
    showPatternLog: data.show_pattern_log as boolean,
    showConversationSeeds: data.show_conversation_seeds as boolean,
  } satisfies DimensionSettings)
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as { userId: string; dimensionId: string } & Partial<DimensionSettings>
  const { userId, dimensionId, ...settings } = body
  if (!userId || !dimensionId) return NextResponse.json({ error: 'userId and dimensionId required' }, { status: 400 })

  const payload = {
    user_id: userId,
    dimension_id: dimensionId,
    show_quests: settings.showQuests,
    show_milestones: settings.showMilestones,
    show_tasks: settings.showTasks,
    show_pillars: settings.showPillars,
    show_top_of_mind: settings.showTopOfMind,
    show_pattern_log: settings.showPatternLog,
    show_conversation_seeds: settings.showConversationSeeds,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('dimension_settings')
    .upsert(payload, { onConflict: 'user_id,dimension_id' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
