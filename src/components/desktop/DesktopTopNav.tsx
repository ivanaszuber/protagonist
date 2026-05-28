'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { openOracle } from '@/lib/oracle-events'
import { isCheckinDoneToday } from './DesktopOracleModal'

export type NavPage = 'dashboard' | 'character' | 'journal'

interface DesktopTopNavProps {
  activePage: NavPage
  userInitial?: string
  /** extra CSS for the pulse-dot animation keyframe name (default v2-pulse-dot/btn) */
  animPrefix?: string
}

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

function SettingsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06
        a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
        A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83
        l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
        A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83
        l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
        a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83
        l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
        a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export default function DesktopTopNav({
  activePage,
  userInitial = 'I',
  animPrefix = 'v2',
}: DesktopTopNavProps) {
  const router = useRouter()
  const [checkinDone, setCheckinDone] = useState(() => isCheckinDoneToday())

  useEffect(() => {
    const handler = () => setCheckinDone(true)
    window.addEventListener('protagonist:checkin-done', handler)
    return () => window.removeEventListener('protagonist:checkin-done', handler)
  }, [])

  const links: { label: string; page: NavPage; href: string }[] = [
    { label: 'Dashboard', page: 'dashboard', href: '/dashboard' },
    { label: 'Life Areas', page: 'character', href: '/characters' },
    { label: 'Journal', page: 'journal', href: '/journal' },
  ]

  return (
    <nav style={{
      position: 'relative', zIndex: 20,
      display: 'flex', alignItems: 'center', height: 56,
      padding: '0 24px',
      background: '#130E2A',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 2px 20px rgba(0,0,0,0.5)',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 28 }}>
        <div style={{
          width: 9, height: 9, borderRadius: '50%', background: '#FF7A65',
          animation: `${animPrefix}-pulse-dot 2.5s ease-in-out infinite`,
        }} />
        <span style={{ color: 'white', fontWeight: 700, fontSize: 15, letterSpacing: -0.3, ...font }}>
          Protagonist
        </span>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {links.map(({ label, page, href }) => {
          const isActive = activePage === page
          return isActive ? (
            <div
              key={page}
              style={{
                background: '#7B3FE4', color: 'white',
                padding: '6px 14px', borderRadius: 8,
                fontSize: 13, fontWeight: 500, ...font,
              }}
            >
              {label}
            </div>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => router.push(href)}
              style={{
                color: 'rgba(255,255,255,0.6)', padding: '6px 14px', fontSize: 13,
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderRadius: 8, ...font,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Morning Check-In / Daily Brief */}
      <button
        type="button"
        onClick={() => openOracle('', checkinDone ? 'checkin-summary' : 'morning_checkin')}
        style={{
          background: checkinDone ? 'rgba(110,231,164,0.12)' : '#FF7A65',
          color: checkinDone ? '#6EE7A4' : 'white',
          padding: '9px 22px',
          borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          marginRight: 12,
          border: checkinDone ? '1px solid rgba(110,231,164,0.35)' : 'none',
          animation: checkinDone ? 'none' : `${animPrefix}-pulse-btn 3s ease-in-out infinite`,
          letterSpacing: 0.1, ...font,
        }}
      >
        {checkinDone ? '✓ Daily Brief' : 'Morning Check-In'}
      </button>

      {/* Settings */}
      <button
        type="button"
        onClick={() => router.push('/settings')}
        style={{
          width: 34, height: 34, borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', marginRight: 10,
          color: 'rgba(255,255,255,0.45)',
        }}
        aria-label="Settings"
      >
        <SettingsIcon />
      </button>

      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%', background: '#7B3FE4',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 600, color: 'white', flexShrink: 0, ...font,
      }}>
        {userInitial}
      </div>
    </nav>
  )
}
