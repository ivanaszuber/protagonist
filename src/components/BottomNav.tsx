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
        <svg width="24" height="26" viewBox="0 0 28 30" fill="none">
          <circle
            cx="4"
            cy="12"
            r="2.2"
            fill={active ? '#ef4444' : '#6A5A8A'}
            opacity={active ? 0.85 : 0.35}
          />
          <circle
            cx="14"
            cy="8"
            r="2.2"
            fill={active ? '#22c55e' : '#6A5A8A'}
            opacity={active ? 0.85 : 0.35}
          />
          <circle
            cx="24"
            cy="12"
            r="2.2"
            fill={active ? '#60a5fa' : '#6A5A8A'}
            opacity={active ? 0.85 : 0.35}
          />
          <path d="M4 12 L8 6 L14 10 L20 6 L24 12Z" fill={active ? '#5A3A8A' : '#2D1B55'} />
          <rect x="3" y="10" width="22" height="17" rx="6" fill={active ? '#9333EA' : '#2D1B55'} />
          <line
            x1="7"
            y1="16"
            x2="21"
            y2="16"
            stroke={active ? '#C084FC' : '#6A5A8A'}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={active ? 0.7 : 0.4}
          />
          <line
            x1="7"
            y1="21"
            x2="17"
            y2="21"
            stroke={active ? '#C084FC' : '#6A5A8A'}
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity={active ? 0.45 : 0.25}
          />
          <line
            x1="7"
            y1="25"
            x2="13"
            y2="25"
            stroke={active ? '#C084FC' : '#6A5A8A'}
            strokeWidth="1"
            strokeLinecap="round"
            opacity={active ? 0.3 : 0.15}
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
        <svg width="24" height="22" viewBox="0 0 28 26" fill="none">
          <circle
            cx="24"
            cy="5"
            r="2.8"
            fill={active ? '#EF9F27' : '#6A5A8A'}
            opacity={active ? 0.7 : 0.4}
          />
          <circle
            cx="21"
            cy="2"
            r="1.4"
            fill={active ? '#EF9F27' : '#6A5A8A'}
            opacity={active ? 0.45 : 0.25}
          />
          <rect x="2" y="5" width="20" height="16" rx="6" fill={active ? '#EF9F27' : '#2D1B55'} />
          <circle cx="8.5" cy="13" r="4" fill={active ? '#1A0800' : '#1A0D30'} />
          <circle cx="15.5" cy="13" r="4" fill={active ? '#1A0800' : '#1A0D30'} />
          <circle cx="7.2" cy="11.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
          <circle cx="14.2" cy="11.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
        </svg>
      ),
    },
    {
      href: '/echo',
      label: 'Echo',
      color: '#F0997B',
      level: levels.social,
      icon: (active) => (
        <svg width="26" height="22" viewBox="0 0 30 26" fill="none">
          <circle
            cx="25"
            cy="8"
            r="2.2"
            fill={active ? '#F0997B' : '#6A5A8A'}
            opacity={active ? 0.7 : 0.4}
          />
          <rect x="2" y="5" width="20" height="16" rx="6" fill={active ? '#F0997B' : '#2D1B55'} />
          <circle cx="8.5" cy="13" r="4" fill={active ? '#1A0800' : '#1A0D30'} />
          <circle cx="15.5" cy="13" r="4" fill={active ? '#1A0800' : '#1A0D30'} />
          <circle cx="7.2" cy="11.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
          <circle cx="14.2" cy="11.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
          <path
            d="M24 9Q28 13 24 17"
            stroke={active ? '#F0997B' : '#6A5A8A'}
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
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
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
          <circle
            cx="12"
            cy="4"
            r="4"
            fill={active ? '#FAC775' : '#6A5A8A'}
            opacity={active ? 0.95 : 0.4}
          />
          <circle cx="12" cy="4" r="2.5" fill={active ? '#EF9F27' : '#3D2878'} />
          <path
            d="M11.5 2V6M10 4H14.5"
            stroke={active ? '#FAC775' : '#6A5A8A'}
            strokeWidth="1"
            strokeLinecap="round"
          />
          <rect x="2" y="8" width="20" height="16" rx="6" fill={active ? '#1D9E75' : '#2D1B55'} />
          <circle cx="8.5" cy="16" r="4" fill={active ? '#012A1E' : '#1A0D30'} />
          <circle cx="15.5" cy="16" r="4" fill={active ? '#012A1E' : '#1A0D30'} />
          <circle cx="7.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
          <circle cx="14.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
        </svg>
      ),
    },
    {
      href: '/tasks',
      label: 'Tasks',
      icon: (active) => (
        <svg width="20" height="22" viewBox="0 0 24 26" fill="none">
          <rect
            x="3"
            y="3"
            width="18"
            height="20"
            rx="4"
            fill={active ? 'rgba(147,51,234,0.15)' : 'transparent'}
            stroke={active ? '#9333EA' : '#2D1B55'}
            strokeWidth="1.2"
          />
          <rect x="8" y="1" width="8" height="4" rx="2" fill={active ? '#9333EA' : '#2D1B55'} />
          <circle cx="7.5" cy="10" r="1.5" fill={active ? '#9333EA' : '#6A5A8A'} />
          <line
            x1="10.5"
            y1="10"
            x2="18"
            y2="10"
            stroke={active ? '#9333EA' : '#6A5A8A'}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle
            cx="7.5"
            cy="15"
            r="1.5"
            fill={active ? '#C084FC' : '#6A5A8A'}
            opacity={active ? 0.7 : 0.5}
          />
          <line
            x1="10.5"
            y1="15"
            x2="16"
            y2="15"
            stroke={active ? '#C084FC' : '#6A5A8A'}
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity={active ? 0.7 : 0.5}
          />
          <circle
            cx="7.5"
            cy="20"
            r="1.5"
            fill={active ? '#C084FC' : '#6A5A8A'}
            opacity={active ? 0.4 : 0.3}
          />
          <line
            x1="10.5"
            y1="20"
            x2="14"
            y2="20"
            stroke={active ? '#C084FC' : '#6A5A8A'}
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity={active ? 0.4 : 0.3}
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
            <span
              style={{
                fontSize: 10,
                color: isActive ? accent : '#6A5A8A',
              }}
            >
              {item.label}
            </span>
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
