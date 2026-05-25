'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { DimensionNavIcon } from '@/components/DimensionNavIcon'
import { CHARACTERS, type Dimension } from '@/lib/character'
import { getPinnedDimensions } from '@/lib/pinnedDimensions'
import { DIMENSION_TO_SLUG } from '@/lib/tierName'
import { getLevel } from '@/lib/xp'
import { getUserId } from '@/lib/user'

interface MainQuestRow {
  dimension: string
  xp?: number
}

function CharacterNavSlot({
  dimension,
  slotIndex,
  level,
  pathname,
}: {
  dimension: Dimension
  slotIndex: number
  level: number
  pathname: string
}) {
  const router = useRouter()
  const char = CHARACTERS[dimension]
  const slug = DIMENSION_TO_SLUG[dimension]
  const href = `/${slug}`
  const isActive = pathname === href || pathname.startsWith(`${href}/`)
  const longPressedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function handlePointerDown() {
    longPressedRef.current = false
    clearTimer()
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true
      router.push(`/settings?editSlot=${slotIndex}`)
    }, 500)
  }

  function handlePointerUp() {
    clearTimer()
  }

  function handleClick(e: React.MouseEvent) {
    if (longPressedRef.current) {
      e.preventDefault()
      longPressedRef.current = false
    }
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        textDecoration: 'none',
        position: 'relative',
        padding: '4px 8px',
        touchAction: 'manipulation',
      }}
      aria-label={`${char.name}. Long press to change pinned character.`}
    >
      <DimensionNavIcon dimension={dimension} active={isActive} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{ fontSize: 10, color: isActive ? char.color : '#6A5A8A' }}>{char.name}</span>
        <span style={{ fontSize: 8, color: isActive ? char.color : '#6A5A8A', opacity: 0.7 }}>
          {level}
        </span>
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
            background: char.color,
          }}
        />
      )}
    </Link>
  )
}

export default function BottomNav() {
  const pathname = usePathname()
  const [pinned, setPinned] = useState<[Dimension, Dimension, Dimension]>([
    'career',
    'social',
    'wealth',
  ])
  const [levels, setLevels] = useState<Record<Dimension, number>>({
    career: 1,
    social: 1,
    wealth: 1,
    vitality: 1,
    mind: 1,
    love: 1,
    family: 1,
  })

  useEffect(() => {
    setPinned(getPinnedDimensions())
  }, [pathname])

  useEffect(() => {
    const uid = getUserId()
    fetch(`/api/quests/main?userId=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((data: { quests?: MainQuestRow[] }) => {
        const map: Record<Dimension, number> = {
          career: 1,
          social: 1,
          wealth: 1,
          vitality: 1,
          mind: 1,
          love: 1,
          family: 1,
        }
        for (const quest of data.quests ?? []) {
          const dim = quest.dimension as Dimension
          if (dim in map) {
            map[dim] = getLevel(quest.xp ?? 0)
          }
        }
        setLevels(map)
      })
      .catch(() => {})
  }, [pathname])

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
      <Link
        href="/dashboard"
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
        {(() => {
          const isActive =
            pathname === '/dashboard' || pathname.startsWith('/dashboard/')
          return (
            <>
              <svg width="24" height="26" viewBox="0 0 28 30" fill="none">
                <circle
                  cx="4"
                  cy="12"
                  r="2.2"
                  fill={isActive ? '#ef4444' : '#6A5A8A'}
                  opacity={isActive ? 0.85 : 0.35}
                />
                <circle
                  cx="14"
                  cy="8"
                  r="2.2"
                  fill={isActive ? '#22c55e' : '#6A5A8A'}
                  opacity={isActive ? 0.85 : 0.35}
                />
                <circle
                  cx="24"
                  cy="12"
                  r="2.2"
                  fill={isActive ? '#60a5fa' : '#6A5A8A'}
                  opacity={isActive ? 0.85 : 0.35}
                />
                <path d="M4 12 L8 6 L14 10 L20 6 L24 12Z" fill={isActive ? '#5A3A8A' : '#2D1B55'} />
                <rect x="3" y="10" width="22" height="17" rx="6" fill={isActive ? '#9333EA' : '#2D1B55'} />
                <line
                  x1="7"
                  y1="16"
                  x2="21"
                  y2="16"
                  stroke={isActive ? '#C084FC' : '#6A5A8A'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity={isActive ? 0.7 : 0.4}
                />
                <line
                  x1="7"
                  y1="21"
                  x2="17"
                  y2="21"
                  stroke={isActive ? '#C084FC' : '#6A5A8A'}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity={isActive ? 0.45 : 0.25}
                />
                <line
                  x1="7"
                  y1="25"
                  x2="13"
                  y2="25"
                  stroke={isActive ? '#C084FC' : '#6A5A8A'}
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity={isActive ? 0.3 : 0.15}
                />
              </svg>
              <span style={{ fontSize: 10, color: isActive ? '#C084FC' : '#6A5A8A' }}>Home</span>
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
                    background: '#C084FC',
                  }}
                />
              )}
            </>
          )
        })()}
      </Link>

      {pinned.map((dim, i) => (
        <CharacterNavSlot
          key={`${dim}-${i}`}
          dimension={dim}
          slotIndex={i}
          level={levels[dim]}
          pathname={pathname}
        />
      ))}

      <Link
        href="/tasks"
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
        {(() => {
          const isActive = pathname === '/tasks' || pathname.startsWith('/tasks/')
          return (
            <>
              <svg width="20" height="22" viewBox="0 0 24 26" fill="none">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="20"
                  rx="4"
                  fill={isActive ? 'rgba(147,51,234,0.15)' : 'transparent'}
                  stroke={isActive ? '#9333EA' : '#2D1B55'}
                  strokeWidth="1.2"
                />
                <rect x="8" y="1" width="8" height="4" rx="2" fill={isActive ? '#9333EA' : '#2D1B55'} />
                <circle cx="7.5" cy="10" r="1.5" fill={isActive ? '#9333EA' : '#6A5A8A'} />
                <line
                  x1="10.5"
                  y1="10"
                  x2="18"
                  y2="10"
                  stroke={isActive ? '#9333EA' : '#6A5A8A'}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <circle
                  cx="7.5"
                  cy="15"
                  r="1.5"
                  fill={isActive ? '#C084FC' : '#6A5A8A'}
                  opacity={isActive ? 0.7 : 0.5}
                />
                <line
                  x1="10.5"
                  y1="15"
                  x2="16"
                  y2="15"
                  stroke={isActive ? '#C084FC' : '#6A5A8A'}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity={isActive ? 0.7 : 0.5}
                />
                <circle
                  cx="7.5"
                  cy="20"
                  r="1.5"
                  fill={isActive ? '#C084FC' : '#6A5A8A'}
                  opacity={isActive ? 0.4 : 0.3}
                />
                <line
                  x1="10.5"
                  y1="20"
                  x2="14"
                  y2="20"
                  stroke={isActive ? '#C084FC' : '#6A5A8A'}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity={isActive ? 0.4 : 0.3}
                />
              </svg>
              <span style={{ fontSize: 10, color: isActive ? '#9333EA' : '#6A5A8A' }}>Tasks</span>
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
                    background: '#9333EA',
                  }}
                />
              )}
            </>
          )
        })()}
      </Link>
    </nav>
  )
}
