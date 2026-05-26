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

    if (readiness_score === null || sleep_score === null || activity_score === null) {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
      const { data: recentRows } = await supabase
        .from('oura_daily')
        .select('readiness_score, sleep_score, activity_score, date')
        .eq('user_id', userId)
        .gte('date', weekAgo)
        .order('date', { ascending: false })
        .limit(7)

      if (recentRows) {
        if (readiness_score === null) {
          const r = recentRows.find((row) => row.readiness_score != null)
          if (r) readiness_score = r.readiness_score as number
        }
        if (sleep_score === null) {
          const r = recentRows.find((row) => row.sleep_score != null)
          if (r) sleep_score = r.sleep_score as number
        }
        if (activity_score === null) {
          const r = recentRows.find((row) => row.activity_score != null)
          if (r) activity_score = r.activity_score as number
        }
      }
    }

    const today = todayDate()
    const { data: moodRow } = await supabase
      .from('mood_entries')
      .select('mood_score, created_at')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: lastMoodRow } = await supabase
      .from('mood_entries')
      .select('created_at')
      .eq('user_id', userId)
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
      mood_last_logged_at: lastMoodRow?.created_at ?? null,
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
    mood_last_logged_at: null,
  })
}
