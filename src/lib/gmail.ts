// Gmail API v1 integration — reads inbox, extracts action items

const GMAIL_BASE = 'https://www.googleapis.com/gmail/v1'

export interface GmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  fromName: string
  snippet: string
  date: string
  isUnread: boolean
  needsReply: boolean
  labelIds: string[]
}

export interface GmailDigest {
  unread_count: number
  needs_reply_count: number
  action_items: Array<{
    subject: string
    from: string
    urgency: 'high' | 'medium' | 'low'
    snippet: string
  }>
  arc_summary: string
}

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>
}

interface GmailHeader {
  name: string
  value: string
}

interface GmailMessageResponse {
  id: string
  threadId: string
  snippet?: string
  labelIds?: string[]
  payload?: {
    headers?: GmailHeader[]
  }
}

export async function fetchGmailMessages(accessToken: string): Promise<GmailMessage[]> {
  const headers = { Authorization: `Bearer ${accessToken}` }

  const query = 'in:inbox is:unread newer_than:2d -category:promotions -category:social'
  const listRes = await fetch(
    `${GMAIL_BASE}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
    { headers }
  )

  if (!listRes.ok) {
    const err = await listRes.text()
    throw new Error(`Gmail list failed: ${err}`)
  }

  const listData = (await listRes.json()) as GmailListResponse
  const messages = listData.messages ?? []

  if (messages.length === 0) return []

  const messageDetails = await Promise.allSettled(
    messages.slice(0, 15).map(async (msg) => {
      const res = await fetch(
        `${GMAIL_BASE}/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date&metadataHeaders=In-Reply-To`,
        { headers }
      )
      if (!res.ok) return null
      return res.json() as Promise<GmailMessageResponse>
    })
  )

  const result: GmailMessage[] = []

  for (const detail of messageDetails) {
    if (detail.status !== 'fulfilled' || !detail.value) continue
    const msg = detail.value

    const headerMap: Record<string, string> = {}
    for (const h of msg.payload?.headers ?? []) {
      headerMap[h.name.toLowerCase()] = h.value
    }

    const fromRaw = headerMap['from'] ?? ''
    const fromName = fromRaw.match(/^([^<]+)</)?.[1]?.trim() ?? fromRaw.split('@')[0]
    const fromEmail = fromRaw.match(/<([^>]+)>/)?.[1] ?? fromRaw

    const labelIds: string[] = msg.labelIds ?? []
    const isUnread = labelIds.includes('UNREAD')
    const needsReply = isUnread && !headerMap['in-reply-to'] && labelIds.includes('INBOX')

    result.push({
      id: msg.id,
      threadId: msg.threadId,
      subject: headerMap['subject'] ?? '(No subject)',
      from: fromEmail,
      fromName: fromName || fromEmail,
      snippet: (msg.snippet ?? '').substring(0, 150),
      date: headerMap['date'] ?? '',
      isUnread,
      needsReply,
      labelIds,
    })
  }

  return result
}

export function buildGmailContext(digest: GmailDigest): string {
  if (digest.unread_count === 0) {
    return 'Inbox: Clear — no unread emails needing attention.'
  }

  const lines: string[] = [
    `Inbox: ${digest.unread_count} unread, ${digest.needs_reply_count} need${digest.needs_reply_count === 1 ? 's' : ''} a reply`,
  ]

  if (digest.action_items.length > 0) {
    lines.push('\nEmails needing action:')
    for (const item of digest.action_items.slice(0, 5)) {
      const urgencyTag =
        item.urgency === 'high' ? '🔴' : item.urgency === 'medium' ? '🟡' : '⚪'
      lines.push(`  ${urgencyTag} From ${item.from}: "${item.subject}"`)
      if (item.snippet) lines.push(`     "${item.snippet.substring(0, 80)}..."`)
    }
  }

  return lines.join('\n')
}

export function classifyUrgency(msg: GmailMessage): 'high' | 'medium' | 'low' {
  const subject = msg.subject.toLowerCase()
  const snippet = msg.snippet.toLowerCase()
  const combined = `${subject} ${snippet}`

  const highKeywords = [
    'urgent',
    'asap',
    'immediately',
    'critical',
    'deadline today',
    'by eod',
    'emergency',
    'action required',
    'response needed',
  ]
  const mediumKeywords = [
    'follow up',
    'reminder',
    'please review',
    'your input',
    'waiting on you',
    'decision needed',
    'approval',
  ]

  if (highKeywords.some((k) => combined.includes(k))) return 'high'
  if (mediumKeywords.some((k) => combined.includes(k))) return 'medium'
  if (msg.needsReply) return 'medium'
  return 'low'
}
