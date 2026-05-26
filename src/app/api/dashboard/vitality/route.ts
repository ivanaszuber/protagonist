import { NextResponse } from 'next/server'
import { getOuraDaily } from '@/lib/db'
import { computeHp, ouraRowToDashboardPayload } from '@/lib/oura'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

function todayDate(): string {
  return new Date().toISOString().split('T')[0]
}

function yesterdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  let readiness_score: number | null = null
  let sleep_score: number | null = null
  let activity_score: number | null = null
  let cycle_day: number | null = null
  let cycle_phase: string | null = null

  if (isSupabaseConfigured()) {
    let row = await getOuraDaily(userId, todayDate())
    if (!row) {
      row = await getOuraDaily(userId, yesterdayDate())
    }
    if (row) {
      const payload = ouraRowToDashboardPayload(row)
      readiness_score = payload.readiness_score
      sleep_score = payload.sleep_score
      activity_score = payload.activity_score
      cycle_day = payload.cycle_day
      cycle_phase = payload.cycle_phase
    }

    const today = todayDate()
    const { data: moodRow } = await supabase
      .from('mood_entries')
      .select('mood_score')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const hp = computeHp({ readiness_score, sleep_score, activity_score })

    return NextResponse.json({
      hp,
      readiness_score,
      sleep_score,
      activity_score,
      cycle_day,
      cycle_phase,
      mood_today: moodRow?.mood_score ?? null,
    })
  }

  return NextResponse.json({
    hp: computeHp({ readiness_score: null, sleep_score: null, activity_score: null }),
    readiness_score,
    sleep_score,
    activity_score,
    cycle_day,
    cycle_phase,
    mood_today: null,
  })
}
