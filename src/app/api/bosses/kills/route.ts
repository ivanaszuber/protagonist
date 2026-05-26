import { NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/api-user'
import { getBossKillStats, getBossKills } from '@/lib/bosses'
import { isQuestDbConfigured } from '@/lib/quest-db'

const VALID_DIMENSIONS = new Set([
  'career',
  'social',
  'wealth',
  'vitality',
  'mind',
  'love',
  'family',
])

export async function GET(request: Request) {
  const userId = await resolveUserId(request)
  const dimension = new URL(request.url).searchParams.get('dimension')

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!dimension || !VALID_DIMENSIONS.has(dimension)) {
    return NextResponse.json({ error: 'Invalid dimension' }, { status: 400 })
  }
  if (!isQuestDbConfigured()) {
    return NextResponse.json({ kills: [], stats: { slain: 0, escaped: 0 } })
  }

  const [kills, stats] = await Promise.all([
    getBossKills(userId, dimension),
    getBossKillStats(userId, dimension),
  ])

  return NextResponse.json({ kills, stats })
}
