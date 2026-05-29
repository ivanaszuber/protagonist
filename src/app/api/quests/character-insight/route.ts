import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase } from '@/lib/supabase'

const client = new Anthropic()

const DIMENSION_CONFIG: Record<string, {
  metricLabels: string[]
  metricKeys: string[]
}> = {
  love:     { metricLabels: ['quality moments', 'conflicts logged', 'times chose open'],  metricKeys: ['quality', 'conflicts', 'open'] },
  vitality: { metricLabels: ['workouts done',   'avg sleep hrs',   'avg readiness'],      metricKeys: ['workouts', 'sleep', 'readiness'] },
  mind:     { metricLabels: ['meditation days', 'journal entries', 'collapses logged'],   metricKeys: ['meditation', 'journal', 'collapses'] },
  career:   { metricLabels: ['tasks completed', 'deep work hrs',   'milestones hit'],     metricKeys: ['tasks', 'deepwork', 'milestones'] },
  social:   { metricLabels: ['connections made','quality convos',  'events attended'],    metricKeys: ['connections', 'convos', 'events'] },
  wealth:   { metricLabels: ['budget on track', 'savings rate',    'FIRE progress'],      metricKeys: ['budget', 'savings', 'fire'] },
  family:   { metricLabels: ['quality time',    'hard convos had', 'presence score'],     metricKeys: ['time', 'convos', 'presence'] },
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const dimension = searchParams.get('dimension')

  if (!userId || !dimension) {
    return NextResponse.json({ error: 'userId and dimension required' }, { status: 400 })
  }

  // ── Fetch all context in parallel ─────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [dimMemoriesRes, arcMemoriesRes, notesRes, tasksRes, questRes] = await Promise.allSettled([
    // Dimension-specific memories (most important, high limit)
    supabase
      .from('dimension_memories')
      .select('content, created_at, importance')
      .eq('user_id', userId)
      .eq('dimension_id', dimension)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),

    // Arc relationship memories (emotional patterns)
    supabase
      .from('dimension_memories')
      .select('content, created_at')
      .eq('user_id', userId)
      .eq('dimension_id', 'arc')
      .order('importance', { ascending: false })
      .limit(15),

    // Recent voice notes / journal entries mentioning this dimension
    supabase
      .from('voice_notes')
      .select('content, oracle_reply, brief, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),

    // Recent completed tasks in this dimension
    supabase
      .from('tasks')
      .select('title, completed, task_date, created_at')
      .eq('user_id', userId)
      .eq('dimension', dimension)
      .eq('completed', true)
      .gte('task_date', thirtyDaysAgo)
      .order('task_date', { ascending: false })
      .limit(20),

    // Active main quest for this dimension
    supabase
      .from('main_quests')
      .select('vision, character_name, character_class')
      .eq('user_id', userId)
      .eq('dimension', dimension)
      .eq('active', true)
      .maybeSingle(),
  ])

  const dimMemories = dimMemoriesRes.status === 'fulfilled'
    ? (dimMemoriesRes.value.data ?? []).map(r => `[${(r.created_at as string).split('T')[0]}] ${r.content}`)
    : []

  const arcMemories = arcMemoriesRes.status === 'fulfilled'
    ? (arcMemoriesRes.value.data ?? []).map(r => r.content as string)
    : []

  // Filter notes that mention this dimension (via oracle_reply keywords or content)
  const allNotes = notesRes.status === 'fulfilled' ? (notesRes.value.data ?? []) : []
  const dimensionNotes = allNotes
    .filter(n => {
      const combined = `${n.content ?? ''} ${n.oracle_reply ?? ''}`.toLowerCase()
      return combined.includes(dimension) || combined.includes(dimensionKeywords(dimension))
    })
    .slice(0, 6)
    .map(n => {
      const date = new Date(n.created_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const excerpt = (n.brief as string | null) ?? ((n.content as string).slice(0, 200))
      return `[${date}] ${excerpt}`
    })

  const completedTasks = tasksRes.status === 'fulfilled'
    ? (tasksRes.value.data ?? []).map(t => `✓ ${t.title} (${t.task_date})`)
    : []

  const questVision = questRes.status === 'fulfilled' && questRes.value.data
    ? (questRes.value.data.vision as string)
    : null

  // ── Build synthesis prompt ────────────────────────────────────────────────
  const dimCfg = DIMENSION_CONFIG[dimension] ?? DIMENSION_CONFIG.career
  const metricLabels = dimCfg.metricLabels.join(', ')

  const contextBlock = [
    questVision ? `THEIR QUEST: "${questVision}"` : null,
    dimMemories.length > 0 ? `MEMORIES FOR ${dimension.toUpperCase()} (most important first):\n${dimMemories.join('\n')}` : null,
    arcMemories.length > 0 ? `EMOTIONAL/RELATIONAL PATTERNS:\n${arcMemories.join('\n')}` : null,
    dimensionNotes.length > 0 ? `RECENT CONVERSATIONS TOUCHING ${dimension.toUpperCase()}:\n${dimensionNotes.join('\n')}` : null,
    completedTasks.length > 0 ? `COMPLETED TASKS THIS MONTH:\n${completedTasks.slice(0, 10).join('\n')}` : null,
  ].filter(Boolean).join('\n\n')

  const hasData = dimMemories.length > 0 || dimensionNotes.length > 0 || completedTasks.length > 0

  const prompt = `You are Oracle — a sharp, warm, deeply perceptive life coach synthesising someone's ${dimension} dimension.

${contextBlock || 'No data yet — this person is just getting started.'}

Generate a character page insight panel for the ${dimension} dimension. Return JSON only, no markdown:
{
  "narrative": "2-3 sentences in Oracle's voice capturing the real story of where this person is in their ${dimension} right now. Be specific to the actual memories and context — no generic platitudes. Reference real patterns, real names, real moments if present.",
  "lessons": [
    "One specific lesson they're learning right now — drawn from an actual pattern in the data. Under 20 words.",
    "A second lesson. Under 20 words."
  ],
  "growthEdges": [
    {"text": "A specific thing they're working on. Under 18 words.", "urgency": "high"},
    {"text": "A second growth edge. Under 18 words.", "urgency": "medium"}
  ],
  "timeline": [
    {"date": "recent date like '3 Jun'", "type": "win", "text": "A specific positive moment from the data. Under 15 words."},
    {"date": "earlier date", "type": "shift", "text": "A meaningful realisation or turning point. Under 15 words."},
    {"date": "earlier still", "type": "hard", "text": "A challenge they faced. Under 15 words."}
  ],
  "lastWord": "One line in Oracle's voice — the single most important thing to hold right now. Max 20 words."
}

If data is sparse, still write something honest and grounded — acknowledge the blank slate as the starting point.
Lesson type is always "insight". Timeline type must be one of: win, shift, hard.
Dates in timeline should be formatted like "3 Jun" or "28 May".
${hasData ? 'Draw from the real data above — be specific.' : 'Be encouraging about starting the tracking journey.'}`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const data = JSON.parse(jsonMatch[0]) as {
      narrative?: string
      lessons?: string[]
      growthEdges?: Array<{ text: string; urgency: string }>
      timeline?: Array<{ date: string; type: string; text: string }>
      lastWord?: string
    }

    return NextResponse.json({
      narrative: data.narrative ?? '',
      lessons: data.lessons ?? [],
      growthEdges: data.growthEdges ?? [],
      timeline: data.timeline ?? [],
      lastWord: data.lastWord ?? '',
    })
  } catch {
    // Graceful fallback from real data
    const fallbackNarrative = dimMemories.length > 0
      ? `There's real work happening here. ${dimMemories[0].replace(/^\[.*?\] /, '')} Keep going.`
      : `Your ${dimension} journey is just beginning. The first step is showing up — which you're doing.`

    return NextResponse.json({
      narrative: fallbackNarrative,
      lessons: dimMemories.slice(0, 2).map(m => m.replace(/^\[.*?\] /, '')),
      growthEdges: [],
      timeline: completedTasks.slice(0, 2).map((t, i) => ({
        date: new Date(Date.now() - i * 7 * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        type: 'win',
        text: t.replace('✓ ', ''),
      })),
      lastWord: questVision ? `Your quest: "${questVision.slice(0, 60)}${questVision.length > 60 ? '…' : ''}"` : '',
    })
  }
}

function dimensionKeywords(dimension: string): string {
  const map: Record<string, string> = {
    love: 'relationship partner love dating',
    vitality: 'gym workout sleep energy body health',
    mind: 'meditation mindfulness anxiety therapy emotion',
    career: 'work job career promotion meeting',
    social: 'friend social connection party event',
    wealth: 'money finance saving investing budget',
    family: 'family zara daughter parent sibling',
  }
  return map[dimension] ?? dimension
}
