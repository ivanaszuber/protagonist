import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase, isSupabaseConfigured } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const days = Number(searchParams.get('days') ?? '30')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ pulse: [] })
  }

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Try mood_entries first
  const { data: moodEntries } = await supabase
    .from('mood_entries')
    .select('mood_score, mood_label, created_at')
    .eq('user_id', userId)
    .gte('created_at', startDate)
    .order('created_at', { ascending: true })

  // Also get voice notes with mood_signal
  const { data: voiceNotes } = await supabase
    .from('voice_notes')
    .select('mood_signal, created_at')
    .eq('user_id', userId)
    .gte('created_at', startDate)
    .order('created_at', { ascending: true })

  // Build day-by-day pulse
  const dayMap: Record<string, { scores: number[]; labels: string[] }> = {}

  // Add explicit mood entries
  for (const entry of moodEntries ?? []) {
    const day = (entry.created_at as string).split('T')[0]
    if (!dayMap[day]) dayMap[day] = { scores: [], labels: [] }
    if (entry.mood_score) dayMap[day].scores.push(entry.mood_score as number)
    if (entry.mood_label) dayMap[day].labels.push(entry.mood_label as string)
  }

  // Map mood_signal strings to scores
  const moodSignalToScore: Record<string, number> = {
    'very_positive': 5,
    'positive': 4,
    'neutral': 3,
    'negative': 2,
    'very_negative': 1,
    'energized': 4,
    'excited': 5,
    'proud': 4,
    'calm': 3,
    'anxious': 2,
    'stressed': 2,
    'tired': 2,
    'happy': 4,
    'sad': 2,
    'frustrated': 2,
    'content': 3,
    'overwhelmed': 2,
    'motivated': 4,
    'grateful': 4,
  }

  for (const note of voiceNotes ?? []) {
    if (!note.mood_signal) continue
    const day = (note.created_at as string).split('T')[0]
    if (!dayMap[day]) dayMap[day] = { scores: [], labels: [] }
    const score = moodSignalToScore[(note.mood_signal as string).toLowerCase()]
    if (score) dayMap[day].scores.push(score)
    dayMap[day].labels.push(note.mood_signal as string)
  }

  // Build array for last `days` days
  const pulse: { date: string; score: number | null; label: string | null; hasEntry: boolean }[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().split('T')[0]
    const dayData = dayMap[dateStr]

    if (dayData && dayData.scores.length > 0) {
      const avg = dayData.scores.reduce((a, b) => a + b, 0) / dayData.scores.length
      pulse.push({
        date: dateStr,
        score: Math.round(avg * 10) / 10,
        label: dayData.labels[0] ?? null,
        hasEntry: true,
      })
    } else {
      pulse.push({ date: dateStr, score: null, label: null, hasEntry: false })
    }
  }

  return NextResponse.json({ pulse })
}
