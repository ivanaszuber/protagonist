import { NextResponse } from 'next/server'
import { getOuraTokens, saveOuraTokens } from '@/lib/db'
import { refreshOuraTokens } from '@/lib/oura'

const OURA_BASE = 'https://api.ouraring.com/v2'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const stored = await getOuraTokens(userId)
  if (!stored) {
    return NextResponse.json({ error: 'not_connected' }, { status: 200 })
  }

  let accessToken = stored.access_token
  const expiresAt = new Date(stored.expires_at)
  if (Date.now() + 5 * 60 * 1000 > expiresAt.getTime()) {
    try {
      const newTokens = await refreshOuraTokens(stored.refresh_token)
      await saveOuraTokens(userId, newTokens)
      accessToken = newTokens.access_token
    } catch (e) {
      return NextResponse.json({ error: 'token_refresh_failed', detail: String(e) })
    }
  }

  const headers = { Authorization: `Bearer ${accessToken}` }
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]

  const [todayRes, rangeRes, personalRes] = await Promise.allSettled([
    fetch(
      `${OURA_BASE}/usercollection/daily_cycle_insights?start_date=${today}&end_date=${today}`,
      { headers }
    ).then(async (r) => ({ status: r.status, ok: r.ok, body: await r.json() })),

    fetch(
      `${OURA_BASE}/usercollection/daily_cycle_insights?start_date=${weekAgo}&end_date=${today}`,
      { headers }
    ).then(async (r) => ({ status: r.status, ok: r.ok, body: await r.json() })),

    fetch(`${OURA_BASE}/usercollection/personal_info`, { headers })
      .then(async (r) => ({ status: r.status, ok: r.ok, body: await r.json() })),
  ])

  return NextResponse.json({
    userId: userId.slice(0, 8) + '...',
    today,
    weekAgo,
    tokenExpiresAt: stored.expires_at,
    cycle_today: todayRes.status === 'fulfilled' ? todayRes.value : { error: String(todayRes.reason) },
    cycle_week: rangeRes.status === 'fulfilled' ? rangeRes.value : { error: String(rangeRes.reason) },
    personal_info: personalRes.status === 'fulfilled' ? personalRes.value : { error: String(personalRes.reason) },
  })
}
