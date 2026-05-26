import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
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

function hasEventId(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const id = (value as { event_id?: string }).event_id
  return typeof id === 'string' && id.length > 0
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
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]

  let calendarContext = '(none)'
  if (isSupabaseConfigured()) {
    try {
      const { data: events } = await supabase
        .from('calendar_events')
        .select('id, google_event_id, title, start_time, event_date')
        .eq('user_id', userId)
        .in('event_date', [today, tomorrow])
        .order('start_time', { ascending: true })
        .limit(20)

      calendarContext =
        (events ?? [])
          .map((e) => {
            const timeStr = e.start_time
              ? new Date(e.start_time as string).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'all day'
            const dayStr = e.event_date === today ? 'today' : 'tomorrow'
            return `- id:"${e.google_event_id}" "${e.title}" ${dayStr} at ${timeStr}`
          })
          .join('\n') || '(none)'
    } catch {
      calendarContext = '(none)'
    }
  }

  let vaultContext = 'invested: unknown, cash: unknown'
  if (isSupabaseConfigured()) {
    try {
      const { data: vault } = await supabase
        .from('vault_settings')
        .select('invested, cash')
        .eq('user_id', userId)
        .maybeSingle()
      if (vault) {
        vaultContext = `invested: £${vault.invested}, cash: £${vault.cash}`
      }
    } catch {
      /* vault optional */
    }
  }

  const prompt = `You are a smart assistant for the Protagonist app. The user spoke or typed: "${text}"

Today's date is ${today}.

The user's active quests:
${questContext}

The user's calendar events (today + tomorrow):
${calendarContext}

The user's vault balances:
${vaultContext}

Classify this input into one of these intents:
1. TASK — ALWAYS use this if the message starts with or contains "add task", "add a task", "new task", "create task", "remind me to", "I need to", "don't forget", "book", "schedule", "prep", or any clear action item the user WANTS TO DO in the future. When in doubt between TASK and CHAT, choose TASK.
2. COMPLETED_ACTIVITY — user is reporting something they ALREADY DID. Keywords: "I just", "I did", "I went", "I had", "I finished", "I completed", "I got", "just done", "just had", "already did", "did my", "went for", "went to", "trained", "ran", "walked", "ate", "cooked", "read", "meditated", "worked on". The activity has ALREADY HAPPENED — use this instead of TASK. Do NOT use COMPLETED_ACTIVITY if the user says "remind me" or "I need to" (those are future tasks).
3. NOTE — user is journaling, reflecting, or sharing feelings (emotional, reflective, no clear action item and no concrete activity completed)
4. LEGEND — user is defining or confirming their long-term Legend (one-sentence life vision) for a character dimension. Use when they confirm a final legend sentence or say "save this as my legend".
5. BOSS — user wants to create or restart a boss battle (keywords: boss battle, boss fight, attack moves, slay the boss, hunt it down)
6. CALENDAR_CREATE — user wants to create, schedule, block, or add a new calendar event or appointment. Keywords: "block", "schedule", "add to calendar", "book time", "create event", "put in my calendar", "add a meeting", "add an appointment". Only when clearly creating a new event, not viewing existing ones.
7. CALENDAR_UPDATE — user wants to reschedule, move, or change the time/date of an existing calendar event. Keywords: "move", "reschedule", "push", "change time", "shift", "postpone". Only use when clearly referring to an existing event that appears in the calendar context above.
8. CALENDAR_DELETE — user wants to cancel or delete an existing calendar event. Keywords: "cancel", "delete", "remove", "drop", "skip". Only use when clearly referring to an existing event that appears in the calendar context above.
9. VAULT_UPDATE — user is reporting a change to their net worth or savings balance. Triggers: "my revolut is now", "my savings is now", "cash is now", "just transferred", "invested another", "net worth update", "my ISA is now", "my portfolio is", "topped up", "withdrew from savings". Extract field and amount. If user gives a delta ("I added £2k to savings"), use cash_delta or invested_delta with the delta amount; convert to absolute only if prior balance is clear from vault context.
10. CHAT — questions, advice, open conversation. Never use CHAT if there's a clear action item. Use CHAT if the user wants to update/delete an event but no matching event exists in the calendar context.

For COMPLETED_ACTIVITY, extract the same fields as TASK but put them in "completed_task":
- title: clean activity title (e.g. "20 minute walk", "Gym session", "Read 30 minutes")
- dimension: one of "career", "social", "wealth", "vitality", "mind", "love", "family" — infer from context (walks/gym/food → vitality, reading/study → mind, etc.)
- date: today "${today}" always (it was done today)
- xpReward: 25 for tiny/quick, 50 for standard, 100 for hard/long efforts
The oracleReply should celebrate the win, be warm and brief (1-2 sentences).

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

For CALENDAR_CREATE, extract:
- title: clean event title (e.g. "Interview prep", "1:1 with Sarah", "Gym session")
- date: ISO date. "tomorrow" = next day, "next Monday" = next Monday, "in 3 days" = today + 3, "this Friday" = next Friday. Default today if unspecified.
- startTime: 24h HH:MM if specified, otherwise null (all-day)
- durationMinutes: default 60. "30 mins" = 30, "1 hour" = 60, "90 minutes" = 90, "2 hours" = 120, "half an hour" = 30
- description: extra context or null
- location: explicit location or null

For CALENDAR_UPDATE, extract:
- event_id: the id from the calendar context that best matches what the user described (match by title + approximate time). Must be an id from the list above. If no match, set intent to CHAT instead.
- event_title: the matched event title (as it appears in the calendar context)
- current_date: the event's current date (YYYY-MM-DD)
- current_time: the event's current start time (HH:MM) or null if all-day
- new_date: the new date the user wants (interpret "tomorrow", "Saturday", "next Monday" relative to today ${today})
- new_start_time: the new start time in HH:MM 24h format, or null if unchanged
- new_duration_minutes: duration in minutes, default 60, or unchanged if not mentioned

For CALENDAR_DELETE, extract:
- event_id: the id from the calendar context that best matches. Must be an id from the list above. If no match, set intent to CHAT instead.
- event_title: the matched event title
- event_date: the event's date (YYYY-MM-DD)
- event_time: the event's start time (HH:MM) or null

For VAULT_UPDATE, extract:
- field: "invested" | "cash" | "cash_delta" | "invested_delta" | "both"
- amount: number in GBP (full new balance for invested/cash/both, or delta amount for *_delta fields)
- notes: optional context string or null
The oracleReply should be warm and brief — acknowledge the update and mention the new total net worth if both invested and cash can be inferred.

Respond ONLY with valid JSON, no explanation:
{
  "intent": "TASK" | "COMPLETED_ACTIVITY" | "NOTE" | "LEGEND" | "BOSS" | "CALENDAR_CREATE" | "CALENDAR_UPDATE" | "CALENDAR_DELETE" | "VAULT_UPDATE" | "CHAT",
  "completed_task": {
    "title": "...",
    "dimension": "career" | "social" | "wealth" | "vitality" | "mind" | "love" | "family" | null,
    "date": "YYYY-MM-DD",
    "xpReward": 50
  } | null,
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
  "calendar_event": {
    "title": "...",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM" | null,
    "durationMinutes": 60,
    "description": "..." | null,
    "location": "..." | null
  } | null,
  "calendar_update": {
    "event_id": "...",
    "event_title": "...",
    "current_time": "HH:MM" | null,
    "current_date": "YYYY-MM-DD",
    "new_date": "YYYY-MM-DD",
    "new_start_time": "HH:MM" | null,
    "new_duration_minutes": 60
  } | null,
  "calendar_delete": {
    "event_id": "...",
    "event_title": "...",
    "event_time": "HH:MM" | null,
    "event_date": "YYYY-MM-DD"
  } | null,
  "vault_update": {
    "field": "invested" | "cash" | "cash_delta" | "invested_delta" | "both",
    "amount": 56000,
    "notes": "Revolut savings pot" | null
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

    if (parsed.intent === 'CALENDAR_UPDATE' && !hasEventId(parsed.calendar_update)) {
      parsed.intent = 'CHAT'
      parsed.calendar_update = null
    }
    if (parsed.intent === 'CALENDAR_DELETE' && !hasEventId(parsed.calendar_delete)) {
      parsed.intent = 'CHAT'
      parsed.calendar_delete = null
    }

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
