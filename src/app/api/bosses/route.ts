import { NextResponse } from 'next/server'
import { createBoss, getActiveBoss, type CreateBossPayload } from '@/lib/bosses'
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

export async function POST(request: Request) {
  const body = await request.json()
  const { userId, dimension, ...payload } = body as {
    userId: string
    dimension: string
  } & CreateBossPayload

  if (!userId || !dimension) {
    return NextResponse.json({ error: 'userId and dimension required' }, { status: 400 })
  }
  if (!VALID_DIMENSIONS.has(dimension)) {
    return NextResponse.json({ error: 'Invalid dimension' }, { status: 400 })
  }
  if (!isQuestDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const existing = await getActiveBoss(userId, dimension)
  if (existing) {
    return NextResponse.json({ error: 'Active boss already exists' }, { status: 409 })
  }

  if (!payload.name || !payload.deadline || !payload.hp_total || !payload.tasks?.length) {
    return NextResponse.json({ error: 'Missing boss fields' }, { status: 400 })
  }

  try {
    const boss = await createBoss(userId, dimension, payload)
    return NextResponse.json({ boss })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create boss'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
