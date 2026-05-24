'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', emoji: '🏠' },
  { href: '/quests', label: 'Quests', emoji: '⚔️' },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: 'rgba(13, 8, 32, 0.95)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 48,
          maxWidth: 480,
          margin: '0 auto',
          padding: '10px 24px 12px',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                textDecoration: 'none',
                color: active ? '#F0ECFF' : '#6B5E8C',
                transition: 'color 0.2s',
              }}
            >
              <span style={{ fontSize: 22 }}>{item.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
