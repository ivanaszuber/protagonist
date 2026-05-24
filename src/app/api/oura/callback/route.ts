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
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      userId: string
    }
    const tokens = await exchangeOuraCode(code, baseUrl)
    await saveOuraTokens(userId, tokens)
    return NextResponse.redirect(`${baseUrl}/quests?oura=connected`)
  } catch (err) {
    console.error('Oura callback error:', err)
    return NextResponse.redirect(`${baseUrl}/quests?oura=error`)
  }
}
