'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { ALL_DIMENSIONS, type Dimension } from '@/lib/character'
import { DIMENSION_TO_SLUG } from '@/lib/tierName'

// ── Constants (shared with DesktopDashboardV2) ────────────────────────────────

export const DIM_COLORS: Record<Dimension, string> = {
  family:   '#C4A8FF',
  career:   '#FFD47A',
  wealth:   '#4DC4FF',
  vitality: '#FF9A5C',
  mind:     '#7B3FE4',
  love:     '#FF6B9D',
  social:   '#1EEFB8',
}

const CATEGORY_LABELS: Record<Dimension, string> = {
  career:   'Career',
  social:   'Friends',
  wealth:   'Finances',
  vitality: 'Body',
  mind:     'Mind',
  love:     'Relationship',
  family:   'Family',
}

/** Fixed display order */
const AREA_ORDER: Dimension[] = ['family', 'career', 'wealth', 'love', 'social', 'vitality', 'mind']

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

const metaLabel: CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '1.6px',
  textTransform: 'uppercase' as const,
  display: 'block',
  marginBottom: 10,
}

// ── Robot SVG ─────────────────────────────────────────────────────────────────

export function RobotChar({ dim, color }: { dim: Dimension; color: string }) {
  const accessory: React.ReactNode = (() => {
    switch (dim) {
      case 'family':
        return <>
          <line x1="12" y1="7" x2="12" y2="2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
          <line x1="12" y1="4" x2="9"  y2="1" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="12" y1="4" x2="15" y2="1" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
        </>
      case 'career':
        return <>
          <line x1="12" y1="7" x2="12" y2="2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="12" cy="1.5" r="1.5" fill={color}/>
        </>
      case 'wealth':
        return <>
          <circle cx="12" cy="2.5" r="2.5" fill={color} opacity="0.9"/>
          <text x="12" y="4" textAnchor="middle" fill="#130E2A" fontSize="3" fontWeight="700" fontFamily="sans-serif">$</text>
        </>
      case 'love':
        return <path d="M10 5 C10 3.5 8 2 8 3.5 C8 5 10 6.5 12 8 C14 6.5 16 5 16 3.5 C16 2 14 3.5 14 5 C13 4 12 3 12 3 C12 3 11 4 10 5Z" fill={color} transform="scale(0.7) translate(5,-2)"/>
      case 'social':
        return <path d="M8 4 Q10 2 12 4 Q14 6 16 4" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      case 'vitality':
        return <path d="M12 7 C11 5 9 4 10 2 C10.5 3 11.5 3.5 12 2 C12.5 3.5 13.5 3 14 2 C15 4 13 5 12 7Z" fill={color} opacity="0.9"/>
      case 'mind':
        return <>
          <polygon points="8,7 16,7 14,3 10,3" fill={color} opacity="0.9"/>
          <rect x="7" y="6.5" width="10" height="1.5" rx="0.75" fill={color}/>
        </>
      default:
        return null
    }
  })()

  return (
    <svg width="26" height="32" viewBox="0 0 24 32" style={{ flexShrink: 0 }}>
      {accessory}
      <rect x="2"  y="7"  width="20" height="16" rx="4" fill={color}/>
      <rect x="4"  y="10" width="7"  height="7"  rx="2.5" fill="#130E2A"/>
      <rect x="13" y="10" width="7"  height="7"  rx="2.5" fill="#130E2A"/>
      <circle cx="6.5"  cy="12" r="1.8" fill="white" opacity="0.9"/>
      <circle cx="15.5" cy="12" r="1.8" fill="white" opacity="0.9"/>
      <circle cx="7.8"  cy="13.2" r="1.1" fill="#130E2A"/>
      <circle cx="16.8" cy="13.2" r="1.1" fill="#130E2A"/>
      <path d="M9 20 Q12 22 15 20" stroke="#130E2A" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <rect x="5"  y="24" width="5" height="7" rx="2.5" fill={color} opacity="0.8"/>
      <rect x="14" y="24" width="5" height="7" rx="2.5" fill={color} opacity="0.8"/>
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DesktopLeftSidebarProps {
  /**
   * Pre-computed scores per dimension (value 1–10).
   * Used to render the score pills and sort life areas.
   */
  scores: Partial<Record<Dimension, number>>
  /** Which dimension is currently active (highlighted). Omit on the dashboard. */
  activeDimension?: Dimension
  /**
   * When true, shows a "← Dashboard" back-navigation button instead of the
   * Life Score ring + identity block. Use on all nested pages.
   */
  showBackButton?: boolean
  /** Single letter for the avatar circle. Defaults to 'I'. */
  userInitial?: string
}

export function DesktopLeftSidebar({
  scores,
  activeDimension,
  showBackButton = false,
  userInitial = 'I',
}: DesktopLeftSidebarProps) {
  const router = useRouter()

  // Life score: average of all known dimension scores
  const scoreValues = ALL_DIMENSIONS.map(d => scores[d] ?? 0)
  const lifeScoreNum = scoreValues.reduce((a, b) => a + b, 0) / Math.max(scoreValues.filter(Boolean).length, 1)
  const lifeScoreDisplay = lifeScoreNum.toFixed(1)

  // Ring gauge
  const RING_R = 46
  const circumference = 2 * Math.PI * RING_R
  const ringOffset = circumference * (1 - Math.min(lifeScoreNum / 10, 1))

  // Sort life areas by score descending
  const scored = AREA_ORDER.map(dim => ({ dim, score: scores[dim] ?? 0 }))
    .sort((a, b) => b.score - a.score)
  const maxScore = scored[0]?.score ?? -1
  const minScore = scored[scored.length - 1]?.score ?? -1

  return (
    <div style={{
      ...font,
      width: 248, minWidth: 248,
      background: '#1A1335',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      padding: '20px 16px',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
      scrollbarWidth: 'none',
    }}>

      {/* ── Top section: back button OR life score ring ── */}
      {showBackButton ? (
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          style={{
            ...font,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', padding: '4px 0', marginBottom: 22,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Dashboard
        </button>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <svg width="110" height="110" viewBox="0 0 110 110" style={{ display: 'block', margin: '0 auto 2px' }}>
            <circle cx="55" cy="55" r={RING_R} fill="none" stroke="rgba(123,63,228,0.15)" strokeWidth="6" />
            <circle
              cx="55" cy="55" r={RING_R} fill="none" stroke="#7B3FE4" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 55 55)"
              style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
            />
            <circle cx="55" cy="55" r="38" fill="#130E2A" />
            <text x="55" y="66" textAnchor="middle" fill="white" fontSize="36" fontWeight="700" fontFamily="Space Grotesk, sans-serif">{lifeScoreDisplay}</text>
          </svg>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 500, letterSpacing: '1.8px', marginBottom: 8 }}>LIFE SCORE</div>
          <div style={{ color: 'white', fontSize: 16, fontWeight: 600, letterSpacing: -0.3 }}>Ivana</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2, letterSpacing: 0.3 }}>The Protagonist</div>
        </div>
      )}

      {/* ── Life Areas list ── */}
      <span style={metaLabel}>Life Areas</span>
      <div>
        {scored.map(({ dim, score }, i) => {
          const color    = DIM_COLORS[dim]
          const isLast   = i === scored.length - 1
          const isTop    = score === maxScore && score > 0
          const isBot    = score === minScore && score !== maxScore && score > 0
          const isActive = dim === activeDimension
          const slug     = DIMENSION_TO_SLUG[dim]

          return (
            <div
              key={dim}
              role="button" tabIndex={0}
              onClick={() => router.push(`/${slug}`)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') router.push(`/${slug}`) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px',
                marginLeft: -8, marginRight: -8,
                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                borderRadius: 8,
                background: isActive ? `${color}12` : 'transparent',
                borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
            >
              <RobotChar dim={dim} color={color} />
              <span style={{ color: isActive ? color : color, fontSize: 12, fontWeight: isActive ? 600 : 500, flex: 1, opacity: isActive ? 1 : 0.85 }}>
                {CATEGORY_LABELS[dim]}
              </span>
              {isTop && <span style={{ fontSize: 10, color: '#4DC4FF', fontWeight: 700, lineHeight: 1 }}>↑</span>}
              {isBot && <span style={{ fontSize: 10, color: '#FF6B9D', fontWeight: 700, lineHeight: 1 }}>↓</span>}
              <span
                style={{
                  color, fontSize: 15, fontWeight: 700,
                  background: isActive ? `${color}22` : 'rgba(255,255,255,0.06)',
                  padding: '2px 8px', borderRadius: 6,
                  minWidth: 30, textAlign: 'center',
                  display: 'inline-block',
                }}
              >
                {score > 0 ? score : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
