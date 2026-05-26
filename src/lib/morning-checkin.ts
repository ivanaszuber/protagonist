import Anthropic from '@anthropic-ai/sdk'
import { getCalendarEvents, getOuraDaily } from '@/lib/db'
import { computeDimensionStreak } from '@/lib/streak'
import { isQuestDbConfigured } from '@/lib/quest-db'
import { supabase } from '@/lib/supabase'

const VALID_DIMENSIONS = new Set([
  'career',
  'social',
  'wealth',
  'vitality',
  'mind',
  'love',
  'family',
])

export interface MorningContextResponse {
  readiness: number | null
  sleep: number | null
  activity: number | null
  task_count: number
  event_count: number
  already_checked_in: boolean
}

export interface MorningCheckinTaskInput {
  title: string
  dimension: string
  due_date: string
  xp_reward: number
}

export interface MorningCheckinClaudeResult {
  calendar_matches: string[]
  new_tasks: MorningCheckinTaskInput[]
  mood_signal: string
  focus_list: Array<{ text: string; dimension: string | null }>
  suggestions: Array<{ text: string; dimension: string }>
  oracle_message: string
}

export interface CreatedMorningTask extends MorningCheckinTaskInput {
  id: string
}

function yesterdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export async function getOuraDailyWithFallback(
  userId: string,
  today: string
): Promise<{
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
} | null> {
  let row = await getOuraDaily(userId, today)
  if (!row) row = await getOuraDaily(userId, yesterdayDate())
  if (!row) return null
  return {
    readiness_score: (row.readiness_score as number) ?? null,
    sleep_score: (row.sleep_score as number) ?? null,
    activity_score: (row.activity_score as number) ?? null,
  }
}

export async function fetchMorningContext(userId: string): Promise<MorningContextResponse> {
  const today = new Date().toISOString().split('T')[0]
  const startOfDay = `${today}T00:00:00.000Z`
  const endOfDay = `${today}T23:59:59.999Z`

  const [oura, events, tasksRes, checkInRes] = await Promise.all([
    getOuraDailyWithFallback(userId, today),
    getCalendarEvents(userId, today),
    isQuestDbConfigured()
      ? supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('task_date', today)
      : Promise.resolve({ count: 0 }),
    supabase
      .from('voice_notes')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .limit(1)
      .maybeSingle(),
  ])

  return {
    readiness: oura?.readiness_score ?? null,
    sleep: oura?.sleep_score ?? null,
    activity: oura?.activity_score ?? null,
    task_count: tasksRes.count ?? 0,
    event_count: events.length,
    already_checked_in: Boolean(checkInRes.data),
  }
}

interface QuestContextRow {
  dimension: string
  vision: string
  streak_days: number
  last_task_date: string | null
}

async function fetchQuestContext(userId: string): Promise<QuestContextRow[]> {
  if (!isQuestDbConfigured()) return []

  const { data: quests } = await supabase
    .from('main_quests')
    .select('dimension, vision')
    .eq('user_id', userId)
    .eq('active', true)

  const { data: recentTasks } = await supabase
    .from('tasks')
    .select('dimension, task_date')
    .eq('user_id', userId)
    .not('task_date', 'is', null)
    .order('task_date', { ascending: false })
    .limit(100)

  const lastByDim = new Map<string, string>()
  for (const t of recentTasks ?? []) {
    const dim = t.dimension as string
    if (!lastByDim.has(dim)) lastByDim.set(dim, t.task_date as string)
  }

  return Promise.all(
    (quests ?? []).map(async (q) => ({
      dimension: q.dimension as string,
      vision: q.vision as string,
      streak_days: await computeDimensionStreak(userId, q.dimension as string),
      last_task_date: lastByDim.get(q.dimension as string) ?? null,
    }))
  )
}

interface CalendarRow {
  title: string
  start_time: string | null
}

interface TaskRow {
  title: string
  dimension: string
  completed: boolean
}

export function buildMorningCheckinPrompt(params: {
  transcript: string
  today: string
  calendarEvents: CalendarRow[]
  tasks: TaskRow[]
  quests: QuestContextRow[]
  ouraRow: {
    readiness_score: number | null
    sleep_score: number | null
    activity_score: number | null
  } | null
}): string {
  const { transcript, today, calendarEvents, tasks, quests, ouraRow } = params
  const weekday = new Date(`${today}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
  })

  return `You are Oracle, the intelligent morning strategist for Protagonist — a personal RPG life app.

Today: ${today} (${weekday})

## What Protagonist already knows about today:

### Calendar events today:
${
  calendarEvents.length
    ? calendarEvents
        .map((e) => `- "${e.title}" at ${e.start_time ?? 'all day'}`)
        .join('\n')
    : '(none)'
}

### Tasks already scheduled for today:
${
  tasks.length
    ? tasks
        .map(
          (t) =>
            `- "${t.title}" [${t.dimension}] ${t.completed ? '(completed)' : '(pending)'}`
        )
        .join('\n')
    : '(none)'
}

### Active quests:
${
  quests.length
    ? quests
        .map(
          (q) =>
            `- ${q.dimension}: "${q.vision}" — streak: ${q.streak_days}d, last task: ${q.last_task_date ?? 'unknown'}`
        )
        .join('\n')
    : '(none)'
}

### Oura biometrics:
- Readiness: ${ouraRow?.readiness_score ?? 'unknown'}
- Sleep: ${ouraRow?.sleep_score ?? 'unknown'}
- Activity: ${ouraRow?.activity_score ?? 'unknown'}

## What the user said this morning (transcript):
"${transcript.replace(/"/g, '\\"')}"

