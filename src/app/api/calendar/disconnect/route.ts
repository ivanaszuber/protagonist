import { NextResponse } from 'next/server'
import { deleteGoogleTokens } from '@/lib/db'

export async function POST(request: Request) {
  const { userId } = await request.json() as { userId: string }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  await deleteGoogleTokens(userId)
  return NextResponse.json({ ok: true })
}
