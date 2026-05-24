import { NextResponse } from 'next/server'
import { exchangeGoogleCode } from '@/lib/google'
import { saveGoogleTokens } from '@/lib/db'

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl()}/quests?calendar=error`)
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      userId: string
    }
    const tokens = await exchangeGoogleCode(code)
    await saveGoogleTokens(userId, tokens)
    return NextResponse.redirect(`${appUrl()}/quests?calendar=connected`)
  } catch (err) {
    console.error('Google Calendar callback error:', err)
    return NextResponse.redirect(`${appUrl()}/quests?calendar=error`)
  }
}
