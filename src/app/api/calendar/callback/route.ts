import { NextResponse } from 'next/server'
import { exchangeGoogleCode } from '@/lib/google'
import { saveGoogleTokens } from '@/lib/db'

export async function GET(request: Request) {
  const baseUrl = new URL(request.url).origin
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/quests?calendar=error`)
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      userId: string
    }
    const tokens = await exchangeGoogleCode(code, baseUrl)
    await saveGoogleTokens(userId, tokens)

    const response = NextResponse.redirect(`${baseUrl}/quests?calendar=connected`)
    response.cookies.set('protagonist_user_id', userId, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
    })
    return response
  } catch (err) {
    console.error('Google Calendar callback error:', err)
    return NextResponse.redirect(`${baseUrl}/quests?calendar=error`)
  }
}
