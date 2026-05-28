'use client'

import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import {
  ForgeCharacterLarge,
  EchoCharacterLarge,
  VaultCharacterLarge,
  BlazeCharacterLarge,
  SageCharacterLarge,
  SolCharacterLarge,
  RootCharacterLarge,
} from '@/components/characters/CharacterHeroArt'
import { ALL_DIMENSIONS, CHARACTERS, type Dimension } from '@/lib/character'
import { DIMENSION_TO_SLUG } from '@/lib/tierName'
import { getLevel, getLevelProgress } from '@/lib/xp'
import { openOracle } from '@/lib/oracle-events'

// ── Shared types ─────────────────────────────────────────────────────────────

export interface VitalityData {
  hp: number
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
  cycle_day: number | null
  cycle_phase: string | null
  mood_today: number | null
  mood_last_logged_at: string | null
}

export interface TaskRow {
  id: string
  title: string
  completed: boolean
  xp_reward: number
}

export interface MainQuest {
  id: string
  dimension: Dimension
  vision: string
  xp: number
  streak_days?: number
  todays_tasks?: TaskRow[]
}

export interface TodayItem {
  id: string
  googleEventId?: string  // Google Calendar event ID (events only)
  type: 'task' | 'event'
  title: string
  time: string | null
  timeEnd: string | null
  endIso: string | null
  dimension: Dimension | null
  completed: boolean
  xp_reward: number
  color: string
}

export interface DesktopDashboardProps {
  vitality: VitalityData | null
  vitalityLoading: boolean
  hpValue: number | null
  hpTier: { color: string; label: string } | null
  dashOffset: number
  hpCircumference: number
  cycleLabel: string | null
  maxStreak: number
  verdict: { text: string; color: string } | null
  verdictKey: number
  moodScore: number | null
  moodLoggedAt: string | null
  hasCheckedInToday: boolean
  witnessInsight: string | null
  witnessDismissed: boolean
  quests: MainQuest[]
  dimXpMap: Record<string, number>
  dimBaselineMap: Record<string, number>
  dimMedalsMap: Record<string, string[]>
  todayItems: TodayItem[]
  todayLoading: boolean
  selectedDate: Date
  todayDate: Date
  weekStart: Date
  expandedTaskId: string | null
  editingTaskId: string | null
  editTaskTitle: string
  completingTaskId: string | null
  justCompletedIds: Set<string>
  reschedulingTaskId: string | null
  pickerTaskId: string | null
  showQuickAdd: boolean
  onMoodSelect: (score: number) => void
  onCompleteTask: (item: TodayItem) => void
  onExpandTask: (id: string | null) => void
  onReschedule: (id: string, date: string | null) => void
  onDelete: (id: string) => void
  onStartEdit: (id: string, title: string) => void
  onEditTitleChange: (title: string) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string, title: string) => void
  onPickerToggle: (id: string | null) => void
  onDateSelect: (d: Date) => void
  onWeekBack: () => void
  onWeekForward: () => void
  onDismissWitness: () => void
  onToggleQuickAdd: () => void
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Human-readable category label shown instead of character name */
const CATEGORY_LABELS: Record<Dimension, string> = {
  career:   'Career',
  social:   'Friends',
  wealth:   'Finances',
  vitality: 'Body',
  mind:     'Mind',
  love:     'Relationship',
  family:   'Family',
}

const HERO_MAP: Record<Dimension, () => React.ReactElement> = {
  career:   () => <ForgeCharacterLarge />,
  social:   () => <EchoCharacterLarge />,
  wealth:   () => <VaultCharacterLarge />,
  vitality: () => <BlazeCharacterLarge />,
  mind:     () => <SageCharacterLarge />,
  love:     () => <SolCharacterLarge />,
  family:   () => <RootCharacterLarge />,
}

const MOOD_OPTIONS = [
  { value: 1, border: '#ef4444' },
  { value: 2, border: '#fb923c' },
  { value: 3, border: '#fbbf24' },
  { value: 4, border: '#34d399' },
  { value: 5, border: '#a855f7' },
] as const

