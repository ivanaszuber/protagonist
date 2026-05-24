'use client'

import { useEffect, useState, useCallback } from 'react'
import { getUserId } from '@/lib/user'

interface ActionItem {
  subject: string
  from: string
  urgency: 'high' | 'medium' | 'low'
  snippet: string
}

interface GmailDigest {
  unread_count: number
  needs_reply_count: number
  action_items: ActionItem[]
  arc_summary: string
}

const urgencyDot = {
  high: '#f87171',
  medium: '#fbbf24',
  low: 'rgba(255,255,255,0.2)',
}

export default function GmailWidget() {
  const [digest, setDigest] = useState<GmailDigest | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const checkAndSync = useCallback(async () => {
    const userId = getUserId()
    setSyncing(true)
    try {
      const statusRes = await fetch(
        `/api/gmail/sync?userId=${encodeURIComponent(userId)}`
      )
      const status = await statusRes.json()

      if (status.needsReauth) {
        setConnected(false)
        setNeedsReauth(true)
        return
      }

      if (!status.connected) {
        setConnected(false)
        setNeedsReauth(false)
        return
      }

      setConnected(true)

      const syncRes = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const syncData = await syncRes.json()

      if (syncData.needsReauth) {
        setNeedsReauth(true)
        setConnected(false)
        return
      }

      if (syncData.digest) {
        setDigest(syncData.digest)
      } else if (status.digest) {
        setDigest(status.digest)
      }
    } catch (err) {
      console.error('Gmail widget error:', err)
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    void checkAndSync()
  }, [checkAndSync])

  function reconnectGoogle() {
    const userId = getUserId()
    window.location.href = `/api/calendar/connect?userId=${encodeURIComponent(userId)}`
  }

  const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    marginBottom: 24,
  }

  if (connected === null || syncing) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>📧</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#9B8EC4' }}>Inbox</span>
          <span
            style={{
              fontSize: 11,
              color: '#6B5E8C',
              marginLeft: 'auto',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          >
            syncing...
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 40,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>📧</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#9B8EC4' }}>Inbox</span>
        </div>
        <p style={{ fontSize: 12, color: '#6B5E8C', marginBottom: 12, lineHeight: 1.5 }}>
          {needsReauth
            ? 'Gmail needs re-authorization — click to reconnect Google.'
            : 'Connect Google to let the Oracle see your inbox and surface what needs attention.'}
        </p>
        <button
          type="button"
          onClick={reconnectGoogle}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(90deg, #dc2626, #f97316)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {needsReauth ? 'Reconnect Google' : 'Connect Gmail'}
        </button>
      </div>
    )
  }

  if (!digest || digest.unread_count === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📧</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#F0ECFF' }}>Inbox</span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#6EE7A4',
              marginLeft: 'auto',
            }}
            title="Connected"
          />
        </div>
        <p style={{ fontSize: 12, color: '#6EE7A4', marginTop: 8, fontWeight: 600 }}>
          ✓ Inbox zero — you&apos;re clear.
        </p>
      </div>
    )
  }

  const highUrgency = digest.action_items.filter((i) => i.urgency === 'high')
  const visibleItems = expanded ? digest.action_items : digest.action_items.slice(0, 3)

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>📧</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#F0ECFF' }}>Inbox</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 'auto',
          }}
        >
          {highUrgency.length > 0 && (
            <span
              style={{
                fontSize: 11,
                background: 'rgba(248, 113, 113, 0.2)',
                color: '#f87171',
                padding: '2px 8px',
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              {highUrgency.length} urgent
            </span>
          )}
          <span style={{ fontSize: 11, color: '#6B5E8C' }}>{digest.unread_count} unread</span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#6EE7A4',
            }}
            title="Connected"
          />
        </div>
      </div>

      {digest.needs_reply_count > 0 && (
        <p style={{ fontSize: 12, color: '#fbbf24', marginBottom: 12, fontWeight: 600 }}>
          ↩ {digest.needs_reply_count} thread{digest.needs_reply_count > 1 ? 's' : ''} waiting
          for your reply
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleItems.map((item, i) => (
          <div
            key={`${item.subject}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.05)',
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                marginTop: 6,
                flexShrink: 0,
                background: urgencyDot[item.urgency],
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#9B8EC4',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.from}
                </span>
                {item.urgency === 'high' && (
                  <span style={{ fontSize: 11, color: '#f87171', flexShrink: 0 }}>urgent</span>
                )}
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: '#9B8EC4',
                  margin: '2px 0 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.subject}
              </p>
              {item.snippet && (
                <p
                  style={{
                    fontSize: 11,
                    color: '#6B5E8C',
                    margin: '2px 0 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.snippet}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {digest.action_items.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '4px 0',
            border: 'none',
            background: 'transparent',
            fontSize: 12,
            color: '#6B5E8C',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {expanded ? 'Show less' : `+${digest.action_items.length - 3} more`}
        </button>
      )}
    </div>
  )
}
