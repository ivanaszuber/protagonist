import { NextResponse } from 'next/server'
import { getGoogleAuthUrl, isGoogleConfigured } from '@/lib/google'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/quests?calendar=error`
    )
  }

  const state = Buffer.from(JSON.stringify({ userId })).toString('base64url')
  const authUrl = getGoogleAuthUrl(state)
  return NextResponse.redirect(authUrl)
}
