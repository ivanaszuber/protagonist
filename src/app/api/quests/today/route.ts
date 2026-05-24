import { NextResponse } from 'next/server'
import { getTodayQuestsForUser } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const quests = await getTodayQuestsForUser(userId)
  return NextResponse.json({ quests })
}
