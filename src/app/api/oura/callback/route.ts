import { NextResponse } from 'next/server'
import { exchangeOuraCode } from '@/lib/oura'
import { saveOuraTokens } from '@/lib/db'

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl()}/quests?oura=error`)
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      userId: string
    }
    const tokens = await exchangeOuraCode(code)
    await saveOuraTokens(userId, tokens)

    return NextResponse.redirect(`${appUrl()}/quests?oura=connected`)
  } catch (err) {
    console.error('Oura callback error:', err)
    return NextResponse.redirect(`${appUrl()}/quests?oura=error`)
  }
}
