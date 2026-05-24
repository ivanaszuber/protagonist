import { NextResponse } from 'next/server'
import { getDimensionXP } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const xp = await getDimensionXP(userId)
  return NextResponse.json({ xp: xp ?? {} })
}
