'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { getLevel } from '@/lib/xp'
import { getUserId } from '@/lib/user'

interface NavLevels {
  career: number
  social: number
  wealth: number
}

interface MainQuestRow {
  dimension: string
  xp?: number
}

type NavItem =
  | {
      href: string
      label: string
      color?: string
      level?: number
      icon: (active: boolean) => ReactNode
    }
  | {
      href: string
      label: string
      icon: (active: boolean) => ReactNode
    }

export default function BottomNav() {
  const pathname = usePathname()
  const [levels, setLevels] = useState<NavLevels>({ career: 1, social: 1, wealth: 1 })

  useEffect(() => {
    const uid = getUserId()
    fetch(`/api/quests/main?userId=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((data: { quests?: MainQuestRow[] }) => {
        const map: NavLevels = { career: 1, social: 1, wealth: 1 }
        for (const quest of data.quests ?? []) {
          if (quest.dimension === 'career') map.career = getLevel(quest.xp ?? 0)
          if (quest.dimension === 'social') map.social = getLevel(quest.xp ?? 0)
          if (quest.dimension === 'wealth') map.wealth = getLevel(quest.xp ?? 0)
        }
        setLevels(map)
      })
      .catch(() => {})
  }, [pathname])

  const navItems: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Home',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M3 9L10 3L17 9V17H13V13H7V17H3V9Z"
            stroke={active ? '#C084FC' : '#6A5A8A'}
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      ),
    },
    {
      href: '/forge',
      label: 'Forge',
      color: '#EF9F27',
      level: levels.career,
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="4" stroke={active ? '#EF9F27' : '#6A5A8A'} strokeWidth="1.5" />
          <path
            d="M6 12Q10 10 14 12L15 19H5Z"
            stroke={active ? '#EF9F27' : '#6A5A8A'}
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M13 15L15 13L17 15"
            stroke={active ? '#EF9F27' : '#6A5A8A'}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      ),
    },
    {
      href: '/echo',
      label: 'Echo',
      color: '#F0997B',
      level: levels.social,
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="4" stroke={active ? '#F0997B' : '#6A5A8A'} strokeWidth="1.5" />
          <path
            d="M6 12Q10 10 14 12L15 19H5Z"
            stroke={active ? '#F0997B' : '#6A5A8A'}
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M15 8Q17 10 15 13"
            fill="none"
            stroke={active ? '#F0997B' : '#6A5A8A'}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      href: '/vault',
      label: 'Vault',
      color: '#1D9E75',
      level: levels.wealth,
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="4" stroke={active ? '#1D9E75' : '#6A5A8A'} strokeWidth="1.5" />
          <path
            d="M6 12Q10 10 14 12L15 19H5Z"
            stroke={active ? '#1D9E75' : '#6A5A8A'}
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
          <circle
            cx="10"
            cy="3"
            r="2"
            fill={active ? '#FAC775' : 'none'}
            stroke={active ? '#FAC775' : '#6A5A8A'}
            strokeWidth="1"
          />
        </svg>
      ),
    },
  ]

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(13,8,32,0.96)',
        backdropFilter: 'blur(12px)',
        borderTop: '0.5px solid rgba(255,255,255,0.07)',
        padding: '8px 0 calc(24px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        justifyContent: 'space-around',
        zIndex: 50,
      }}
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`)
        const accent = 'color' in item ? item.color : '#C084FC'
        const level = 'level' in item ? item.level : undefined

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              textDecoration: 'none',
              position: 'relative',
              padding: '4px 8px',
            }}
          >
            {item.icon(isActive)}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span
                style={{
                  fontSize: 10,
                  color: isActive ? accent : '#6A5A8A',
                }}
              >
                {item.label}
              </span>
              {level !== undefined && (
                <span
                  style={{
                    fontSize: 8,
                    color: isActive ? accent : '#6A5A8A',
                    opacity: 0.7,
                  }}
                >
                  {level}
                </span>
              )}
            </div>
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: accent,
                }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
