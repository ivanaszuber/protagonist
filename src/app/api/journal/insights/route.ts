import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ patternCards: [], unheardVoices: [], growthMarkers: [] })
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [notesRes, memoriesRes, tasksRes] = await Promise.all([
    supabase
      .from('voice_notes')
      .select('id, content, mood_signal, focus_list, created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false }),
    supabase
      .from('dimension_memories')
      .select('dimension_id, content, importance, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('tasks')
      .select('dimension, completed, xp_reward, created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo),
  ])

  const notes = notesRes.data ?? []
  const memories = memoriesRes.data ?? []
  const tasks = tasksRes.data ?? []

  // ── Pattern Cards ─────────────────────────────────────────────────────────
  // Count dimension mentions across notes
  const dimMentions: Record<string, number> = {}
  const dimMoods: Record<string, string[]> = {}

  for (const note of notes) {
    const focusList = (() => {
      try {
        if (typeof note.focus_list === 'string') return JSON.parse(note.focus_list as string) as { dimension: string }[]
        return (note.focus_list as { dimension: string }[] | null) ?? []
      } catch { return [] }
    })()
    for (const item of focusList) {
      if (item.dimension) {
        dimMentions[item.dimension] = (dimMentions[item.dimension] ?? 0) + 1
        if (note.mood_signal) {
          if (!dimMoods[item.dimension]) dimMoods[item.dimension] = []
          dimMoods[item.dimension].push(note.mood_signal as string)
        }
      }
    }
  }

  // Top mentioned dimension
  const sortedDims = Object.entries(dimMentions).sort((a, b) => b[1] - a[1])
  const patternCards = sortedDims.slice(0, 3).map(([dim, count]) => {
    const moods = dimMoods[dim] ?? []
    const positiveMoods = moods.filter(m => ['positive', 'excited', 'proud', 'energized', 'happy'].includes(m.toLowerCase()))
    const energy = moods.length > 0 ? Math.round((positiveMoods.length / moods.length) * 100) : 50

    return {
      dimension: dim,
      mentionCount: count,
      energyPercent: energy,
      label: count >= 5 ? 'High Focus' : count >= 3 ? 'Active' : 'Emerging',
    }
  })

  // ── Unheard Voices ─────────────────────────────────────────────────────────
  // Dimensions with NO recent notes/tasks = unheard voices
  const allDims = ['career', 'social', 'wealth', 'vitality', 'mind', 'love', 'family']
  const recentDims = new Set(Object.keys(dimMentions))

  // Also check tasks
  const recentTaskDims = new Set(
    tasks.filter(t => t.created_at >= sevenDaysAgo).map(t => t.dimension as string)
  )

  const unheardVoices = allDims
    .filter(dim => !recentDims.has(dim) && !recentTaskDims.has(dim))
    .map(dim => ({
      dimension: dim,
      lastSeen: memories.find(m => m.dimension_id === dim)?.created_at as string | null ?? null,
      message: getUnheardMessage(dim),
    }))

  // ── Growth Markers ─────────────────────────────────────────────────────────
  // Completed tasks per dimension in last 30 days
  const completedByDim: Record<string, number> = {}
  const xpByDim: Record<string, number> = {}
  for (const task of tasks) {
    if (task.completed) {
      const dim = task.dimension as string
      completedByDim[dim] = (completedByDim[dim] ?? 0) + 1
      xpByDim[dim] = (xpByDim[dim] ?? 0) + (task.xp_reward as number ?? 0)
    }
  }

  const growthMarkers = Object.entries(completedByDim)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([dim, count]) => ({
      dimension: dim,
      completedTasks: count,
      xpEarned: xpByDim[dim] ?? 0,
    }))

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    totalEntries: notes.length,
    totalCompleted: tasks.filter(t => t.completed).length,
    activeStreak: computeStreak(notes),
    mostActiveDay: getMostActiveDay(notes),
  }

  return NextResponse.json({ patternCards, unheardVoices, growthMarkers, stats })
}

function getUnheardMessage(dim: string): string {
  const messages: Record<string, string> = {
    career: "Your ambitions have been quiet lately — what's stirring in your work life?",
    social: "Connection has gone unspoken — who have you been missing?",
    wealth: "Your finances haven't had a voice — any shifts worth noting?",
    vitality: "Your body has been silent — how is your energy, really?",
    mind: "Your inner growth hasn't been captured — what have you been learning?",
    love: "Your heart has been quiet — what's alive in your relationships?",
    family: "Family moments have gone unrecorded — what's happening at home?",
  }
  return messages[dim] ?? `${dim} hasn't been explored recently.`
}

function computeStreak(notes: { created_at: string }[]): number {
  if (notes.length === 0) return 0
  const days = new Set(notes.map(n => (n.created_at as string).split('T')[0]))
  const today = new Date()
  let streak = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    if (days.has(d.toISOString().split('T')[0])) {
      streak++
    } else {
      break
    }
  }
  return streak
}

function getMostActiveDay(notes: { created_at: string }[]): string {
  if (notes.length === 0) return 'None yet'
  const dayCounts: Record<string, number> = {}
  for (const n of notes) {
    const day = new Date(n.created_at as string).toLocaleDateString('en-GB', { weekday: 'long' })
    dayCounts[day] = (dayCounts[day] ?? 0) + 1
  }
  return Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'None'
}
