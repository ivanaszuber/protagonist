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
import { ALL_DIMENSIONS, CHARACTERS, getCharacterTierLabel, type Dimension } from '@/lib/character'
import { DIMENSION_TO_SLUG } from '@/lib/tierName'
import { getLevel, getLevelProgress } from '@/lib/xp'
import { getMedalDefinitions } from '@/lib/medals'
import { openOracle } from '@/lib/oracle-events'
import type { MedalDefinition } from '@/lib/medals'

// ── Shared types (mirrored from dashboard/page.tsx) ──────────────────────────

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
  // Vital state
  vitality: VitalityData | null
  vitalityLoading: boolean
  hpValue: number | null
  hpTier: { color: string; label: string } | null
  dashOffset: number
  hpCircumference: number
  cycleLabel: string | null
  maxStreak: number

  // Oracle / mood
  verdict: { text: string; color: string } | null
  verdictKey: number
  moodScore: number | null
  moodLoggedAt: string | null
  hasCheckedInToday: boolean
  witnessInsight: string | null
  witnessDismissed: boolean

  // Champions
  quests: MainQuest[]
  dimXpMap: Record<string, number>
  dimMedalsMap: Record<string, string[]>

  // Today
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

  // Handlers
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const HERO_MAP: Record<Dimension, () => React.ReactElement> = {
  career: () => <ForgeCharacterLarge />,
  social: () => <EchoCharacterLarge />,
  wealth: () => <VaultCharacterLarge />,
  vitality: () => <BlazeCharacterLarge />,
  mind: () => <SageCharacterLarge />,
  love: () => <SolCharacterLarge />,
  family: () => <RootCharacterLarge />,
}

