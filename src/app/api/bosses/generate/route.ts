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

interface MilestoneRow {
  id: string
  title: string
  target_date: string | null
  is_focused: boolean
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const body = await request.json()
  const { userId, dimension, userMessage, focusMilestoneId } = body as {
    userId?: string
    dimension?: string
    userMessage?: string
    focusMilestoneId?: string | null  // optional — pin all tasks to one milestone
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

  // 7-day sprint
  const today = new Date().toISOString().split('T')[0]
  const deadlineDate = new Date()
  deadlineDate.setDate(deadlineDate.getDate() + 7)
  const deadlineStr = deadlineDate.toISOString().split('T')[0]

  // Fetch quest for this dimension
  const { data: quest } = await supabase
    .from('main_quests')
    .select('id, vision')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .maybeSingle()

  // Fetch ALL active milestones (ordered by target_date ascending so urgent ones come first)
  let milestones: MilestoneRow[] = []
  if (quest) {
    const { data } = await supabase
      .from('milestones')
      .select('id, title, target_date, is_focused')
      .eq('quest_id', quest.id)
      .eq('completed', false)
      .order('is_focused', { ascending: false })  // focused first
      .order('target_date', { ascending: true, nullsFirst: false })
    milestones = (data ?? []) as MilestoneRow[]
  }

  // Priority: explicit focusMilestoneId param → is_focused flag → all milestones
  if (focusMilestoneId) {
    milestones = milestones.filter((m) => m.id === focusMilestoneId)
  } else {
    const focused = milestones.find((m) => m.is_focused)
    if (focused) {
      milestones = [focused]
    }
  }

  // Build milestone context string for the prompt
  const hasMilestones = milestones.length > 0
  const milestoneLines = milestones
    .map((m) => `  - id: "${m.id}" | "${m.title}" (due: ${m.target_date ?? 'no date set'})`)
    .join('\n')

  // Calculate task budget: 2–3 tasks per milestone, cap at 7
  const tasksPerMilestone = 2
  const taskBudget = hasMilestones
    ? Math.min(milestones.length * tasksPerMilestone + 1, 7)
    : 5

  const milestoneSection = hasMilestones
    ? `Active milestones (assign each task to the milestone it serves):
${milestoneLines}

Rules for milestone assignment:
- Assign 2–3 tasks per milestone
- Prioritise milestones with closer due dates (they appear first above)
- Every task MUST include a "milestone_id" field matching one of the IDs above
- If focused on a single milestone, all tasks go to that one`
    : `No milestones defined yet — create tasks that directly advance the quest.`

  const prompt = `You are creating a focused 7-day challenge sprint for the ${dimension} dimension of someone's life.

Quest: ${quest?.vision ?? 'none set'}
Today: ${today}
Sprint deadline: ${deadlineStr} (7 days from today)
User request: ${userMessage ?? 'Create a new weekly challenge'}

${milestoneSection}

Generate:
1. A compelling challenge name (short, energising — something to master this week)
2. Exactly ${taskBudget} specific, actionable tasks — concrete actions completable within a week
3. Each task has hp_damage: 1 (all tasks equal weight)
4. hp_total = ${taskBudget}
5. Spread task due_dates across the 7 days — don't pile everything on day 7
6. Deadline: ${deadlineStr}

Respond ONLY with valid JSON — no markdown, no explanation:
{
  "boss_name": "...",
  "deadline": "${deadlineStr}",
  "hp_total": ${taskBudget},
  "tasks": [
    { "title": "...", "due_date": "YYYY-MM-DD", "hp_damage": 1${hasMilestones ? ', "milestone_id": "..."' : ''} }
  ]
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const parsed = parseJson(raw)

    const rawTasks = (parsed.tasks as Array<{
      title: string
      due_date: string
      hp_damage: number
      milestone_id?: string
    }>) ?? []

    // Validate milestone_ids — reject any that weren't in our list
    const validMilestoneIds = new Set(milestones.map((m) => m.id))
    const tasks = rawTasks.map((t) => ({
      title: t.title,
      due_date: t.due_date,
      hp_damage: 1, // always 1; ignore whatever Claude says
      milestone_id:
        t.milestone_id && validMilestoneIds.has(t.milestone_id)
          ? t.milestone_id
          : (milestones[0]?.id ?? null),
    }))

    const boss = await createBoss(userId, dimension, {
      name: String(parsed.boss_name ?? 'Weekly Challenge'),
      deadline: deadlineStr,
      hp_total: tasks.length,
      quest_id: quest?.id ?? null,
      tasks,
    })

    return NextResponse.json({
      boss,
      milestone_count: milestones.length,
      focused_milestone: focusMilestoneId ?? null,
    })
  } catch (error) {
    console.error('Boss generate error:', error)
    const msg = error instanceof Error ? error.message : 'Failed to generate boss'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
