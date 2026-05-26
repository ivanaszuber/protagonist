import { NextResponse } from 'next/server'
import { getOuraTokens } from '@/lib/db'

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ connected: false })
  }

  const tokens = await getOuraTokens(userId)
  return NextResponse.json({
    connected: Boolean(tokens?.access_token),
  })
}
