import { NextResponse } from 'next/server'
import { fetchOuraDailyData, refreshOuraTokens } from '@/lib/oura'
import { getOuraTokens, saveOuraTokens, saveOuraDaily, getOuraDaily } from '@/lib/db'

export async function POST(request: Request) {
  const { userId } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const stored = await getOuraTokens(userId)
  if (!stored) {
    return NextResponse.json({ error: 'not_connected', connected: false }, { status: 200 })
  }

  let accessToken = stored.access_token

  const expiresAt = new Date(stored.expires_at)
  const fiveMinutes = 5 * 60 * 1000
  if (Date.now() + fiveMinutes > expiresAt.getTime()) {
    try {
      const newTokens = await refreshOuraTokens(stored.refresh_token)
      await saveOuraTokens(userId, newTokens)
      accessToken = newTokens.access_token
    } catch {
      return NextResponse.json(
        { error: 'token_refresh_failed', connected: false },
        { status: 200 }
      )
    }
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    const data = await fetchOuraDailyData(accessToken, today)
    await saveOuraDaily(userId, {
      date: data.date,
      sleep_score: data.sleep_score,
      sleep_total_seconds: data.sleep_total_seconds,
      sleep_rem_seconds: data.sleep_rem_seconds,
      sleep_deep_seconds: data.sleep_deep_seconds,
      sleep_efficiency: data.sleep_efficiency,
      sleep_latency_seconds: data.sleep_latency_seconds,
      readiness_score: data.readiness_score,
      hrv_balance: data.hrv_balance,
      recovery_index: data.recovery_index,
      body_temperature_deviation: data.body_temperature_deviation,
      activity_score: data.activity_score,
      steps: data.steps,
      active_calories: data.active_calories,
      resilience_level: data.resilience_level,
      hrv_average: data.hrv_average,
    })

    return NextResponse.json({ success: true, connected: true, data })
  } catch (err) {
    console.error('Oura sync error:', err)
    return NextResponse.json({ error: 'sync_failed', connected: true }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const stored = await getOuraTokens(userId)
  if (!stored) return NextResponse.json({ connected: false })

  const today = new Date().toISOString().split('T')[0]
  const data = await getOuraDaily(userId, today)

  return NextResponse.json({ connected: true, data })
}
