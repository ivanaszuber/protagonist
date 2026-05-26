'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserId } from '@/lib/user'

interface TopNavProps {
  streakDays?: number
}

interface MenuDrawerProps {
  open: boolean
  onClose: () => void
}

const showDevTools = process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === 'true'

function MenuDrawer({ open, onClose }: MenuDrawerProps) {
  const router = useRouter()
  const userId = getUserId()
  const [ouraConnected, setOuraConnected] = useState<boolean | null>(null)
  const [devResetState, setDevResetState] = useState<'idle' | 'loading' | 'done'>('idle')

  async function handleDevReset() {
    if (devResetState === 'loading') return
    setDevResetState('loading')
    try {
      await fetch('/api/dev/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      setDevResetState('done')
      onClose()
      window.location.reload()
    } catch {
      setDevResetState('idle')
    }
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void fetch(`/api/oura/status?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d: { connected?: boolean }) => {
        if (!cancelled) setOuraConnected(Boolean(d.connected))
      })
      .catch(() => {
        if (!cancelled) setOuraConnected(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, userId])

  if (!open) return null

  const rows = [
    {
      icon: '⚙',
      label: 'Settings',
      onClick: () => {
        onClose()
        router.push('/settings')
      },
      right: <span style={{ color: '#5A4A7A', fontSize: 14 }}>›</span>,
    },
    {
      icon: '💜',
      label: 'Oura Ring',
      onClick: () => {
        if (!ouraConnected) {
          window.location.href = `/api/oura/connect?userId=${encodeURIComponent(userId)}`
        }
      },
      right:
        ouraConnected === null ? (
          <span style={{ fontSize: 10, color: '#5A4A7A' }}>...</span>
        ) : ouraConnected ? (
          <span
            style={{
              fontSize: 10,
              color: '#34d399',
              background: 'rgba(52,211,153,0.12)',
              padding: '3px 8px',
              borderRadius: 6,
            }}
          >
            Connected ✓
          </span>
        ) : (
          <span
            style={{
              fontSize: 10,
              color: '#fb923c',
              background: 'rgba(251,146,60,0.12)',
              padding: '3px 8px',
              borderRadius: 6,
            }}
          >
            Reconnect
          </span>
        ),
    },
    {
      icon: '👤',
      label: 'Profile',
      onClick: () => {},
      right: (
        <span style={{ fontSize: 10, color: '#5A4A7A', fontFamily: 'monospace' }}>
          {userId.slice(0, 8)}...
        </span>
      ),
    },
  ]

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Close menu"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 60,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 61,
          background: '#140C28',
          borderRadius: '20px 20px 0 0',
          borderTop: '0.5px solid #2D1B55',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
      >
        <div
          style={{
            width: 32,
            height: 3,
            background: '#2D1B55',
            borderRadius: 2,
            margin: '12px auto 0',
          }}
        />
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={row.onClick}
            style={{
              width: '100%',
              minHeight: 48,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: '0.5px solid #1E1040',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{row.icon}</span>
            <span style={{ flex: 1, fontSize: 14, color: '#E8E0F0' }}>{row.label}</span>
            {row.right}
          </button>
        ))}
        {showDevTools && (
          <button
            key="dev-reset"
            type="button"
            onClick={() => void handleDevReset()}
            style={{
              width: '100%',
              minHeight: 48,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 20px',
              background: 'transparent',
              border: 'none',
              borderTop: '0.5px solid #3B0010',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>🗑</span>
            <span style={{ flex: 1, fontSize: 14, color: '#ef4444' }}>Dev: Reset all data</span>
            {devResetState === 'loading' && (
              <span style={{ fontSize: 10, color: '#5A4A7A' }}>Resetting...</span>
            )}
            {devResetState === 'done' && (
              <span style={{ fontSize: 10, color: '#34d399' }}>Done ✓</span>
            )}
          </button>
        )}
      </div>
    </>
  )
}

export function TopNav({ streakDays = 0 }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: '#110A22',
          borderBottom: '0.5px solid #2D1B55',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 40,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#5A4A7A' }}>{dateLabel}</span>
          <>
            <span style={{ fontSize: 10, color: '#3D2D55' }}>·</span>
            <span style={{ fontSize: 10, color: '#fb923c' }}>🔥 {Math.max(1, streakDays)}d</span>
          </>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            aria-label="Notifications"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'default',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3C9.5 3 7.5 5 7.5 7.5V11L5 14.5V16H19V14.5L16.5 11V7.5C16.5 5 14.5 3 12 3Z"
                stroke="#5A4A7A"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M10 18C10 19.1 10.9 20 12 20C13.1 20 14 19.1 14 18" stroke="#5A4A7A" strokeWidth="1.5" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            style={{
              width: 28,
              height: 28,
              background: '#1A0D40',
              border: '0.5px solid #4A2080',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  display: 'block',
                  width: 12,
                  height: 1.5,
                  background: '#C084FC',
                  borderRadius: 1,
                }}
              />
            ))}
          </button>
        </div>
      </header>

      <MenuDrawer open={menuOpen} onClose={closeMenu} />
    </>
  )
}
