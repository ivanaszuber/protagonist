import { NextResponse } from 'next/server'
import { fetchMorningContext } from '@/lib/morning-checkin'

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const context = await fetchMorningContext(userId)
  return NextResponse.json(context)
}