## Your job:
Read the transcript carefully. Do the following:

1. **calendar_matches** — identify anything the user mentioned that is already in their calendar. Match loosely (e.g. "drinks with Victoria" matches "Drinks - Victoria"). Return the matched event titles.

2. **new_tasks** — identify any concrete action items mentioned in the transcript that are NOT already in their tasks or calendar. For each:
   - title: clean, actionable task title
   - dimension: infer from context (career/social/wealth/vitality/mind/love/family)
   - due_date: "${today}" unless they said something specific like "this week" or "tomorrow"
   - xp_reward: 25 (small), 50 (standard), 100 (meaningful)

3. **mood_signal** — extract their subjective energy/mood from the transcript (e.g. "tired but energised", "feeling sharp", "low energy"). This overrides biometric scores for recommendations.

4. **focus_list** — top 3 things they should do today, ordered by importance. Draw from: existing tasks, new tasks you just identified, and quest-based suggestions. Be specific and human. Each item: { text: string, dimension: string | null }

5. **suggestions** — 1–2 additional things worth doing today based on their active quests and readiness. E.g. a quest that hasn't been touched in 3+ days, or a quick win if energy is high. Only suggest things not already covered in focus_list.

6. **oracle_message** — one punchy, personal line. Max 20 words. Reference something specific from their transcript. Energising, not generic. Don't start with "Remember" or "You've got this".

Respond ONLY with valid JSON:
{
  "calendar_matches": ["event title 1"],
  "new_tasks": [
    {
      "title": "...",
      "dimension": "love",
      "due_date": "YYYY-MM-DD",
      "xp_reward": 50
    }
  ],
  "mood_signal": "...",
  "focus_list": [
    { "text": "...", "dimension": "career" }
  ],
  "suggestions": [
    { "text": "...", "dimension": "career" }
  ],
  "oracle_message": "..."
}`
}

function parseClaudeJson(raw: string): MorningCheckinClaudeResult {
  const trimmed = raw.trim()
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Invalid JSON from Claude')
    parsed = JSON.parse(match[0]) as Record<string, unknown>
  }

  const newTasksRaw = (parsed.new_tasks as Array<Record<string, unknown>>) ?? []
  const new_tasks = newTasksRaw
    .map((t) => ({
      title: String(t.title ?? '').trim(),
      dimension: VALID_DIMENSIONS.has(String(t.dimension))
        ? String(t.dimension)
        : 'career',
      due_date: String(t.due_date ?? new Date().toISOString().split('T')[0]),
      xp_reward: Number(t.xp_reward) || 50,
    }))
    .filter((t) => t.title.length > 0)

  return {
    calendar_matches: ((parsed.calendar_matches as string[]) ?? []).map(String),
    new_tasks,
    mood_signal: String(parsed.mood_signal ?? ''),
    focus_list: ((parsed.focus_list as Array<Record<string, unknown>>) ?? []).map(
      (f) => ({
        text: String(f.text ?? ''),
        dimension: f.dimension ? String(f.dimension) : null,
      })
    ),
    suggestions: ((parsed.suggestions as Array<Record<string, unknown>>) ?? []).map(
      (s) => ({
        text: String(s.text ?? ''),
        dimension: String(s.dimension ?? 'career'),
      })
    ),
    oracle_message: String(parsed.oracle_message ?? ''),
  }
}

export async function runMorningCheckin(
  userId: string,
  transcript: string
): Promise<{
  calendar_matches: string[]
  new_tasks: CreatedMorningTask[]
  focus_list: Array<{ text: string; dimension: string | null }>
  suggestions: Array<{ text: string; dimension: string }>
  oracle_message: string
  mood_signal: string
}> {
  const today = new Date().toISOString().split('T')[0]

  const [calendarRows, tasksRes, quests, ouraRow] = await Promise.all([
    getCalendarEvents(userId, today),
    isQuestDbConfigured()
      ? supabase.from('tasks').select('*').eq('user_id', userId).eq('task_date', today)
      : Promise.resolve({ data: [] }),
    fetchQuestContext(userId),
    getOuraDailyWithFallback(userId, today),
  ])

  const calendarEvents: CalendarRow[] = (calendarRows ?? []).map((e) => ({
    title: String(e.title ?? ''),
    start_time: (e.start_time as string) ?? null,
  }))

  const tasks: TaskRow[] = (tasksRes.data ?? []).map((t) => ({
    title: String(t.title ?? ''),
    dimension: String(t.dimension ?? 'career'),
    completed: Boolean(t.completed),
  }))

  const prompt = buildMorningCheckinPrompt({
    transcript,
    today,
    calendarEvents,
    tasks,
    quests,
    ouraRow,
  })

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const result = parseClaudeJson(raw)

  const createdTasks: CreatedMorningTask[] = []
  if (isQuestDbConfigured()) {
    for (const task of result.new_tasks) {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          dimension: task.dimension,
          title: task.title,
          xp_reward: task.xp_reward,
          task_date: task.due_date,
        })
        .select('id')
        .single()

      if (!error && data) {
        createdTasks.push({ ...task, id: data.id as string })
      }
    }

    await supabase.from('voice_notes').insert({
      user_id: userId,
      content: transcript,
      oracle_reply: result.oracle_message,
    })
  }

  return {
    calendar_matches: result.calendar_matches,
    new_tasks: createdTasks,
    focus_list: result.focus_list,
    suggestions: result.suggestions,
    oracle_message: result.oracle_message,
    mood_signal: result.mood_signal,
  }
}
