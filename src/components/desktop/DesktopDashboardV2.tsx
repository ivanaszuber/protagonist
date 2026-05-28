'use client'

import React, { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { ALL_DIMENSIONS, type Dimension } from '@/lib/character'
import { DIMENSION_TO_SLUG } from '@/lib/tierName'
import { getLevel, getLevelProgress } from '@/lib/xp'
import { openOracle } from '@/lib/oracle-events'
import type { DesktopDashboardProps } from './DesktopDashboard'

// ── Extended props ────────────────────────────────────────────────────────────

export interface DesktopDashboardV2Props extends DesktopDashboardProps {
  /**
   * Map of date-string (YYYY-MM-DD) → completed task count for the week.
   * Used to power the Weekly Progress bars. Optional — bars show empty if absent.
   */
  weeklyTaskCounts?: Record<string, number>
  /** Single letter shown in the user avatar circle (top-right). Defaults to 'I'. */
  userInitial?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<Dimension, string> = {
  career:   'Career',
  social:   'Friends',
  wealth:   'Finances',
  vitality: 'Body',
  mind:     'Mind',
  love:     'Relationship',
  family:   'Family',
}

const DIM_COLORS: Record<Dimension, string> = {
  family:   '#C4A8FF',  // lavender
  career:   '#FFD47A',  // gold
  wealth:   '#4DC4FF',  // sky blue
  vitality: '#FF9A5C',  // orange
  mind:     '#7B3FE4',  // deep purple
  love:     '#FF6B9D',  // hot pink
  social:   '#1EEFB8',  // teal
}

/** Fixed display order for life areas */
const AREA_ORDER: Dimension[] = ['family', 'career', 'wealth', 'love', 'social', 'vitality', 'mind']

const MOOD_OPTIONS_V2 = [
  { value: 1, color: '#E57373', label: 'Rough' },
  { value: 2, color: '#FF9A5C', label: 'Low' },
  { value: 3, color: '#FFB347', label: 'Meh' },
  { value: 4, color: '#6EE7A4', label: 'Good' },
  { value: 5, color: '#00D4B8', label: 'Great' },
] as const

const CSS_ANIMATIONS = `
  @keyframes v2-float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
  @keyframes v2-pulse-dot{ 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:0.75} }
  @keyframes v2-pulse-btn{ 0%,100%{box-shadow:0 0 0 0 rgba(255,122,101,0.4)} 50%{box-shadow:0 0 0 8px rgba(255,122,101,0)} }
  @keyframes v2-orb-a    { from{transform:rotate(0deg) translateX(38px) rotate(0deg)}    to{transform:rotate(360deg) translateX(38px) rotate(-360deg)} }
  @keyframes v2-orb-b    { from{transform:rotate(130deg) translateX(38px) rotate(-130deg)} to{transform:rotate(490deg) translateX(38px) rotate(-490deg)} }
  @keyframes v2-orb-c    { from{transform:rotate(250deg) translateX(38px) rotate(-250deg)} to{transform:rotate(610deg) translateX(38px) rotate(-610deg)} }
  @keyframes v2-twinkle  { 0%,100%{opacity:0.1} 50%{opacity:0.65} }
  @keyframes v2-score-pop{ 0%{transform:scale(0.75);opacity:0} 60%{transform:scale(1.12);opacity:1} 100%{transform:scale(1);opacity:1} }
  @keyframes v2-sparkle  { 0%,100%{opacity:0;transform:scale(0.4) rotate(0deg)} 40%,60%{opacity:1;transform:scale(1) rotate(45deg)} }
  ::-webkit-scrollbar { display: none; }
`

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMoodTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `logged today at ${time}`
  const dayStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return `logged ${dayStr} at ${time}`
}

function xpScore(xp: number): number {
  const level = getLevel(xp)
  const progress = getLevelProgress(xp)
  return Math.min(10, Math.max(1, Math.round(level * 1.5 + progress)))
}

function getDimScore(xp: number, baseline?: number): number {
  if (baseline != null) return baseline
  return xpScore(xp)
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getTomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RobotChar({ dim, color }: { dim: Dimension; color: string }) {
  // Unique top accessory per dimension
  const accessory: React.ReactNode = (() => {
    switch (dim) {
      case 'family':
        // branches
        return <>
          <line x1="12" y1="7" x2="12" y2="2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
          <line x1="12" y1="4" x2="9"  y2="1" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="12" y1="4" x2="15" y2="1" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
        </>
      case 'career':
        // antenna + circle
        return <>
          <line x1="12" y1="7" x2="12" y2="2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="12" cy="1.5" r="1.5" fill={color}/>
        </>
      case 'wealth':
        // coin with $
        return <>
          <circle cx="12" cy="2.5" r="2.5" fill={color} opacity="0.9"/>
          <text x="12" y="4" textAnchor="middle" fill="#130E2A" fontSize="3" fontWeight="700" fontFamily="sans-serif">$</text>
        </>
      case 'love':
        // heart
        return <path d="M10 5 C10 3.5 8 2 8 3.5 C8 5 10 6.5 12 8 C14 6.5 16 5 16 3.5 C16 2 14 3.5 14 5 C13 4 12 3 12 3 C12 3 11 4 10 5Z" fill={color} transform="scale(0.7) translate(5,-2)"/>
      case 'social':
        // waves
        return <path d="M8 4 Q10 2 12 4 Q14 6 16 4" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      case 'vitality':
        // flame
        return <path d="M12 7 C11 5 9 4 10 2 C10.5 3 11.5 3.5 12 2 C12.5 3.5 13.5 3 14 2 C15 4 13 5 12 7Z" fill={color} opacity="0.9"/>
      case 'mind':
        // hat
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
      {/* Accessory */}
      {accessory}
      {/* Body */}
      <rect x="2" y="7" width="20" height="16" rx="4" fill={color}/>
      {/* Left eye outer */}
      <rect x="4" y="10" width="7" height="7" rx="2.5" fill="#130E2A"/>
      {/* Right eye outer */}
      <rect x="13" y="10" width="7" height="7" rx="2.5" fill="#130E2A"/>
      {/* Shine L */}
      <circle cx="6.5" cy="12" r="1.8" fill="white" opacity="0.9"/>
      {/* Shine R */}
      <circle cx="15.5" cy="12" r="1.8" fill="white" opacity="0.9"/>
      {/* Pupil L */}
      <circle cx="7.8" cy="13.2" r="1.1" fill="#130E2A"/>
      {/* Pupil R */}
      <circle cx="16.8" cy="13.2" r="1.1" fill="#130E2A"/>
      {/* Smile */}
      <path d="M9 20 Q12 22 15 20" stroke="#130E2A" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      {/* Left leg */}
      <rect x="5" y="24" width="5" height="7" rx="2.5" fill={color} opacity="0.8"/>
      {/* Right leg */}
      <rect x="14" y="24" width="5" height="7" rx="2.5" fill={color} opacity="0.8"/>
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DesktopDashboardV2(props: DesktopDashboardV2Props) {
  const {
    vitality, vitalityLoading,
    moodScore,
    moodLoggedAt,
    verdict,
    quests, dimXpMap, dimBaselineMap,
    todayItems, todayLoading, selectedDate, todayDate, weekStart,
    expandedTaskId, editingTaskId, editTaskTitle,
    justCompletedIds, pickerTaskId,
    onMoodSelect, onCompleteTask, onExpandTask, onReschedule, onDelete,
    onStartEdit, onEditTitleChange, onCancelEdit, onSaveEdit,
    onPickerToggle, onDateSelect, onWeekBack, onWeekForward,
    weeklyTaskCounts = {},
    userInitial = 'I',
  } = props

  const router = useRouter()
  const starsRef    = useRef<HTMLDivElement>(null)
  const sparklesRef = useRef<HTMLDivElement>(null)

  const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }
  const colScroll: CSSProperties = { overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }
  const metaLabel: CSSProperties = {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '1.6px',
    textTransform: 'uppercase' as const,
    display: 'block',
    marginBottom: 10,
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const todayStr       = toDateStr(todayDate)
  const selectedDateStr = toDateStr(selectedDate)
  const isToday        = selectedDateStr === todayStr

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  // Life score: average of all 7 dimension scores
  const allScores = ALL_DIMENSIONS.map(dim => {
    const xp = Math.max(dimXpMap[dim] ?? 0, quests.find(q => q.dimension === dim)?.xp ?? 0)
    return getDimScore(xp, dimBaselineMap[dim])
  })
  const lifeScoreNum = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0
  const lifeScoreDisplay = lifeScoreNum.toFixed(1)

  // Ring gauge
  const RING_R = 46
  const circumference = 2 * Math.PI * RING_R
  const ringOffset = circumference * (1 - Math.min(lifeScoreNum / 10, 1))

  // Today's items split
  const calendarEvents = todayItems.filter(i => i.type === 'event')
  const taskItems      = todayItems.filter(i => i.type === 'task')

  // Weekly progress (Mon–Fri of the current week)
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const weeklyData = weekDays.slice(0, 5).map((d, i) => {
    const ds = toDateStr(d)
    return {
      label:    DAY_LABELS[i],
      dateStr:  ds,
      count:    weeklyTaskCounts[ds] ?? 0,
      isToday:  ds === todayStr,
    }
  })
  const maxCount = Math.max(...weeklyData.map(w => w.count), 5)

  // Mood helpers
  const moodOption   = MOOD_OPTIONS_V2.find(m => m.value === moodScore)
  const moodLabel    = moodOption?.label ?? ''
  const moodColor    = moodOption?.color ?? 'rgba(255,255,255,0.25)'

  // Oracle insight
  const oracleInsight = verdict?.text ?? 'Complete your morning check-in to receive today\'s insight.'

  // ── Starfield ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const container = starsRef.current
    if (!container) return
    container.innerHTML = ''
    for (let i = 0; i < 55; i++) {
      const star = document.createElement('div')
      const size  = (Math.random() * 1.8 + 0.8).toFixed(1)
      const dur   = (1.5 + Math.random() * 3).toFixed(1)
      const delay = (Math.random() * 4).toFixed(1)
      star.style.cssText =
        `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:white;` +
        `left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;` +
        `animation:v2-twinkle ${dur}s ease-in-out ${delay}s infinite;`
      container.appendChild(star)
    }
  }, [])

  // ── Sparkles ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const container = sparklesRef.current
    if (!container) return
    container.innerHTML = ''
    // Discrete positions (% of container) — corners and edges only
    const positions = [
      { x: 4, y: 8 }, { x: 21, y: 11 }, { x: 7, y: 17 }, { x: 18, y: 22 },
      { x: 36, y: 6 }, { x: 55, y: 12 }, { x: 42, y: 20 }, { x: 28, y: 8 },
    ]
    positions.forEach(({ x, y }) => {
      const size  = 10 + Math.random() * 6
      const dur   = (2.5 + Math.random() * 2.5).toFixed(1)
      const delay = (Math.random() * 5).toFixed(1)
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      el.setAttribute('width', String(size))
      el.setAttribute('height', String(size))
      el.setAttribute('viewBox', '0 0 20 20')
      el.style.cssText =
        `position:absolute;left:${x}%;top:${y}%;` +
        `animation:v2-sparkle ${dur}s ease-in-out ${delay}s infinite;` +
        `pointer-events:none;opacity:0;`
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', 'M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z')
      path.setAttribute('fill', 'white')
      el.appendChild(path)
      container.appendChild(el)
    })
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{CSS_ANIMATIONS}</style>

      <div style={{ ...font, background: '#0D0820', minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

        {/* Starfield */}
        <div ref={starsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />

        {/* Sparkles */}
        <div ref={sparklesRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />

        {/* ══════════════════ TOP NAV ══════════════════ */}
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
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF7A65', animation: 'v2-pulse-dot 2.5s ease-in-out infinite' }} />
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15, letterSpacing: -0.3 }}>Protagonist</span>
          </div>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ background: '#7B3FE4', color: 'white', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
              Dashboard
            </div>
            <button type="button" onClick={() => router.push('/characters')}
              style={{ color: 'rgba(255,255,255,0.6)', padding: '6px 14px', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', ...font }}>
              Life Areas
            </button>
            <button type="button" onClick={() => router.push('/journal')}
              style={{ color: 'rgba(255,255,255,0.6)', padding: '6px 14px', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', ...font }}>
              Journal
            </button>
          </div>

          <div style={{ flex: 1 }} />

          {/* Morning Check-In */}
          <button
            type="button"
            onClick={() => openOracle('', 'morning_checkin')}
            style={{
              background: '#FF7A65', color: 'white', padding: '9px 22px',
              borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              marginRight: 12, border: 'none',
              animation: 'v2-pulse-btn 3s ease-in-out infinite',
              letterSpacing: 0.1, ...font,
            }}
          >
            Morning Check-In
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
            fontSize: 13, fontWeight: 600, color: 'white', flexShrink: 0,
          }}>
            {userInitial}
          </div>
        </nav>

        {/* ══════════════════ THREE COLUMNS ══════════════════ */}
        <div style={{ position: 'relative', zIndex: 5, display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* ═══════ LEFT PANEL ═══════ */}
          <div style={{
            ...colScroll,
            width: 248, minWidth: 248,
            background: '#1A1335',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            padding: '20px 16px',
            display: 'flex', flexDirection: 'column',
          }}>

            {/* Identity + Life Score ring */}
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

            {/* Life Areas — sorted by score descending */}
            <span style={metaLabel}>Life Areas</span>
            <div>
              {(() => {
                const scored = AREA_ORDER.map(dim => {
                  const xp    = Math.max(dimXpMap[dim] ?? 0, quests.find(q => q.dimension === dim)?.xp ?? 0)
                  const score = getDimScore(xp, dimBaselineMap[dim])
                  return { dim, score }
                }).sort((a, b) => b.score - a.score)
                const maxScore = scored[0]?.score ?? -1
                const minScore = scored[scored.length - 1]?.score ?? -1
                return scored.map(({ dim, score }, i) => {
                  const color  = DIM_COLORS[dim]
                  const isLast = i === scored.length - 1
                  const isTop  = score === maxScore
                  const isBot  = score === minScore && score !== maxScore
                  return (
                    <div
                      key={dim}
                      role="button" tabIndex={0}
                      onClick={() => router.push(`/${DIMENSION_TO_SLUG[dim]}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/${DIMENSION_TO_SLUG[dim]}`) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 4px',
                        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <RobotChar dim={dim} color={color} />
                      <span style={{ color, fontSize: 12, fontWeight: 500, flex: 1 }}>{CATEGORY_LABELS[dim]}</span>
                      {isTop && <span style={{ fontSize: 10, color: '#4DC4FF', fontWeight: 700, lineHeight: 1 }}>↑</span>}
                      {isBot && <span style={{ fontSize: 10, color: '#FF6B9D', fontWeight: 700, lineHeight: 1 }}>↓</span>}
                      <span
                        key={score}
                        style={{
                          color, fontSize: 15, fontWeight: 700,
                          background: 'rgba(255,255,255,0.06)',
                          padding: '2px 8px', borderRadius: 6,
                          minWidth: 30, textAlign: 'center',
                          display: 'inline-block',
                          animation: 'v2-score-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
                        }}
                      >
                        {score}
                      </span>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* ═══════ CENTER PANEL ═══════ */}
          <div style={{ ...colScroll, flex: 1, padding: '26px 28px 20px', minWidth: 0 }}>

            {/* Greeting — always visible */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 26, fontWeight: 300, lineHeight: 1.1 }}>
                Good morning,
              </div>
              <div style={{ color: '#FF7A65', fontSize: 40, fontStyle: 'italic', fontWeight: 700, lineHeight: 1.05 }}>
                Ivana.
              </div>
              {!isToday && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                  Viewing {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                </div>
              )}
            </div>

            {/* Week strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 18 }}>
              <button type="button" onClick={onWeekBack}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 20, cursor: 'pointer', padding: '0 6px', lineHeight: 1, ...font }}>
                ‹
              </button>
              <div style={{ display: 'flex', flex: 1, gap: 3 }}>
                {weekDays.map((d) => {
                  const ds         = toDateStr(d)
                  const isSelected = ds === selectedDateStr
                  const isT        = ds === todayStr
                  return (
                    <button key={ds} type="button" onClick={() => onDateSelect(d)}
                      style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        padding: '7px 2px', borderRadius: 10,
                        background: isSelected ? '#7B3FE4' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isSelected ? 'rgba(123,63,228,0.8)' : 'rgba(255,255,255,0.07)'}`,
                        cursor: 'pointer', ...font,
                      }}
                    >
                      <span style={{ color: isSelected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: 500, letterSpacing: 0.6 }}>
                        {d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase().slice(0, 3)}
                      </span>
                      <span style={{ color: isSelected ? 'white' : isT ? '#E8E0F0' : 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: isSelected ? 700 : 400 }}>
                        {d.getDate()}
                      </span>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? 'white' : isT ? '#A87EF8' : 'transparent' }} />
                    </button>
                  )
                })}
              </div>
              <button type="button" onClick={onWeekForward}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 20, cursor: 'pointer', padding: '0 6px', lineHeight: 1, ...font }}>
                ›
              </button>
            </div>

            {/* Date label */}
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 500, letterSpacing: '1.4px', marginBottom: 14 }}>
              {selectedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' }).toUpperCase()}
            </div>

            {/* Items */}
            {todayLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0.7, 0.9, 0.55].map((w, i) => (
                  <div key={i} style={{ height: 52, borderRadius: 10, background: 'rgba(255,255,255,0.05)', width: `${w * 100}%` }} />
                ))}
              </div>
            ) : (
              <>
                {/* ── Calendar events ── */}
                {calendarEvents.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 600, letterSpacing: '1.4px' }}>CALENDAR</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {calendarEvents.map(ev => {
                        const isPast    = ev.endIso ? new Date(ev.endIso) < new Date() : false
                        const dimColor  = ev.dimension ? DIM_COLORS[ev.dimension] : '#FFD47A'
                        const dimLabel  = ev.dimension ? CATEGORY_LABELS[ev.dimension] : null
                        const timeLabel = ev.time ? (ev.timeEnd ? `${ev.time}–${ev.timeEnd}` : ev.time) : ''
                        return (
                          <div key={ev.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: 'rgba(255,183,77,0.08)', border: '1px solid rgba(255,183,77,0.18)',
                            borderRadius: 10, padding: '10px 14px',
                            opacity: isPast ? 0.5 : 1,
                          }}>
                            {timeLabel && (
                              <div style={{
                                background: 'rgba(255,183,77,0.18)', color: '#FFB74D',
                                fontSize: 11, fontWeight: 600, padding: '3px 8px',
                                borderRadius: 6, whiteSpace: 'nowrap', minWidth: 72, textAlign: 'center',
                              }}>
                                {timeLabel}
                              </div>
                            )}
                            <div style={{ flex: 1, color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: 500 }}>{ev.title}</div>
                            {dimLabel && (
                              <div style={{ background: `${dimColor}18`, color: dimColor, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
                                {dimLabel}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Tasks ── */}
                {taskItems.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round">
                        <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 600, letterSpacing: '1.4px' }}>TASKS</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {taskItems.map(item => {
                        const isCompleted = item.completed || justCompletedIds.has(item.id)
                        const isExpanded  = expandedTaskId === item.id
                        const isEditing   = editingTaskId === item.id
                        const dimColor    = item.dimension ? DIM_COLORS[item.dimension] : 'rgba(168,126,248,0.5)'
                        const dimLabel    = item.dimension ? CATEGORY_LABELS[item.dimension] : null

                        return (
                          <div key={item.id}>
                            <div
                              style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                background: isCompleted ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${isCompleted ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 10, padding: '10px 14px',
                                opacity: isCompleted ? 0.4 : 1,
                                cursor: 'pointer',
                                transition: 'opacity 0.2s',
                              }}
                              onClick={() => { if (!isCompleted) onExpandTask(isExpanded ? null : item.id) }}
                            >
                              {/* Checkbox */}
                              <div
                                style={{
                                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                                  background: isCompleted ? '#7B3FE4' : 'transparent',
                                  border: isCompleted ? 'none' : `1.5px solid ${dimColor}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                                onClick={(e) => { e.stopPropagation(); if (!isCompleted) void onCompleteTask(item) }}
                              >
                                {isCompleted && (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                                  </svg>
                                )}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: 13, fontWeight: 500,
                                  color: isCompleted ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)',
                                  textDecoration: isCompleted ? 'line-through' : 'none',
                                }}>
                                  {item.title}
                                </div>
                                {dimLabel && (
                                  <div style={{ color: dimColor, fontSize: 11, marginTop: 1 }}>{dimLabel}</div>
                                )}
                              </div>
                            </div>

                            {/* Expanded task actions */}
                            {isExpanded && !isCompleted && (
                              <div style={{ paddingLeft: 44, paddingTop: 6, paddingBottom: 4 }}>
                                {isEditing ? (
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                      autoFocus type="text" value={editTaskTitle}
                                      onChange={(e) => onEditTitleChange(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(item.id, editTaskTitle); if (e.key === 'Escape') onCancelEdit() }}
                                      style={{ flex: 1, background: '#0D0820', border: `0.5px solid ${dimColor}60`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'white', outline: 'none', ...font }}
                                    />
                                    <button type="button" onClick={() => onSaveEdit(item.id, editTaskTitle)}
                                      style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: dimColor, color: '#0D0820', fontSize: 11, fontWeight: 700, cursor: 'pointer', ...font }}>
                                      Save
                                    </button>
                                    <button type="button" onClick={onCancelEdit}
                                      style={{ padding: '7px 10px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 16, cursor: 'pointer', ...font }}>
                                      ×
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {[
                                      { label: 'Edit',     action: () => onStartEdit(item.id, item.title),       style: { border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)', background: 'transparent' } as CSSProperties },
                                      { label: 'Tomorrow', action: () => onReschedule(item.id, getTomorrowStr()), style: { border: `0.5px solid ${dimColor}50`, color: dimColor, background: `${dimColor}12` } as CSSProperties },
                                      { label: 'Someday',  action: () => onReschedule(item.id, null),            style: { border: '0.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.38)', background: 'transparent' } as CSSProperties },
                                      { label: 'Delete',   action: () => onDelete(item.id),                      style: { border: '0.5px solid rgba(239,68,68,0.25)', color: '#ef4444', background: 'rgba(239,68,68,0.05)' } as CSSProperties },
                                    ].map(({ label, action, style: s }) => (
                                      <button key={label} type="button"
                                        onClick={(e) => { e.stopPropagation(); action() }}
                                        style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', ...s, ...font }}>
                                        {label}
                                      </button>
                                    ))}
                                    <button type="button"
                                      onClick={(e) => { e.stopPropagation(); onPickerToggle(pickerTaskId === item.id ? null : item.id) }}
                                      style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.38)', background: 'transparent', ...font }}>
                                      Pick date
                                    </button>
                                  </div>
                                )}
                                {pickerTaskId === item.id && (
                                  <input type="date" autoFocus min={getTomorrowStr()}
                                    onChange={(e) => { if (e.target.value) { onPickerToggle(null); onReschedule(item.id, e.target.value) } }}
                                    style={{ marginTop: 8, width: '100%', background: '#0D0820', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'white', outline: 'none', ...font, colorScheme: 'dark', boxSizing: 'border-box' }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {calendarEvents.length === 0 && taskItems.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>Nothing scheduled here.</div>
                    <button type="button" onClick={() => openOracle()}
                      style={{ background: 'rgba(123,63,228,0.1)', border: '0.5px solid rgba(123,63,228,0.3)', borderRadius: 20, color: '#A87EF8', fontSize: 12, padding: '8px 20px', cursor: 'pointer', ...font }}>
                      Ask Oracle to plan your day
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ═══════ RIGHT PANEL ═══════ */}
          <div style={{
            ...colScroll,
            width: 264, minWidth: 264,
            background: '#0F0B1F',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            padding: '18px 16px',
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>

            {/* ── Oracle ── */}
            <div style={{
              background: 'rgba(255,122,101,0.07)',
              border: '1px solid rgba(255,122,101,0.18)',
              borderRadius: 12, padding: '16px 14px',
            }}>
              <span style={{ ...metaLabel, marginBottom: 14 }}>The Oracle · Arc</span>

              {/* Oracle Robot */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <div style={{ position: 'relative', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Orbiting particles */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', margin: -3,   width: 6, height: 6, borderRadius: '50%', background: '#FFB347', animation: 'v2-orb-a 3.5s linear infinite' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', margin: -2.5, width: 5, height: 5, borderRadius: '50%', background: '#00D4B8', animation: 'v2-orb-b 3.5s linear infinite' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', margin: -2,   width: 4, height: 4, borderRadius: '50%', background: '#6EE7A4', animation: 'v2-orb-c 5s   linear infinite' }} />
                  {/* Square robot body — floating */}
                  <svg width="58" height="66" viewBox="0 0 58 66" style={{ animation: 'v2-float 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}>
                    {/* Crown */}
                    <polygon points="16,16 22,6 29,13 36,6 42,16" fill="#FFB347"/>
                    <rect x="14" y="14" width="30" height="3" rx="1.5" fill="#FFB347" opacity="0.7"/>
                    {/* Ear left */}
                    <rect x="1" y="25" width="4" height="8" rx="2" fill="#FF7A65" opacity="0.7"/>
                    {/* Ear right */}
                    <rect x="53" y="25" width="4" height="8" rx="2" fill="#FF7A65" opacity="0.7"/>
                    {/* Body */}
                    <rect x="5" y="17" width="48" height="32" rx="9" fill="#FF7A65"/>
                    {/* Left eye outer */}
                    <rect x="11" y="24" width="14" height="14" rx="4" fill="#130E2A"/>
                    {/* Right eye outer */}
                    <rect x="33" y="24" width="14" height="14" rx="4" fill="#130E2A"/>
                    {/* Shine L */}
                    <circle cx="15" cy="28" r="3" fill="white" opacity="0.9"/>
                    {/* Shine R */}
                    <circle cx="37" cy="28" r="3" fill="white" opacity="0.9"/>
                    {/* Pupil L */}
                    <circle cx="17" cy="30" r="2" fill="#130E2A"/>
                    {/* Pupil R */}
                    <circle cx="39" cy="30" r="2" fill="#130E2A"/>
                    {/* Smile */}
                    <path d="M20 39 Q29 44 38 39" stroke="#130E2A" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                    {/* Left leg */}
                    <rect x="12" y="50" width="12" height="14" rx="5" fill="#FF7A65" opacity="0.85"/>
                    {/* Right leg */}
                    <rect x="34" y="50" width="12" height="14" rx="5" fill="#FF7A65" opacity="0.85"/>
                  </svg>
                </div>
              </div>

              {/* Insight quote */}
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5, fontStyle: 'italic', lineHeight: 1.55, textAlign: 'center', marginBottom: 14 }}>
                &ldquo;{oracleInsight}&rdquo;
              </div>

              {/* Chat button — outline style */}
              <button
                type="button"
                onClick={() => openOracle()}
                style={{ width: '100%', background: 'transparent', color: 'rgba(255,255,255,0.75)', padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 500, border: '1.5px solid rgba(255,255,255,0.2)', cursor: 'pointer', ...font, transition: 'border-color 0.15s, color 0.15s' }}
              >
                Chat with Oracle →
              </button>
            </div>

            {/* ── Biometrics ── */}
            <div>
              <span style={metaLabel}>Biometrics · Oura</span>
              {vitalityLoading ? (
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>Loading…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    { label: 'Sleep',     value: vitality?.sleep_score,     color: '#FFB347' },
                    { label: 'Readiness', value: vitality?.readiness_score, color: '#FFB347' },
                    { label: 'Activity',  value: vitality?.activity_score,  color: '#6EE7A4' },
                  ] as const).map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, width: 58, flexShrink: 0 }}>{label}</span>
                      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${value ?? 0}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease-out' }} />
                      </div>
                      <span style={{ color: (value ?? 0) >= 90 ? color : 'white', fontSize: 12, fontWeight: 700, minWidth: 22, textAlign: 'right' }}>
                        {value != null ? value : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Mood ── */}
            <div>
              <span style={metaLabel}>Mood</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                {MOOD_OPTIONS_V2.map(({ value, color, label }) => {
                  const isSelected = moodScore === value
                  return (
                    <button
                      key={value} type="button"
                      onClick={() => onMoodSelect(value)}
                      title={label}
                      aria-label={`Mood: ${label}`}
                      style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: isSelected ? color : 'rgba(255,255,255,0.04)',
                        border: `2.5px solid ${color}`,
                        opacity: isSelected ? 1 : 0.45,
                        cursor: 'pointer', padding: 0,
                        transition: 'all 0.15s',
                        ...font,
                      }}
                    />
                  )
                })}
              </div>
              <div style={{ fontSize: 11, textAlign: 'center', color: moodScore != null ? moodColor : 'rgba(255,255,255,0.4)' }}>
                {moodScore != null ? moodLabel : 'How are you feeling?'}
              </div>
              {moodLoggedAt && (
                <div style={{ fontSize: 10, textAlign: 'center', color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>
                  {formatMoodTimestamp(moodLoggedAt)}
                </div>
              )}
            </div>

            {/* ── Weekly Progress ── */}
            <div>
              <span style={metaLabel}>Weekly Progress</span>
              <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 9, marginBottom: 10 }}>tasks done / day</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {weeklyData.map(({ label: dayLabel, count, isToday: isDayToday }) => {
                  const pct      = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
                  const barColor = count >= 4 ? '#6EE7A4' : count >= 2 ? '#A87EF8' : count === 1 ? '#FF7A65' : 'rgba(255,255,255,0.06)'
                  return (
                    <div key={dayLabel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: isDayToday ? '#FF7A65' : 'rgba(255,255,255,0.55)', fontSize: 10, width: 24, fontWeight: isDayToday ? 600 : 400 }}>
                        {dayLabel}
                      </span>
                      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                      </div>
                      <span style={{ color: count > 0 ? (isDayToday ? '#FF7A65' : 'rgba(255,255,255,0.45)') : 'rgba(255,255,255,0.12)', fontSize: 10, minWidth: 8, textAlign: 'right' }}>
                        {count > 0 ? count : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

    </>
  )
}
