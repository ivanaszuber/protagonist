import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { isQuestDbConfigured } from '@/lib/quest-db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function parseClassifyJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (match) {
      return JSON.parse(match[0]) as Record<string, unknown>
    }
    throw new Error('Invalid JSON from classifier')
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const { text, userId } = await request.json()
  if (!text || !userId) {
    return NextResponse.json({ error: 'text and userId required' }, { status: 400 })
  }

  let questContext = '(none yet)'
  if (isQuestDbConfigured()) {
    const { data: quests } = await supabase
      .from('main_quests')
      .select('id, dimension, vision')
      .eq('user_id', userId)
      .eq('active', true)

    questContext =
      (quests ?? [])
        .map((q) => `- ${q.dimension}: "${q.vision}" (id: ${q.id})`)
        .join('\n') || '(none yet)'
  }

  const today = new Date().toISOString().split('T')[0]

  const prompt = `You are a smart assistant for the Protagonist app. The user spoke or typed: "${text}"

Today's date is ${today}.

The user's active quests:
${questContext}

Classify this input into one of three intents:
1. TASK — user wants to create a task/to-do (keywords: "add", "remind", "schedule", "I need to", "don't forget", "book", "call", "send", "prep", "do", or any action item)
2. NOTE — user is journaling, reflecting, or sharing feelings (emotional, reflective, no clear action item)
3. CHAT — user has a question or wants Oracle's guidance

For TASK, extract:
- title: clean task title (remove filler words like "add task" or "remind me to")
- dimension: one of "career", "social", "wealth" (infer from context — job/work/interview = career, people/relationships/social = social, money/finances/savings = wealth). If unclear, return null.
- date: ISO date string. Default to "${today}" (today) UNLESS the user explicitly says "someday", "later", "no rush", "eventually", or mentions a specific future date. If they say "tomorrow" use the next day. If they say a weekday name use the next occurrence. Most tasks should get today's date.
- milestoneId: match to one of the user's quest IDs above if clearly relevant, otherwise null
- xpReward: 25 for tiny tasks, 50 for standard, 100 for hard/important ones
- questId: the quest id if matched, otherwise null

Respond ONLY with valid JSON, no explanation:
{
  "intent": "TASK" | "NOTE" | "CHAT",
  "task": {
    "title": "...",
    "dimension": "career" | "social" | "wealth" | null,
    "date": "YYYY-MM-DD" | null,
    "questId": "..." | null,
    "milestoneId": null,
    "xpReward": 50
  } | null,
  "note": {
    "text": "..." 
  } | null,
  "oracleReply": "..."
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const parsed = parseClassifyJson(raw)
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Oracle classify error:', error)
    return NextResponse.json({
      intent: 'CHAT',
      task: null,
      note: null,
      oracleReply: 'I heard you — what would you like to do?',
    })
  }
}
