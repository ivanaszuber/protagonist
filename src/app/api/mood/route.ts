import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const MOOD_LABELS = ['', 'Depleted', 'Drained', 'Steady', 'Charged', 'Transcendent'] as const

async function resolveUserId(request: Request, bodyUserId?: string): Promise<string | null> {
  if (bodyUserId) return bodyUserId
  const fromQuery = new URL(request.url).searchParams.get('userId')
  if (fromQuery) return fromQuery
  const cookieStore = await cookies()
  return cookieStore.get('protagonist_user_id')?.value ?? null
}

export async function GET(request: Request) {
  const userId = await resolveUserId(request)
  if (!userId) {
    return NextResponse.json({ mood: null })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ mood: null })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('mood_entries')
    .select('mood_score, mood_label, created_at')
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('mood GET error:', error)
    return NextResponse.json({ mood: null })
  }

  return NextResponse.json({ mood: data ?? null })
}

export async function POST(request: Request) {
  const body = await request.json()
  const userId = await resolveUserId(request, body.userId as string | undefined)

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const moodScore = body.mood_score as number | undefined
  if (!moodScore || moodScore < 1 || moodScore > 5) {
    return NextResponse.json({ error: 'mood_score must be 1–5' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { data, error } = await supabase
    .from('mood_entries')
    .insert({
      user_id: userId,
      mood_score: moodScore,
      mood_label: MOOD_LABELS[moodScore],
      note: (body.note as string | undefined) ?? null,
    })
    .select('mood_score, mood_label, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ mood: data })
}
