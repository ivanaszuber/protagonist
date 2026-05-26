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

Classify this input into one of these intents:
1. TASK — ALWAYS use this if the message starts with or contains "add task", "add a task", "new task", "create task", "remind me to", "I need to", "don't forget", "book", "schedule", "prep", or any clear action item the user wants to track. When in doubt between TASK and CHAT, choose TASK.
2. NOTE — user is journaling, reflecting, or sharing feelings (emotional, reflective, no clear action item)
3. LEGEND — user is defining or confirming their long-term Legend (one-sentence life vision) for a character dimension. Use when they confirm a final legend sentence or say "save this as my legend".
4. BOSS — user wants to create or restart a boss battle (keywords: boss battle, boss fight, attack moves, slay the boss, hunt it down)
5. CHAT — questions, advice, open conversation. Never use CHAT if there's a clear action item.

For TASK, extract:
- title: clean task title (remove filler words like "add task" or "remind me to")
- dimension: one of "career", "social", "wealth", "vitality", "mind", "love", "family" — infer from context:
  - career: work, job, interview, project, promotion, side hustle, productivity
  - social: friends, events, networking, community, going out, catch up
  - wealth: money, savings, investments, budget, expenses, salary
  - vitality: exercise, workout, gym, sleep, eating, health, energy, steps, walk, run
  - mind: learning, reading, study, courses, journaling, meditation, focus, clarity
  - love: partner, relationship, date, romance, intimacy, connection with significant other
  - family: kids, parents, siblings, home, chores, family time, household
  If unclear, return null.
- date: ISO date string. Default to "${today}" (today) UNLESS the user explicitly says "someday", "later", "no rush", "eventually", or mentions a specific future date. If they say "tomorrow" use the next day. If they say a weekday name use the next occurrence. Most tasks should get today's date.
- milestoneId: match to one of the user's quest IDs above if clearly relevant, otherwise null
- xpReward: 25 for tiny tasks, 50 for standard, 100 for hard/important ones
- questId: the quest id if matched, otherwise null

For LEGEND extract:
- dimension: career | social | wealth | vitality | mind | love | family
- vision: the single-sentence legend (only if user provided or confirmed a final sentence; otherwise null)

For BOSS extract:
- dimension: career | social | wealth | vitality | mind | love | family

Respond ONLY with valid JSON, no explanation:
{
  "intent": "TASK" | "NOTE" | "LEGEND" | "BOSS" | "CHAT",
  "task": {
    "title": "...",
    "dimension": "career" | "social" | "wealth" | "vitality" | "mind" | "love" | "family" | null,
    "date": "YYYY-MM-DD" | null,
    "questId": "..." | null,
    "milestoneId": null,
    "xpReward": 50
  } | null,
  "note": {
    "text": "..." 
  } | null,
  "legend": {
    "dimension": "career" | "social" | "wealth" | "vitality" | "mind" | "love" | "family",
    "vision": "..." | null
  } | null,
  "boss": {
    "dimension": "career" | "social" | "wealth" | "vitality" | "mind" | "love" | "family"
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
