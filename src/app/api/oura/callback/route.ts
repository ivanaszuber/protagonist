import { NextResponse } from 'next/server'
import { exchangeOuraCode } from '@/lib/oura'
import { saveOuraTokens } from '@/lib/db'

export async function GET(request: Request) {
  const baseUrl = new URL(request.url).origin
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/quests?oura=error`)
  }

  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      userId: string
      baseUrl?: string
    }
    const { userId } = parsed
    const oauthBaseUrl = parsed.baseUrl ?? baseUrl
    const tokens = await exchangeOuraCode(code, oauthBaseUrl)
    await saveOuraTokens(userId, tokens)

    const response = NextResponse.redirect(`${oauthBaseUrl}/quests?oura=connected`)
    response.cookies.set('protagonist_user_id', userId, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
    })
    return response
  } catch (err) {
    console.error('Oura callback error:', err)
    return NextResponse.redirect(`${baseUrl}/quests?oura=error`)
  }
}