const MOOD_LABELS: Record<number, string> = {
  1: 'Rough', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Energised',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive a 1–10 score from XP alone */
function xpScore(xp: number): number {
  const level = getLevel(xp)
  const progress = getLevelProgress(xp)
  return Math.min(10, Math.max(1, Math.round(level * 1.5 + progress)))
}

/** Blend user-set baseline with XP-derived score */
function getDimScore(xp: number, baseline?: number): number {
  const xs = xpScore(xp)
  if (baseline == null) return xs
  return Math.round((baseline + xs) / 2)
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getTomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function formatMoodTimestamp(iso: string): string {
  const logged = new Date(iso)
  const now = new Date()
  const isToday = logged.toDateString() === now.toDateString()
  const timeStr = logged.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  if (isToday) return timeStr
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (logged.toDateString() === yesterday.toDateString()) return `Yesterday · ${timeStr}`
  return `${logged.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${timeStr}`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DesktopDashboard(props: DesktopDashboardProps) {
  const {
    vitality, vitalityLoading, hpValue, hpTier, dashOffset, hpCircumference,
    cycleLabel, maxStreak,
    verdict, verdictKey, moodScore, moodLoggedAt, hasCheckedInToday,
    witnessInsight, witnessDismissed,
    quests, dimXpMap, dimBaselineMap,
    todayItems, todayLoading, selectedDate, todayDate, weekStart,
    expandedTaskId, editingTaskId, editTaskTitle, completingTaskId,
    justCompletedIds, pickerTaskId,
    onMoodSelect, onCompleteTask, onExpandTask, onReschedule, onDelete,
    onStartEdit, onEditTitleChange, onCancelEdit, onSaveEdit,
    onPickerToggle, onDateSelect, onWeekBack, onWeekForward,
    onDismissWitness, onToggleQuickAdd,
  } = props

  void verdictKey
  void completingTaskId

  const router = useRouter()
  const todayStr = toDateStr(todayDate)
  const selectedDateStr = toDateStr(selectedDate)
  const isToday = selectedDateStr === todayStr

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const doneCount  = todayItems.filter(i => i.type === 'task' && i.completed).length
  const totalTasks = todayItems.filter(i => i.type === 'task').length

  // ── Design tokens ────────────────────────────────────────────────────────
  const font: CSSProperties = { fontFamily: 'var(--font-plus-jakarta-sans, var(--font-space-grotesk)), system-ui, sans-serif' }
  const BG        = '#130F1E'
  const LEFT_BG   = '#1C1430'
  const RIGHT_BG  = '#100D1C'
  const CARD_BG   = '#1E1538'

  const colScroll: CSSProperties = {
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  }

  const sectionLabel: CSSProperties = {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.62)',
    fontWeight: 500,
    display: 'block',
    marginBottom: 10,
  }

  const muted: CSSProperties = { color: 'rgba(255,255,255,0.45)' }

  // Category cards sorted by score descending
  const sortedDims = [...ALL_DIMENSIONS].sort((a, b) => {
    const xpA = Math.max(dimXpMap[a] ?? 0, quests.find(q => q.dimension === a)?.xp ?? 0)
    const xpB = Math.max(dimXpMap[b] ?? 0, quests.find(q => q.dimension === b)?.xp ?? 0)
    return getDimScore(xpB, dimBaselineMap[b]) - getDimScore(xpA, dimBaselineMap[a])
  })

  return (
    <>
      {/* Score pop animation */}
      <style>{`
        @keyframes scorePop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .score-pop { animation: scorePop 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ ...font, background: BG, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', height: 52,
          background: LEFT_BG,
          borderBottom: '0.5px solid rgba(255,255,255,0.07)',
          position: 'sticky', top: 0, zIndex: 50, flexShrink: 0,
          boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontSize: 12, letterSpacing: '4px', color: '#C084FC', fontWeight: 700, textTransform: 'uppercase' }}>
              PROTAGONIST
            </span>
            <span style={{ fontSize: 12, ...muted }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {maxStreak > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.22)',
                borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#F87171', fontWeight: 500,
              }}>
                {maxStreak}d streak
              </div>
            )}
            <button
              type="button"
              onClick={() => openOracle()}
              style={{
                background: 'rgba(192,132,252,0.12)', border: '0.5px solid rgba(192,132,252,0.35)',
                borderRadius: 20, color: '#C084FC', fontSize: 12, fontWeight: 500,
                padding: '6px 18px', cursor: 'pointer', ...font,
              }}
            >
              Talk to Oracle
            </button>
          </div>
        </div>

        {/* ── Three-column body ──────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr 300px',
          flex: 1, minHeight: 0, overflow: 'hidden',
        }}>

          {/* ══ LEFT: Hero state + Life categories ═══════════════════════ */}
          <div style={{
            ...colScroll,
            background: LEFT_BG,
            padding: '20px 14px 32px',
            position: 'relative', zIndex: 2,
            boxShadow: '4px 0 24px rgba(0,0,0,0.55)',
          }}>

            {/* ── Hero state card ── */}
            <span style={sectionLabel}>Hero state</span>
            <div style={{
              background: 'rgba(0,0,0,0.25)', border: '0.5px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: '14px 12px', marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>

                {/* Protagonist character */}
                <div style={{ width: 48, height: 56, flexShrink: 0, position: 'relative', overflow: 'visible' }}>
                  <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                    <svg width="58" height="70" viewBox="0 0 58 70" fill="none">
                      <path d="M18 14 L21 8 L24 12 L29 6 L34 12 L37 8 L40 14Z" fill="#A855F7" opacity={0.9} />
                      <rect x="16" y="13" width="26" height="4" rx="2" fill="#7C3AED" />
                      <rect x="12" y="18" width="34" height="26" rx="10" fill="#7C3AED" />
                      <circle cx="22" cy="31" r="6.5" fill="#08051A" />
                      <circle cx="36" cy="31" r="6.5" fill="#08051A" />
                      <circle cx="20" cy="29" r="2.2" fill="white" opacity={0.65} />
                      <circle cx="34" cy="29" r="2.2" fill="white" opacity={0.65} />
                      <path d="M12 26 Q4 34 8 46 L12 44Z" fill="#5B21B6" opacity={0.7} />
                      <path d="M46 26 Q54 34 50 46 L46 44Z" fill="#5B21B6" opacity={0.7} />
                      <rect x="16" y="46" width="26" height="20" rx="6" fill="#5B21B6" />
                      <path d="M29 52 L30.5 56 L34.5 56 L31.5 58.5 L32.7 62.5 L29 60 L25.3 62.5 L26.5 58.5 L23.5 56 L27.5 56Z" fill="#A855F7" opacity={0.7} />
                    </svg>
                  </div>
                </div>

                {/* HP ring */}
                <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                  <svg width="56" height="56" viewBox="0 0 82 82">
                    {/* Dark stage */}
                    <circle cx="41" cy="41" r="30" fill="#08051A" />
                    {/* Track */}
                    <circle cx="41" cy="41" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                    {/* Fill */}
                    <circle
                      cx="41" cy="41" r="34" fill="none"
                      stroke="#C084FC"
                      strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={hpCircumference}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 41 41)"
                      style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#E8E0F0', lineHeight: 1 }}>
                      {hpValue ?? '--'}
                    </span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '1px' }}>HP</span>
                  </div>
                </div>

                {/* Biometrics — compact inline */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                    {vitalityLoading ? (
                      <span style={{ color: 'rgba(255,255,255,0.2)' }}>Loading…</span>
                    ) : (
                      <>
                        <span style={{ color: '#60a5fa', fontWeight: 500 }}>
                          {vitality?.sleep_score ?? '--'}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 4px' }}>Sleep</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                        <span style={{ color: '#34d399', fontWeight: 500, marginLeft: 4 }}>
                          {vitality?.readiness_score ?? '--'}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 4px' }}>Ready</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                        <span style={{ color: '#fb923c', fontWeight: 500, marginLeft: 4 }}>
                          {vitality?.activity_score ?? '--'}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>Move</span>
                      </>
                    )}
                  </div>
                  {cycleLabel && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', marginTop: 6,
                      background: 'rgba(244,114,182,0.1)', border: '0.5px solid rgba(244,114,182,0.25)',
                      borderRadius: 20, padding: '2px 10px', fontSize: 11, color: '#f472b6',
                    }}>
                      {cycleLabel}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Your Life category cards ── */}
            <span style={sectionLabel}>Your life</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {sortedDims.map((dim) => {
                const xp = Math.max(dimXpMap[dim] ?? 0, quests.find(q => q.dimension === dim)?.xp ?? 0)
                const score = getDimScore(xp, dimBaselineMap[dim])
                const char = CHARACTERS[dim]
                const quest = quests.find(q => q.dimension === dim)
                const Hero = HERO_MAP[dim]
                const taskCount = quest?.todays_tasks?.filter(t => !t.completed).length ?? 0

                return (
                  <div
                    key={dim}
                    role="button" tabIndex={0}
                    onClick={() => router.push(`/${DIMENSION_TO_SLUG[dim]}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/${DIMENSION_TO_SLUG[dim]}`) }}
                    style={{
                      background: CARD_BG,
                      border: '0.5px solid rgba(255,255,255,0.07)',
                      borderRadius: 11, padding: '8px 10px 8px 12px',
                      position: 'relative', overflow: 'hidden', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Color bar */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: char.color, borderRadius: '11px 0 0 11px' }} />

                    {/* Mascot */}
                    <div style={{ width: 28, height: 34, position: 'relative', overflow: 'visible', flexShrink: 0, marginLeft: 4 }}>
                      <div style={{ transform: 'scale(0.29)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                        <Hero />
                      </div>
                    </div>

                    {/* Category info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#E8E0F0', lineHeight: 1.2 }}>
                        {CATEGORY_LABELS[dim]}
                      </div>
                      {quest?.vision ? (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {quest.vision}
                        </div>
                      ) : taskCount > 0 ? (
                        <div style={{ fontSize: 11, color: `${char.color}99`, marginTop: 2 }}>
                          {taskCount} task{taskCount > 1 ? 's' : ''} today
                        </div>
                      ) : null}
                    </div>

                    {/* Score */}
                    <span
                      key={score}
                      className="score-pop"
                      style={{
                        fontSize: 20, fontWeight: 700, color: char.color,
                        flexShrink: 0, minWidth: 24, textAlign: 'right',
                        lineHeight: 1,
                      }}
                    >
                      {score}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ══ CENTER: Today ══════════════════════════════════════════════ */}
          <div style={{ ...colScroll, padding: '20px 28px 32px', background: BG }}>

            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#E8E0F0' }}>
                  {isToday ? 'Today' : selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                </span>
                {totalTasks > 0 && (
                  <span style={{ fontSize: 12, ...muted, marginLeft: 10 }}>
                    {doneCount} of {totalTasks} done
                  </span>
                )}
              </div>
              <button
                type="button" onClick={onToggleQuickAdd}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(192,132,252,0.1)', border: '0.5px solid rgba(192,132,252,0.3)',
                  color: '#C084FC', fontSize: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0, ...font,
                }}
                aria-label="Add calendar event"
              >+</button>
            </div>

            {/* Week strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
              <button type="button" onClick={onWeekBack}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 20, cursor: 'pointer', padding: '0 6px', lineHeight: 1, ...font }}>‹</button>
              <div style={{ display: 'flex', flex: 1, gap: 3 }}>
                {weekDays.map((d) => {
                  const ds = toDateStr(d)
                  const isSelected = ds === selectedDateStr
                  const isT = ds === todayStr
                  return (
                    <button key={ds} type="button" onClick={() => onDateSelect(d)}
                      style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: '7px 4px', borderRadius: 10,
                        background: isSelected ? 'rgba(147,51,234,0.18)' : 'transparent',
                        border: isSelected ? '0.5px solid rgba(147,51,234,0.4)' : 'none',
                        cursor: 'pointer', ...font,
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 500, color: isSelected ? '#C084FC' : 'rgba(255,255,255,0.35)' }}>
                        {d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: isSelected ? '#C084FC' : isT ? '#E8E0F0' : 'rgba(255,255,255,0.45)' }}>
                        {d.getDate()}
                      </span>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#9333EA' : isT ? 'rgba(147,51,234,0.5)' : 'transparent' }} />
                    </button>
                  )
                })}
              </div>
              <button type="button" onClick={onWeekForward}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 20, cursor: 'pointer', padding: '0 6px', lineHeight: 1, ...font }}>›</button>
            </div>

            {/* Items list */}
            {todayLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
                {[0.6, 0.85, 0.5, 0.7].map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                    <div style={{ width: 44, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)' }} />
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                    <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', width: `${w * 100}%` }} />
                  </div>
                ))}
              </div>
            ) : todayItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 13, ...muted, marginBottom: 12 }}>Nothing scheduled for today.</div>
                <button type="button" onClick={() => openOracle()}
                  style={{ background: 'rgba(147,51,234,0.1)', border: '0.5px solid rgba(147,51,234,0.3)', borderRadius: 20, color: '#C084FC', fontSize: 12, padding: '8px 20px', cursor: 'pointer', ...font }}>
                  Ask Oracle to build your plan
                </button>
              </div>
            ) : (
              <div>
                {todayItems.map((item) => {
                  const now = new Date()
                  const isPast = item.type === 'event' && item.endIso ? new Date(item.endIso) < now : false
                  const isCompleted = item.completed || justCompletedIds.has(item.id)
                  const isExpanded = expandedTaskId === item.id
                  const isEditing = editingTaskId === item.id

                  return (
                    <div key={item.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      <div
                        style={{
                          display: 'flex', gap: 12, alignItems: 'flex-start',
                          padding: '10px 0',
                          opacity: isCompleted ? 0.4 : isPast ? 0.5 : 1,
                          cursor: item.type === 'task' ? 'pointer' : 'default',
                        }}
                        onClick={() => { if (item.type === 'task' && !isCompleted) onExpandTask(isExpanded ? null : item.id) }}
                      >
                        {/* Time */}
                        <div style={{ width: 46, fontSize: 11, color: 'rgba(255,255,255,0.32)', textAlign: 'right', flexShrink: 0, paddingTop: 2 }}>
                          {item.time ?? ''}
                        </div>

                        {/* Indicator */}
                        {isCompleted ? (
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: `${item.color}20`, border: `1.5px solid ${item.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                            <svg width="7" height="7" viewBox="0 0 8 8"><path d="M1.5 4L3.5 6L6.5 2" stroke={item.color} strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
                          </div>
                        ) : item.type === 'event' ? (
                          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(59,130,246,0.12)', border: '1.5px solid #3b82f6', flexShrink: 0, marginTop: 2 }} />
                        ) : (
                          <div
                            style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${item.color}80`, flexShrink: 0, marginTop: 2, cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); void onCompleteTask(item) }}
                          />
                        )}

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 400, color: isCompleted ? 'rgba(255,255,255,0.3)' : '#E8E0F0',
                            textDecoration: isCompleted ? 'line-through' : 'none', lineHeight: 1.4,
                          }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 11, marginTop: 2, color: item.type === 'event' ? 'rgba(96,165,250,0.55)' : `${item.color}90` }}>
                            {item.type === 'event'
                              ? `Calendar${item.timeEnd ? ` · ends ${item.timeEnd}` : ''}`
                              : item.dimension
                                ? `+${item.xp_reward} XP · ${CATEGORY_LABELS[item.dimension]}`
                                : `+${item.xp_reward} XP`}
                          </div>
                        </div>
                      </div>

                      {/* Expanded actions */}
                      {isExpanded && item.type === 'task' && (
                        <div style={{ paddingLeft: 72, paddingBottom: 10 }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input
                                autoFocus type="text" value={editTaskTitle}
                                onChange={(e) => onEditTitleChange(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(item.id, editTaskTitle); if (e.key === 'Escape') onCancelEdit() }}
                                style={{ flex: 1, background: BG, border: `0.5px solid ${item.color}50`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#E8E0F0', outline: 'none', ...font }}
                              />
                              <button type="button" onClick={() => onSaveEdit(item.id, editTaskTitle)}
                                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: item.color, color: '#0D0820', fontSize: 11, fontWeight: 700, cursor: 'pointer', ...font }}>Save</button>
                              <button type="button" onClick={onCancelEdit}
                                style={{ padding: '7px 10px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 16, cursor: 'pointer', ...font }}>×</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {[
                                { label: 'Edit',       action: () => onStartEdit(item.id, item.title), s: { border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)', background: 'transparent' } },
                                { label: 'Tomorrow',   action: () => onReschedule(item.id, getTomorrowStr()), s: { border: `0.5px solid ${item.color}50`, color: item.color, background: `${item.color}10` } },
                                { label: 'Someday',    action: () => onReschedule(item.id, null), s: { border: '0.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.38)', background: 'transparent' } },
                                { label: 'Delete',     action: () => onDelete(item.id), s: { border: '0.5px solid rgba(239,68,68,0.25)', color: '#ef4444', background: 'rgba(239,68,68,0.05)' } },
                              ].map(({ label, action, s }) => (
                                <button key={label} type="button"
                                  onClick={(e) => { e.stopPropagation(); action() }}
                                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', ...s, ...font }}>
                                  {label}
                                </button>
                              ))}
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); onPickerToggle(pickerTaskId === item.id ? null : item.id) }}
                                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: pickerTaskId === item.id ? `0.5px solid ${item.color}50` : '0.5px solid rgba(255,255,255,0.08)', color: pickerTaskId === item.id ? item.color : 'rgba(255,255,255,0.38)', background: pickerTaskId === item.id ? `${item.color}10` : 'transparent', ...font }}>
                                Pick date
                              </button>
                            </div>
                          )}
                          {pickerTaskId === item.id && (
                            <input type="date" autoFocus min={getTomorrowStr()}
                              onChange={(e) => { if (e.target.value) { onPickerToggle(null); onReschedule(item.id, e.target.value) } }}
                              style={{ marginTop: 8, width: '100%', background: BG, border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#E8E0F0', outline: 'none', ...font, colorScheme: 'dark', boxSizing: 'border-box' }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ══ RIGHT: Oracle + Quests ════════════════════════════════════ */}
          <div style={{
            ...colScroll,
            background: RIGHT_BG,
            padding: '20px 18px 32px',
            position: 'relative', zIndex: 2,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.45)',
          }}>

            {/* Oracle card */}
            <span style={sectionLabel}>Oracle · today</span>
            <div style={{
              background: 'rgba(147,51,234,0.06)', border: '0.5px solid rgba(147,51,234,0.2)',
              borderRadius: 14, padding: '14px', marginBottom: 14,
            }}>
              {/* Oracle eyebrow */}
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(216,180,254,0.80)', marginBottom: 8, fontWeight: 500 }}>
                What the oracle sees
              </div>

              {verdict ? (
                <div style={{ fontStyle: 'italic', fontSize: 13, color: '#C084FC', lineHeight: 1.65, marginBottom: 12 }}>
                  &ldquo;{verdict.text}&rdquo;
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', fontStyle: 'italic', marginBottom: 12 }}>
                  No check-in yet today
                </div>
              )}

              {/* Mood */}
              <div style={{ fontSize: 11, ...sectionLabel, marginBottom: 8 }}>Mood</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                {MOOD_OPTIONS.map(({ value, border }) => (
                  <button
                    key={value} type="button"
                    onClick={() => onMoodSelect(value)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      border: `2px solid ${border}`,
                      background: moodScore === value ? border : 'transparent',
                      cursor: 'pointer',
                      transform: moodScore === value ? 'scale(1.25)' : 'scale(1)',
                      transition: 'transform 0.15s, background 0.15s',
                      flexShrink: 0,
                      padding: 0,
                      ...font,
                    }}
                    aria-label={`Mood ${value}`}
                  />
                ))}
                {moodScore != null && (
                  <span style={{ fontSize: 11, ...muted, marginLeft: 2 }}>
                    {MOOD_LABELS[moodScore]}
                    {moodLoggedAt && <span style={{ color: 'rgba(255,255,255,0.22)' }}> · {formatMoodTimestamp(moodLoggedAt)}</span>}
                  </span>
                )}
              </div>

              {!hasCheckedInToday && (
                <button type="button" onClick={() => openOracle('', 'morning_checkin')}
                  style={{
                    width: '100%', background: 'rgba(147,51,234,0.1)',
                    border: '0.5px solid rgba(147,51,234,0.28)', borderRadius: 10,
                    color: '#C084FC', fontSize: 12, fontWeight: 500,
                    padding: '9px 0', cursor: 'pointer', ...font,
                  }}>
                  Start morning check-in
                </button>
              )}
            </div>

            {/* Witness insight */}
            {witnessInsight && !witnessDismissed && (
              <div style={{
                background: 'rgba(147,51,234,0.04)', borderLeft: '2px solid rgba(147,51,234,0.5)',
                borderRadius: '0 10px 10px 0', padding: '10px 12px',
                marginBottom: 14, position: 'relative',
              }}>
                <button type="button" onClick={onDismissWitness}
                  style={{ position: 'absolute', top: 8, right: 10, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '2px 4px', ...font }}>×</button>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(216,180,254,0.60)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 5 }}>The Witness</div>
                <div style={{ fontSize: 12, color: '#C0B0E0', lineHeight: 1.65, fontStyle: 'italic', paddingRight: 20 }}>
                  &ldquo;{witnessInsight}&rdquo;
                </div>
              </div>
            )}

            {/* Active quests */}
            <span style={sectionLabel}>Active quests</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {quests.length === 0 ? (
                <div style={{ fontSize: 12, ...muted, textAlign: 'center', padding: '16px 0' }}>No active quests</div>
              ) : quests.map((quest) => {
                const char = CHARACTERS[quest.dimension]
                const level = getLevel(quest.xp)
                const pct = Math.round(getLevelProgress(quest.xp) * 100)
                const pendingTasks = quest.todays_tasks?.filter(t => !t.completed).length ?? 0
                return (
                  <div
                    key={quest.id} role="button" tabIndex={0}
                    onClick={() => router.push(`/${DIMENSION_TO_SLUG[quest.dimension]}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/${DIMENSION_TO_SLUG[quest.dimension]}`) }}
                    style={{
                      background: CARD_BG, border: `0.5px solid ${char.color}28`,
                      borderRadius: 12, padding: '11px 13px', cursor: 'pointer',
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: char.color }} />
                    <div style={{ paddingLeft: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#E8E0F0', flex: 1, marginRight: 8, lineHeight: 1.35 }}>{quest.vision}</span>
                        <span style={{ fontSize: 11, color: char.color, fontWeight: 500, flexShrink: 0 }}>
                          {CATEGORY_LABELS[quest.dimension]}
                        </span>
                      </div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: char.color, borderRadius: 2, opacity: 0.7 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
                        <span>Lv {level}</span>
                        <span style={{ color: `${char.color}80` }}>
                          {pendingTasks > 0 ? `${pendingTasks} task${pendingTasks > 1 ? 's' : ''} today` : `${pct}% to next level`}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
