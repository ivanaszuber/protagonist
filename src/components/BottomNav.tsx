'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { DimensionNavIcon } from '@/components/DimensionNavIcon'
import { CHARACTERS, type Dimension } from '@/lib/character'
import { getPinnedDimensions } from '@/lib/pinnedDimensions'
import { DIMENSION_TO_SLUG } from '@/lib/tierName'

function CharacterNavSlot({
  dimension,
  slotIndex,
  pathname,
}: {
  dimension: Dimension
  slotIndex: number
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
      <span style={{ fontSize: 10, color: isActive ? char.color : '#6A5A8A' }}>{char.name}</span>
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
  useEffect(() => {
    setPinned(getPinnedDimensions())
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
          pathname={pathname}
        />
      ))}

      <Link
        href="/brief"
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
          const isActive = pathname === '/brief' || pathname.startsWith('/brief/')
          return (
            <>
              {/* Oracle orb: concentric rings + sparkle centre */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke={isActive ? '#9333EA' : '#2D1B55'}
                  strokeWidth="0.8"
                  opacity={isActive ? 0.35 : 0.5}
                />
                <circle
                  cx="12"
                  cy="12"
                  r="7"
                  stroke={isActive ? '#9333EA' : '#2D1B55'}
                  strokeWidth="0.8"
                  opacity={isActive ? 0.55 : 0.5}
                />
                <circle
                  cx="12"
                  cy="12"
                  r="4.5"
                  fill={isActive ? 'rgba(147,51,234,0.2)' : '#1A0F35'}
                  stroke={isActive ? '#9333EA' : '#3D2878'}
                  strokeWidth="0.8"
                />
                <path
                  d="M12 9.5 L12.5 11.5 L14.5 12 L12.5 12.5 L12 14.5 L11.5 12.5 L9.5 12 L11.5 11.5 Z"
                  fill={isActive ? '#C084FC' : '#6A5A8A'}
                  opacity={isActive ? 1 : 0.6}
                />
              </svg>
              <span style={{ fontSize: 10, color: isActive ? '#C084FC' : '#6A5A8A' }}>Brief</span>
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
