import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { isQuestDbConfigured } from '@/lib/quest-db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const body = await request.json() as {
    userId?: string
    milestoneId?: string
    milestoneTitle?: string
    questVision?: string
    dimension?: string
    targetDate?: string | null
  }

  const { userId, milestoneId, milestoneTitle, questVision, dimension, targetDate } = body

  if (!userId || !milestoneId || !milestoneTitle || !dimension) {
    return NextResponse.json({ error: 'userId, milestoneId, milestoneTitle, and dimension required' }, { status: 400 })
  }

  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const today = new Date().toISOString().split('T')[0]

  const prompt = `You are a personal strategy assistant. The user is tracking their life as an RPG.

They just created a milestone: "${milestoneTitle}"
Overall quest vision: "${questVision ?? 'Not set'}"
Life dimension: ${dimension}
Target date: ${targetDate ?? 'Not set'}
Today's date: ${today}

Generate exactly 4-6 concrete, actionable tasks that would help them complete this milestone. Each task should be:
- Specific and doable (not vague like "research more")
- Ordered logically (early tasks first, later tasks after)
- Sized appropriately — some quick wins (25 XP), some meaningful work (50 XP), one or two big efforts (100 XP)
- Given a realistic due date spread across the time available (if no target date, spread over 30 days from today)

Respond ONLY with valid JSON, no explanation:
{
  "tasks": [
    {
      "title": "...",
      "due_date": "YYYY-MM-DD",
      "xp_reward": 50
    }
  ]
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '{}'
    let parsed: { tasks?: Array<{ title: string; due_date: string; xp_reward: number }> }
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      parsed = JSON.parse(cleaned) as typeof parsed
    } catch {
      return NextResponse.json({ error: 'Failed to parse task list from Claude' }, { status: 500 })
    }

    const tasks = (parsed.tasks ?? []).filter(t => t.title?.trim())

    if (tasks.length === 0) {
      return NextResponse.json({ tasks: [] })
    }

    // Insert all tasks linked to this milestone — use admin client to bypass RLS
    const inserts = tasks.map(t => ({
      user_id: userId,
      dimension,
      title: t.title.trim(),
      xp_reward: t.xp_reward ?? 50,
      task_date: t.due_date ?? today,
      milestone_id: milestoneId,
    }))

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert(inserts)
      .select('id, title, task_date, xp_reward, completed, milestone_id')

    if (error) {
      console.error('[generate-tasks] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tasks: data ?? [] })
  } catch (err) {
    console.error('[generate-tasks] error:', err)
    return NextResponse.json({ error: 'Failed to generate tasks' }, { status: 500 })
  }
}
