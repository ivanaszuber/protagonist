import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createBoss, getActiveBoss } from '@/lib/bosses'
import { isQuestDbConfigured } from '@/lib/quest-db'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const VALID_DIMENSIONS = new Set([
  'career',
  'social',
  'wealth',
  'vitality',
  'mind',
  'love',
  'family',
])

function parseJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as Record<string, unknown>
    throw new Error('Invalid JSON')
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const body = await request.json()
  const { userId, dimension, userMessage } = body as {
    userId?: string
    dimension?: string
    userMessage?: string
  }

  if (!userId || !dimension) {
    return NextResponse.json({ error: 'userId and dimension required' }, { status: 400 })
  }
  if (!VALID_DIMENSIONS.has(dimension)) {
    return NextResponse.json({ error: 'Invalid dimension' }, { status: 400 })
  }
  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const existing = await getActiveBoss(userId, dimension)
  if (existing) {
    return NextResponse.json({ error: 'Active boss already exists' }, { status: 409 })
  }

  const today = new Date().toISOString().split('T')[0]
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + 30)
  const deadlineStr = deadline.toISOString().split('T')[0]

  const { data: quest } = await supabase
    .from('main_quests')
    .select('id, vision')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .maybeSingle()

  const { data: milestone } = quest
    ? await supabase
        .from('milestones')
        .select('title, target_date')
        .eq('quest_id', quest.id)
        .eq('completed', false)
        .order('sort_order')
        .limit(1)
        .maybeSingle()
    : { data: null }

  const prompt = `You are creating a focused challenge sprint for the ${dimension} dimension of someone's life.
Current quest: ${quest?.vision ?? 'none'}
Current milestone: ${milestone?.title ?? 'none'} (due ${milestone?.target_date ?? 'n/a'})
Today: ${today}
User request: ${userMessage ?? 'Create a new challenge'}

Generate:
1. A compelling challenge name — something to master or achieve (not an enemy to fight)
2. Exactly 5 to 7 specific, actionable tasks to complete it (no more, no less — keep it focused)
3. Each task has a weight of 1 or 2 — total weights must equal exactly 7
4. Spread tasks logically across the next 30 days
5. Deadline ${deadlineStr}

Respond ONLY with JSON:
{
  "boss_name": "...",
  "deadline": "${deadlineStr}",
  "hp_total": 7,
  "tasks": [
    { "title": "...", "due_date": "YYYY-MM-DD", "hp_damage": 1 }
  ]
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const parsed = parseJson(raw)
    const tasks = (parsed.tasks as Array<{
      title: string
      due_date: string
      hp_damage: number
    }>) ?? []

    const boss = await createBoss(userId, dimension, {
      name: String(parsed.boss_name ?? 'The Unknown Boss'),
      deadline: String(parsed.deadline ?? deadlineStr),
      hp_total: (parsed.hp_total as number) ?? 7,
      quest_id: quest?.id ?? null,
      tasks: tasks.map((t) => ({
        title: t.title,
        due_date: t.due_date,
        hp_damage: t.hp_damage,
      })),
    })

    return NextResponse.json({ boss })
  } catch (error) {
    console.error('Boss generate error:', error)
    const msg = error instanceof Error ? error.message : 'Failed to generate boss'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
