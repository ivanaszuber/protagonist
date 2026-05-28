'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { ALL_DIMENSIONS, type Dimension } from '@/lib/character'
import { DIMENSION_TO_SLUG } from '@/lib/tierName'
import type { UserProfile } from '@/app/api/user-profile/route'
import type { IdentityData } from '@/app/api/identity/synthesize/route'

// ── Constants ─────────────────────────────────────────────────────────────────

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

const AREA_ORDER: Dimension[] = ['family', 'career', 'wealth', 'love', 'social', 'vitality', 'mind']

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

const metaLabel: CSSProperties = {
  color: 'rgba(255,255,255,0.38)',
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '1.7px',
  textTransform: 'uppercase' as const,
  display: 'block',
  marginBottom: 8,
}

const PILL_COLORS: Record<string, string> = {
  blue:   '#4DC4FF',
  green:  '#6EE7A4',
  purple: '#C4A8FF',
  orange: '#FF9A5C',
  amber:  '#FFD47A',
}

const IDENTITY_CACHE_KEY = (uid: string) => `protagonist-identity-${uid}`
const IDENTITY_CACHE_TTL = 12 * 60 * 60 * 1000
const PROFILE_CACHE_KEY  = (uid: string) => `protagonist-profile-${uid}`
const PROFILE_CACHE_TTL  = 60 * 60 * 1000 // 1 hour

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface DesktopLeftSidebarProps {
  scores: Partial<Record<Dimension, number>>
  activeDimension?: Dimension
  showBackButton?: boolean
  userInitial?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DesktopLeftSidebar({
  scores,
  activeDimension,
  showBackButton = false,
  userInitial = 'I',
}: DesktopLeftSidebarProps) {
  const router = useRouter()

  // ── Local data state ───────────────────────────────────────────────────────
  const [profile, setProfile]   = useState<UserProfile | null>(null)
  const [identity, setIdentity] = useState<IdentityData | null>(null)

  useEffect(() => {
    const userId = document.cookie
      .split('; ')
      .find(r => r.startsWith('protagonist_user_id='))
      ?.split('=')[1]
    if (!userId) return

    // ── Load profile ──
    try {
      const cp = localStorage.getItem(PROFILE_CACHE_KEY(userId))
      if (cp) {
        const p = JSON.parse(cp) as UserProfile & { cachedAt?: number }
        if (Date.now() - (p.cachedAt ?? 0) < PROFILE_CACHE_TTL) { setProfile(p); }
        else localStorage.removeItem(PROFILE_CACHE_KEY(userId))
      }
    } catch { /* ignore */ }

    fetch(`/api/user-profile?userId=${userId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { profile?: UserProfile } | null) => {
        if (d?.profile) {
          const toCache = { ...d.profile, cachedAt: Date.now() }
          try { localStorage.setItem(PROFILE_CACHE_KEY(userId), JSON.stringify(toCache)) } catch { /* ignore */ }
          setProfile(d.profile)
        }
      })
      .catch(() => {/* silent */})

    // ── Load identity ──
    try {
      const ci = localStorage.getItem(IDENTITY_CACHE_KEY(userId))
      if (ci) {
        const id = JSON.parse(ci) as IdentityData & { cachedAt?: number }
        if (Date.now() - (id.cachedAt ?? 0) < IDENTITY_CACHE_TTL && id.chapterTitle) setIdentity(id)
        else localStorage.removeItem(IDENTITY_CACHE_KEY(userId))
      }
    } catch { /* ignore */ }

    fetch(`/api/identity/synthesize?userId=${userId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: IdentityData | null) => {
        if (d?.chapterTitle) {
          const toCache = { ...d, cachedAt: Date.now() }
          try { localStorage.setItem(IDENTITY_CACHE_KEY(userId), JSON.stringify(toCache)) } catch { /* ignore */ }
          setIdentity(d)
        }
      })
      .catch(() => {/* silent */})
  }, [])

  // ── Derived values ─────────────────────────────────────────────────────────
  const scoreValues     = ALL_DIMENSIONS.map(d => scores[d] ?? 0)
  const lifeScoreNum    = scoreValues.reduce((a, b) => a + b, 0) / Math.max(scoreValues.filter(Boolean).length, 1)
  const lifeScoreDisplay = lifeScoreNum.toFixed(1)

  const RING_R       = 40
  const circumference = 2 * Math.PI * RING_R
  const ringOffset    = circumference * (1 - Math.min(lifeScoreNum / 10, 1))

  const scored   = AREA_ORDER.map(dim => ({ dim, score: scores[dim] ?? 0 })).sort((a, b) => b.score - a.score)
  const maxScore = scored[0]?.score ?? -1
  const minScore = scored[scored.length - 1]?.score ?? -1

  // ── Helpers ────────────────────────────────────────────────────────────────

  const divider = (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '10px -16px' }} />
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      ...font,
      width: 272, minWidth: 272,
      height: '100vh',
      position: 'sticky',
      top: 0,
      background: '#1A1335',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      padding: '18px 16px 20px',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', overflowX: 'hidden',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(123,63,228,0.3) transparent',
      boxSizing: 'border-box',
    }}>

      {/* ── Back button ── */}
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
        <>
          {/* ── Life score ring ── */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <svg width="96" height="96" viewBox="0 0 96 96" style={{ display: 'block', margin: '0 auto 4px' }}>
              <circle cx="48" cy="48" r={RING_R} fill="none" stroke="rgba(123,63,228,0.18)" strokeWidth="6"/>
              <circle
                cx="48" cy="48" r={RING_R} fill="none" stroke="#7B3FE4" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={ringOffset}
                transform="rotate(-90 48 48)"
                style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
              />
              <circle cx="48" cy="48" r="33" fill="#130E2A"/>
              <text x="48" y="57" textAnchor="middle" fill="white" fontSize="28" fontWeight="700" fontFamily="Space Grotesk, sans-serif">{lifeScoreDisplay}</text>
            </svg>
            <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 9, fontWeight: 600, letterSpacing: '1.8px', marginBottom: 4 }}>LIFE SCORE</div>
            <div style={{ color: 'white', fontSize: 15, fontWeight: 600, letterSpacing: -0.3 }}>
              {profile?.displayName || 'Ivana'}
            </div>
          </div>

          {/* ── Life facts ── */}
          {(profile?.location || profile?.age || profile?.familyInfo || profile?.financialStatus) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginBottom: 10 }}>
              {profile?.location && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.48)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    <circle cx="12" cy="9" r="2.5"/>
                  </svg>
                  {profile.location}
                </span>
              )}
              {profile?.age && (
                <><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>·</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.48)' }}>{profile.age}</span></>
              )}
              {profile?.familyInfo && (
                <><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>·</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.48)', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="rgba(255,107,157,0.8)" stroke="none">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  {profile.familyInfo}
                </span></>
              )}
              {profile?.financialStatus && (
                <><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>·</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>{profile.financialStatus}</span></>
              )}
            </div>
          )}

          {/* ── Archetypes ── */}
          {(profile?.enneagram || profile?.sunSign || profile?.neurodivergentNotes) && (
            <>
              {divider}
              <span style={metaLabel}>Archetypes</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                {profile?.enneagram && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 9px',
                    background: 'rgba(255,212,122,0.08)', border: '1px solid rgba(255,212,122,0.18)', borderRadius: 8,
                  }}>
                    <span style={{
                      width: 17, height: 17, borderRadius: '50%',
                      background: 'rgba(255,212,122,0.18)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: '#FFD47A', flexShrink: 0,
                    }}>
                      {profile.enneagram.charAt(0)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#FFD47A' }}>{profile.enneagram}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 1 }}>Achiever-Artist</span>
                  </div>
                )}
                {(profile?.sunSign || profile?.risingSign) && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 9px',
                    background: 'rgba(255,154,92,0.07)', border: '1px solid rgba(255,154,92,0.18)', borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 12, flexShrink: 0, lineHeight: 1 }}>
                      {profile?.sunSign === 'Aries' ? '♈' :
                       profile?.sunSign === 'Taurus' ? '♉' :
                       profile?.sunSign === 'Gemini' ? '♊' :
                       profile?.sunSign === 'Cancer' ? '♋' :
                       profile?.sunSign === 'Leo' ? '♌' :
                       profile?.sunSign === 'Virgo' ? '♍' :
                       profile?.sunSign === 'Libra' ? '♎' :
                       profile?.sunSign === 'Scorpio' ? '♏' :
                       profile?.sunSign === 'Sagittarius' ? '♐' :
                       profile?.sunSign === 'Capricorn' ? '♑' :
                       profile?.sunSign === 'Aquarius' ? '♒' :
                       profile?.sunSign === 'Pisces' ? '♓' : '★'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#FF9A5C' }}>
                      {profile?.sunSign || ''}{profile?.sunSign ? ' Sun' : ''}
                    </span>
                    {profile?.risingSign && (
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                        {profile.risingSign === 'Aries' ? '♈' :
                         profile.risingSign === 'Taurus' ? '♉' :
                         profile.risingSign === 'Gemini' ? '♊' :
                         profile.risingSign === 'Cancer' ? '♋' :
                         profile.risingSign === 'Leo' ? '♌' :
                         profile.risingSign === 'Virgo' ? '♍' :
                         profile.risingSign === 'Libra' ? '♎' :
                         profile.risingSign === 'Scorpio' ? '♏' :
                         profile.risingSign === 'Sagittarius' ? '♐' :
                         profile.risingSign === 'Capricorn' ? '♑' :
                         profile.risingSign === 'Aquarius' ? '♒' :
                         profile.risingSign === 'Pisces' ? '♓' : ''} {profile.risingSign} Rising
                      </span>
                    )}
                  </div>
                )}
                {profile?.neurodivergentNotes && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 9px',
                    background: 'rgba(196,168,255,0.07)', border: '1px solid rgba(196,168,255,0.18)', borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 11, flexShrink: 0, color: '#C4A8FF' }}>✦</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#C4A8FF' }}>{profile.neurodivergentNotes}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Character pills ── */}
          {identity && (identity.strengths?.length > 0 || identity.growthEdges?.length > 0) && (
            <>
              {divider}
              <span style={metaLabel}>Character</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
                {identity.strengths?.slice(0, 4).map((pill, i) => {
                  const c = PILL_COLORS[pill.color] ?? '#C4A8FF'
                  return (
                    <span key={i} title={pill.label} style={{
                      fontSize: 9, fontWeight: 600,
                      background: `${c}14`, color: c,
                      border: `1px solid ${c}28`,
                      padding: '3px 7px', borderRadius: 100,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' as const,
                    }}>{pill.label}</span>
                  )
                })}
                {identity.growthEdges?.slice(0, 2).map((pill, i) => (
                  <span key={`g${i}`} title={pill.label} style={{
                    fontSize: 9, fontWeight: 600,
                    background: 'rgba(255,212,122,0.1)', color: '#FFD47A',
                    border: '1px solid rgba(255,212,122,0.22)',
                    padding: '3px 7px', borderRadius: 100,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' as const,
                  }}>△ {pill.label}</span>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Life Areas ── */}
      {divider}
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
                padding: '5px 8px',
                marginLeft: -8, marginRight: -8,
                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                borderRadius: 8,
                background: isActive ? `${color}12` : 'transparent',
                borderLeft: isActive ? `3px solid ${color}` : '3px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
            >
              <RobotChar dim={dim} color={color} />
              <span style={{ color, fontSize: 12, fontWeight: isActive ? 600 : 500, flex: 1, opacity: isActive ? 1 : 0.85 }}>
                {CATEGORY_LABELS[dim]}
              </span>
              {isTop && <span style={{ fontSize: 10, color: '#4DC4FF', fontWeight: 700, lineHeight: 1 }}>↑</span>}
              {isBot && <span style={{ fontSize: 10, color: '#FF6B9D', fontWeight: 700, lineHeight: 1 }}>↓</span>}
              <span style={{
                color, fontSize: 14, fontWeight: 700,
                background: isActive ? `${color}22` : 'rgba(255,255,255,0.06)',
                padding: '2px 7px', borderRadius: 5,
                minWidth: 28, textAlign: 'center',
                display: 'inline-block',
              }}>
                {score > 0 ? score : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
