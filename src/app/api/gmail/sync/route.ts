import { NextResponse } from 'next/server'
import {
  fetchGmailMessages,
  classifyUrgency,
  buildGmailContext,
  type GmailDigest,
} from '@/lib/gmail'
import { refreshGoogleTokens } from '@/lib/google'
import {
  getGoogleTokens,
  saveGoogleTokens,
  saveGmailDigest,
  getGmailDigest,
} from '@/lib/db'

export async function POST(request: Request) {
  const { userId } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const stored = await getGoogleTokens(userId)
  if (!stored) {
    return NextResponse.json({ error: 'not_connected', connected: false })
  }

  const scope = stored.scope ?? ''
  if (!scope.includes('gmail')) {
    return NextResponse.json({
      error: 'gmail_not_authorized',
      connected: false,
      needsReauth: true,
    })
  }

  let accessToken = stored.access_token

  const expiresAt = new Date(stored.expires_at)
  if (Date.now() + 5 * 60 * 1000 > expiresAt.getTime()) {
    if (!stored.refresh_token) {
      return NextResponse.json({ error: 'no_refresh_token', connected: false })
    }
    try {
      const newTokens = await refreshGoogleTokens(stored.refresh_token)
      await saveGoogleTokens(userId, newTokens)
      accessToken = newTokens.access_token
    } catch {
      return NextResponse.json({ error: 'token_refresh_failed', connected: false })
    }
  }

  try {
    const messages = await fetchGmailMessages(accessToken)

    const actionItems = messages
      .filter((m) => m.needsReply || classifyUrgency(m) !== 'low')
      .map((m) => ({
        subject: m.subject,
        from: m.fromName,
        urgency: classifyUrgency(m),
        snippet: m.snippet,
      }))
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 }
        return order[a.urgency] - order[b.urgency]
      })

    const digest: GmailDigest = {
      unread_count: messages.filter((m) => m.isUnread).length,
      needs_reply_count: messages.filter((m) => m.needsReply).length,
      action_items: actionItems,
      arc_summary: '',
    }

    digest.arc_summary = buildGmailContext(digest)

    await saveGmailDigest(userId, {
      unread_count: digest.unread_count,
      needs_reply_count: digest.needs_reply_count,
      action_items: digest.action_items,
      arc_summary: digest.arc_summary,
    })

    return NextResponse.json({ success: true, connected: true, digest })
  } catch (err) {
    console.error('Gmail sync error:', err)
    return NextResponse.json({ error: 'sync_failed', connected: true }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const stored = await getGoogleTokens(userId)
  if (!stored) return NextResponse.json({ connected: false })

  const scope = stored.scope ?? ''
  if (!scope.includes('gmail')) {
    return NextResponse.json({ connected: false, needsReauth: true })
  }

  const digest = await getGmailDigest(userId)
  return NextResponse.json({ connected: true, digest })
}
