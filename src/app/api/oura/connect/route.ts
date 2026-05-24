import { NextResponse } from 'next/server'
import { getOuraAuthUrl } from '@/lib/oura'

export async function GET(request: Request) {
  const baseUrl = new URL(request.url).origin
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const state = Buffer.from(JSON.stringify({ userId, baseUrl })).toString('base64url')
  const authUrl = getOuraAuthUrl(state, baseUrl)

  return NextResponse.redirect(authUrl)
}