const MOOD_OPTIONS = [
  { value: 1, border: '#ef4444', bg: '#3B0010' },
  { value: 2, border: '#fb923c', bg: '#3B1A0A' },
  { value: 3, border: '#fbbf24', bg: '#2A2500' },
  { value: 4, border: '#34d399', bg: '#0D2A10' },
  { value: 5, border: '#a855f7', bg: '#1A0830' },
] as const

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
  const isToday =
    logged.getFullYear() === now.getFullYear() &&
    logged.getMonth() === now.getMonth() &&
    logged.getDate() === now.getDate()
  const timeStr = logged.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  if (isToday) return timeStr
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    logged.getFullYear() === yesterday.getFullYear() &&
    logged.getMonth() === yesterday.getMonth() &&
    logged.getDate() === yesterday.getDate()
  if (isYesterday) return `Yesterday · ${timeStr}`
  return `${logged.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${timeStr}`
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ChampionMedalIcon({ icon, earned, color }: { icon: MedalDefinition['icon']; earned: boolean; color: string }) {
  const stroke = earned ? color : '#3D2878'
  const fill = earned ? color : 'none'
  const common = { width: 8, height: 8, viewBox: '0 0 24 24', fill: 'none' as const }
  let path: React.ReactNode
  switch (icon) {
    case 'sword': path = <path d="M4 20L14 10M14 10L11 7L17 4L20 10L17 13L14 10Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'pulse': path = <path d="M4 12H8L10 6L14 18L16 12H20" stroke={stroke} strokeWidth="1.5" />; break
    case 'skull': path = <><circle cx="12" cy="10" r="5" stroke={stroke} strokeWidth="1.5" fill={fill} /><path d="M8 20V16M12 20V16M16 20V16" stroke={stroke} strokeWidth="1.5" /></>; break
    case 'flame': path = <path d="M12 3C10 8 6 10 6 14C6 17.3 8.7 20 12 20C15.3 20 18 17.3 18 14C18 10 14 8 12 3Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'star': path = <path d="M12 4L14 9H19L15 12L16.5 17L12 14L7.5 17L9 12L5 9H10L12 4Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'shield': path = <path d="M12 3L5 6V12C5 16 8 19 12 21C16 19 19 16 19 12V6L12 3Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'trophy': path = <><path d="M8 6H16V10C16 12 14 14 12 14C10 14 8 12 8 10V6Z" stroke={stroke} strokeWidth="1.5" fill={fill} /><path d="M12 14V17M9 20H15" stroke={stroke} strokeWidth="1.5" /></>; break
    case 'coin': path = <><circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.5" fill={fill} /><path d="M12 8v8M9 10.5h4.5a1.5 1.5 0 0 1 0 3H9" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" /></>; break
    default: path = null
  }
  return <svg {...common}>{path}</svg>
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DesktopDashboard(props: DesktopDashboardProps) {
  const {
    vitality, vitalityLoading, hpValue, hpTier, dashOffset, hpCircumference,
    cycleLabel, maxStreak,
    verdict, verdictKey, moodScore, moodLoggedAt, hasCheckedInToday,
    witnessInsight, witnessDismissed,
    quests, dimXpMap, dimMedalsMap,
    todayItems, todayLoading, selectedDate, todayDate, weekStart,
    expandedTaskId, editingTaskId, editTaskTitle, completingTaskId,
    justCompletedIds, reschedulingTaskId, pickerTaskId, showQuickAdd,
    onMoodSelect, onCompleteTask, onExpandTask, onReschedule, onDelete,
    onStartEdit, onEditTitleChange, onCancelEdit, onSaveEdit,
    onPickerToggle, onDateSelect, onWeekBack, onWeekForward,
    onDismissWitness, onToggleQuickAdd,
  } = props

  const router = useRouter()
  const todayStr = toDateStr(todayDate)
  const selectedDateStr = toDateStr(selectedDate)
  const isToday = selectedDateStr === todayStr

  // Build week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const doneCount = todayItems.filter(i => i.type === 'task' && i.completed).length
  const totalTasks = todayItems.filter(i => i.type === 'task').length

  // ── Styles ──────────────────────────────────────────────────────────────────

  const font: CSSProperties = { fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif' }

  const colStyle: CSSProperties = {
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    padding: '16px 14px 24px',
  }

  const secLabel: CSSProperties = {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.25)',
    display: 'block',
    marginBottom: 10,
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        ...font,
        background: '#0D0820',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          background: '#0D0820',
          borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontSize: 11, letterSpacing: '3.5px', color: '#C084FC', fontWeight: 500, textTransform: 'uppercase' }}>
            PROTAGONIST
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {maxStreak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(239,68,68,0.12)', border: '0.5px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '4px 10px', fontSize: 10, color: '#F87171' }}>
              🔥 {maxStreak}d streak
            </div>
          )}
          <button
            type="button"
            onClick={() => openOracle()}
            style={{ background: 'rgba(147,51,234,0.15)', border: '0.5px solid rgba(147,51,234,0.4)', borderRadius: 20, color: '#C084FC', fontSize: 10, padding: '5px 14px', cursor: 'pointer', ...font }}
          >
            ✦ Talk to Oracle
          </button>
        </div>
      </div>

      {/* ── Three-column body ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '230px 1fr 270px',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* ══ LEFT: Vital state + Champions ══ */}
        <div style={{ ...colStyle, borderRight: '0.5px solid rgba(255,255,255,0.05)' }}>
          <span style={secLabel}>Your state · today</span>

          {/* Vital state row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {/* Protagonist character */}
            <div style={{ width: 34, height: 40, flexShrink: 0, position: 'relative', overflow: 'visible' }}>
              <div style={{ transform: 'scale(0.28)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <svg width="58" height="70" viewBox="0 0 58 70" fill="none">
                  <path d="M18 14 L21 8 L24 12 L29 6 L34 12 L37 8 L40 14Z" fill="#A855F7" opacity={0.9} />
                  <rect x="16" y="13" width="26" height="4" rx="2" fill="#7C3AED" />
                  <rect x="12" y="18" width="34" height="26" rx="10" fill="#7C3AED" />
                  <circle cx="22" cy="31" r="6.5" fill="#1A0030" />
                  <circle cx="36" cy="31" r="6.5" fill="#1A0030" />
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
            <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
              <svg width="52" height="52" viewBox="0 0 82 82">
                <circle cx="41" cy="41" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                <circle
                  cx="41" cy="41" r="34" fill="none"
                  stroke={hpTier?.color ?? '#2D1B55'}
                  strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={hpCircumference}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 41 41)"
                  style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#E8E0F0', lineHeight: 1 }}>
                  {hpValue ?? '--'}
                </span>
                <span style={{ fontSize: 7, color: '#6A5A8A' }}>HP</span>
              </div>
            </div>

            {/* Biometric bars */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { label: 'Ready', value: vitality?.readiness_score, color: '#34d399' },
                { label: 'Sleep', value: vitality?.sleep_score, color: '#60a5fa' },
                { label: 'Move', value: vitality?.activity_score, color: '#fb923c' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 7, color: '#5A4A7A', width: 28, flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${vitalityLoading || value == null ? 0 : value}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease-out' }} />
                  </div>
                  <span style={{ fontSize: 7, color: vitalityLoading || value == null ? '#5A4A7A' : color, width: 22, textAlign: 'right', fontWeight: 700 }}>
                    {vitalityLoading ? '--' : value != null ? value : '--'}
                  </span>
                </div>
              ))}
              {cycleLabel && (
                <div style={{ display: 'inline-flex', alignItems: 'center', background: '#2A1040', border: '0.5px solid #4A1555', borderRadius: 20, padding: '2px 8px', fontSize: 7, color: '#f472b6', marginTop: 1 }}>
                  {cycleLabel}
                </div>
              )}
            </div>
          </div>

          {/* Champions */}
          <span style={{ ...secLabel, marginTop: 4 }}>Champions</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[...ALL_DIMENSIONS]
              .sort((a, b) => {
                const xpA = Math.max(dimXpMap[a] ?? 0, quests.find(q => q.dimension === a)?.xp ?? 0)
                const xpB = Math.max(dimXpMap[b] ?? 0, quests.find(q => q.dimension === b)?.xp ?? 0)
                return xpB - xpA
              })
              .map((dim) => {
                const quest = quests.find(q => q.dimension === dim)
                const char = CHARACTERS[dim]
                const xp = Math.max(dimXpMap[dim] ?? 0, quest?.xp ?? 0)
                const level = getLevel(xp)
                const pct = Math.round(getLevelProgress(xp) * 100)
                const Hero = HERO_MAP[dim]
                const taskCount = quest?.todays_tasks?.filter(t => !t.completed).length ?? 0
                const earnedKeys = dimMedalsMap[dim] ?? []
                const medalDefs = getMedalDefinitions(dim).slice(0, 5)
                const needsAttention = level <= 3 && !quest

                return (
                  <div
                    key={dim}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/${DIMENSION_TO_SLUG[dim]}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/${DIMENSION_TO_SLUG[dim]}`) }}
                    style={{
                      background: '#140C28',
                      border: `0.5px solid ${needsAttention ? `${char.color}40` : '#2D1B55'}`,
                      borderRadius: 10,
                      padding: '7px 10px 7px 12px',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    {/* Colour accent bar */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: char.color }} />

                    {/* Character art */}
                    <div style={{ marginLeft: 4, flexShrink: 0, width: 28, height: 34, position: 'relative' }}>
                      <div style={{ transform: 'scale(0.28)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                        <Hero />
                      </div>
                    </div>

                    {/* Middle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 11, color: '#E8E0F0', fontWeight: 500 }}>{char.name}</span>
                        <span style={{ fontSize: 8, color: '#5A4A7A' }}>
                          · {char.categoryLabel}
                          {taskCount > 0 && (
                            <span style={{ color: `${char.color}99` }}> · {taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
                          )}
                        </span>
                      </div>
                      <div style={{ fontSize: 8, color: '#8A80A8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                        {getCharacterTierLabel(dim, xp)}
                        {quest?.vision ? ` · ${quest.vision}` : ' · No active quest'}
                      </div>
                      <div style={{ height: 2, background: '#2D1B55', borderRadius: 1, overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: char.color, borderRadius: 1 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {medalDefs.map((medal) => {
                          const isEarned = earnedKeys.includes(medal.key)
                          return (
                            <div key={medal.key} title={isEarned ? medal.label : medal.hint} style={{ width: 14, height: 14, borderRadius: '50%', background: isEarned ? `${char.color}20` : 'rgba(30,13,64,0.6)', border: `0.5px solid ${isEarned ? `${char.color}60` : '#1E0D40'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <ChampionMedalIcon icon={medal.icon} earned={isEarned} color={char.color} />
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Right */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: char.color, background: `${char.color}18`, border: `0.5px solid ${char.color}35`, borderRadius: 20, padding: '1px 7px' }}>
                        Lv {level}
                      </span>
                      {needsAttention && (
                        <span style={{ fontSize: 7, color: char.color, background: `${char.color}12`, border: `0.5px solid ${char.color}30`, borderRadius: 20, padding: '1px 5px' }}>
                          needs attention
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* ══ CENTER: Today ══ */}
        <div style={{ ...colStyle, padding: '16px 20px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#E8E0F0' }}>
              {isToday ? 'Today' : selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
              <span style={{ fontSize: 10, fontWeight: 400, color: '#5A4A7A', marginLeft: 8 }}>
                {totalTasks > 0 ? `${doneCount} of ${totalTasks} done` : ''}
              </span>
            </span>
            <button
              type="button"
              onClick={onToggleQuickAdd}
              style={{ width: 24, height: 24, borderRadius: '50%', background: '#1A0D40', border: '0.5px solid #4A2080', color: '#C084FC', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', lineHeight: 1, padding: 0, ...font }}
              aria-label="Add calendar event"
            >
              +
            </button>
          </div>

          {/* Week strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            <button type="button" onClick={onWeekBack} style={{ background: 'transparent', border: 'none', color: '#5A4A7A', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1, ...font }} aria-label="Previous week">‹</button>
            <div style={{ display: 'flex', flex: 1, gap: 2 }}>
              {weekDays.map((d) => {
                const ds = toDateStr(d)
                const isSelected = ds === selectedDateStr
                const isT = ds === todayStr
                const dayTasks = quests.flatMap(q => q.todays_tasks ?? []).filter(t => !t.completed)
                const hasPending = dayTasks.length > 0 && isT
                return (
                  <button
                    key={ds}
                    type="button"
                    onClick={() => onDateSelect(d)}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '5px 2px', borderRadius: 8, background: isSelected ? '#2A1460' : 'transparent', border: 'none', cursor: 'pointer', ...font }}
                  >
                    <span style={{ fontSize: 7, color: isSelected ? '#C084FC' : 'rgba(255,255,255,0.28)' }}>
                      {d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 500, color: isSelected ? '#C084FC' : isT ? '#E8E0F0' : 'rgba(255,255,255,0.45)' }}>
                      {d.getDate()}
                    </span>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#9333EA' : hasPending ? 'rgba(147,51,234,0.4)' : 'transparent' }} />
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={onWeekForward} style={{ background: 'transparent', border: 'none', color: '#5A4A7A', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1, ...font }} aria-label="Next week">›</button>
          </div>

          {/* Today items */}
          {todayLoading ? (
            <div style={{ fontSize: 11, color: '#5A4A7A', textAlign: 'center', padding: '20px 0' }}>Loading...</div>
          ) : todayItems.length === 0 ? (
            <div style={{ fontSize: 11, color: '#5A4A7A', textAlign: 'center', padding: '20px 0' }}>Nothing scheduled</div>
          ) : (
            <div>
              {todayItems.map((item) => {
                const now = new Date()
                const isPast = item.type === 'event' && item.endIso ? new Date(item.endIso) < now : false
                const isCompleted = item.completed || justCompletedIds.has(item.id)
                const isExpanded = expandedTaskId === item.id
                const isEditing = editingTaskId === item.id

                return (
                  <div key={item.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)', opacity: isCompleted ? 0.45 : 1 }}>
                    <div
                      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', cursor: item.type === 'task' ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (item.type === 'task' && !isCompleted) {
                          onExpandTask(isExpanded ? null : item.id)
                        }
                      }}
                    >
                      {/* Time */}
                      <div style={{ width: 38, fontSize: 8, color: 'rgba(255,255,255,0.22)', textAlign: 'right', flexShrink: 0, paddingTop: 2 }}>
                        {item.time ?? ''}
                      </div>

                      {/* Dot / check */}
                      {isCompleted ? (
                        <div style={{ width: 11, height: 11, borderRadius: '50%', background: `${item.color}25`, border: `0.5px solid ${item.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          <svg width="6" height="6" viewBox="0 0 8 8"><path d="M1.5 4L3.5 6L6.5 2" stroke={item.color} strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
                        </div>
                      ) : item.type === 'event' ? (
                        <div style={{ width: 11, height: 11, borderRadius: 2, background: 'rgba(59,130,246,0.2)', border: '0.5px solid #3b82f6', flexShrink: 0, marginTop: 2 }} />
                      ) : (
                        <div
                          style={{ width: 11, height: 11, borderRadius: '50%', border: `0.5px solid ${item.color}80`, flexShrink: 0, marginTop: 2, cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); void onCompleteTask(item) }}
                        />
                      )}

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: isPast || isCompleted ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.82)', textDecoration: isCompleted ? 'line-through' : 'none', lineHeight: 1.4 }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 8, marginTop: 1, color: item.type === 'event' ? 'rgba(96,165,250,0.5)' : `${item.color}80` }}>
                          {item.type === 'event'
                            ? `Calendar${item.timeEnd ? ` · ends ${item.timeEnd}` : ''}`
                            : item.dimension
                              ? `+${item.xp_reward} XP · ${CHARACTERS[item.dimension].categoryLabel}`
                              : `+${item.xp_reward} XP`}
                        </div>
                      </div>
                    </div>

                    {/* Expanded actions */}
                    {isExpanded && item.type === 'task' && (
                      <div style={{ paddingLeft: 59, paddingBottom: 8 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              autoFocus
                              type="text"
                              value={editTaskTitle}
                              onChange={(e) => onEditTitleChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') onSaveEdit(item.id, editTaskTitle)
                                if (e.key === 'Escape') onCancelEdit()
                              }}
                              style={{ flex: 1, background: '#0D0820', border: `0.5px solid ${item.color}60`, borderRadius: 8, padding: '5px 8px', fontSize: 11, color: '#E8E0F0', outline: 'none', ...font }}
                            />
                            <button type="button" onClick={() => onSaveEdit(item.id, editTaskTitle)} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: item.color, color: '#0D0820', fontSize: 10, fontWeight: 600, cursor: 'pointer', ...font }}>Save</button>
                            <button type="button" onClick={onCancelEdit} style={{ padding: '5px 8px', borderRadius: 8, border: '0.5px solid #2D1B55', background: 'transparent', color: '#5A4A7A', fontSize: 14, cursor: 'pointer', ...font }}>×</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {[
                              { label: '✏️ Edit', action: () => onStartEdit(item.id, item.title), style: { border: '0.5px solid #2D1B55', color: '#9B8EC4', background: 'transparent' } },
                              { label: '→ Tomorrow', action: () => onReschedule(item.id, getTomorrowStr()), style: { border: `0.5px solid ${item.color}60`, color: item.color, background: `${item.color}12` } },
                              { label: 'Someday', action: () => onReschedule(item.id, null), style: { border: '0.5px solid #2D1B55', color: '#5A4A7A', background: 'transparent' } },
                              { label: 'Delete', action: () => onDelete(item.id), style: { border: '0.5px solid rgba(239,68,68,0.3)', color: '#ef4444', background: 'rgba(239,68,68,0.06)' } },
                            ].map(({ label, action, style: s }) => (
                              <button key={label} type="button" onClick={(e) => { e.stopPropagation(); action() }} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap', ...s, ...font }}>
                                {label}
                              </button>
                            ))}
                            <button type="button" onClick={(e) => { e.stopPropagation(); onPickerToggle(pickerTaskId === item.id ? null : item.id) }} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 9, cursor: 'pointer', border: pickerTaskId === item.id ? `0.5px solid ${item.color}60` : '0.5px solid #2D1B55', color: pickerTaskId === item.id ? item.color : '#7A6090', background: pickerTaskId === item.id ? `${item.color}12` : 'transparent', ...font }}>
                              📅 Pick date
                            </button>
                          </div>
                        )}
                        {pickerTaskId === item.id && (
                          <input
                            type="date"
                            autoFocus
                            min={getTomorrowStr()}
                            onChange={(e) => { if (e.target.value) { onPickerToggle(null); onReschedule(item.id, e.target.value) } }}
                            style={{ marginTop: 6, width: '100%', background: '#0D0820', border: '0.5px solid #2D1B55', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#E8E0F0', outline: 'none', ...font, colorScheme: 'dark' }}
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

        {/* ══ RIGHT: Oracle + Quests ══ */}
        <div style={{ ...colStyle, borderLeft: '0.5px solid rgba(255,255,255,0.05)' }}>

          {/* Oracle card */}
          <div style={{ background: '#110828', border: '0.5px solid rgba(147,51,234,0.2)', borderRadius: 12, padding: '12px', marginBottom: 10 }}>
            <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(147,51,234,0.5)', marginBottom: 6 }}>Oracle · today</div>

            {verdict ? (
              <div style={{ fontStyle: 'italic', fontSize: 11, color: '#C084FC', lineHeight: 1.55, marginBottom: 8 }}>
                &ldquo;{verdict.text}&rdquo;
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginBottom: 8 }}>
                No check-in yet today
              </div>
            )}

            {/* Mood selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              {MOOD_OPTIONS.map(({ value, border, bg }) => (
                <div
                  key={value}
                  role="button"
                  tabIndex={0}
                  onClick={() => onMoodSelect(value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onMoodSelect(value) }}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: `1.5px solid ${border}`,
                    background: moodScore === value ? bg : 'transparent',
                    cursor: 'pointer',
                    transform: moodScore === value ? 'scale(1.25)' : 'scale(1)',
                    transition: 'transform 0.15s',
                    flexShrink: 0,
                  }}
                />
              ))}
              {moodLoggedAt && (
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>
                  {formatMoodTimestamp(moodLoggedAt)}
                </span>
              )}
            </div>

            {!hasCheckedInToday && (
              <button
                type="button"
                onClick={() => openOracle('', 'morning_checkin')}
                style={{ width: '100%', background: 'rgba(147,51,234,0.12)', border: '0.5px solid rgba(147,51,234,0.35)', borderRadius: 8, color: '#C084FC', fontSize: 10, padding: '7px 0', cursor: 'pointer', ...font }}
              >
                Start morning check-in
              </button>
            )}
          </div>

          {/* Witness */}
          {witnessInsight && !witnessDismissed && (
            <div style={{ background: 'rgba(147,51,234,0.04)', borderLeft: '2px solid #9333EA', borderRadius: '0 8px 8px 0', padding: '8px 10px', marginBottom: 10, position: 'relative' }}>
              <button type="button" onClick={onDismissWitness} style={{ position: 'absolute', top: 6, right: 8, background: 'transparent', border: 'none', color: '#3D2878', fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: '2px 4px', ...font }}>×</button>
              <div style={{ fontSize: 7, fontWeight: 600, color: '#6B3FA0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>The Witness</div>
              <div style={{ fontSize: 10, color: '#C0B0E0', lineHeight: 1.6, fontStyle: 'italic', paddingRight: 16 }}>
                &ldquo;{witnessInsight}&rdquo;
              </div>
            </div>
          )}

          {/* Active quests */}
          <span style={secLabel}>Active quests</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {quests.length === 0 ? (
              <div style={{ fontSize: 11, color: '#5A4A7A', textAlign: 'center', padding: '12px 0' }}>No active quests</div>
            ) : quests.map((quest) => {
              const char = CHARACTERS[quest.dimension]
              const level = getLevel(quest.xp)
              const pct = Math.round(getLevelProgress(quest.xp) * 100)
              const pendingTasks = quest.todays_tasks?.filter(t => !t.completed).length ?? 0
              return (
                <div
                  key={quest.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/${DIMENSION_TO_SLUG[quest.dimension]}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/${DIMENSION_TO_SLUG[quest.dimension]}`) }}
                  style={{ background: '#110828', border: `0.5px solid ${char.color}30`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: char.color, flex: 1, marginRight: 8 }}>{quest.vision}</span>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{char.name} · Lv {level}</span>
                  </div>
                  <div style={{ height: 3, background: '#2D1B55', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: char.color, borderRadius: 2, opacity: 0.7 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                    <span>{char.categoryLabel}</span>
                    <span>{pendingTasks > 0 ? `${pendingTasks} task${pendingTasks > 1 ? 's' : ''} today` : `${pct}% XP`}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
