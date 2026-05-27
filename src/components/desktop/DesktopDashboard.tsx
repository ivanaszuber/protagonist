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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  { value: 1, border: '#ef4444', bg: '#3B0010' },
  { value: 2, border: '#fb923c', bg: '#3B1A0A' },
  { value: 3, border: '#fbbf24', bg: '#2A2500' },
  { value: 4, border: '#34d399', bg: '#0D2A10' },
  { value: 5, border: '#a855f7', bg: '#1A0830' },
] as const

const MOOD_LABELS: Record<number, string> = {
  1: 'Rough', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Energised',
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

// ── Medal icon ────────────────────────────────────────────────────────────────

function ChampionMedalIcon({ icon, earned, color }: { icon: MedalDefinition['icon']; earned: boolean; color: string }) {
  const stroke = earned ? color : '#3D2878'
  const fill = earned ? color : 'none'
  const common = { width: 9, height: 9, viewBox: '0 0 24 24', fill: 'none' as const }
  let path: React.ReactNode
  switch (icon) {
    case 'sword':  path = <path d="M4 20L14 10M14 10L11 7L17 4L20 10L17 13L14 10Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'pulse':  path = <path d="M4 12H8L10 6L14 18L16 12H20" stroke={stroke} strokeWidth="1.5" />; break
    case 'skull':  path = <><circle cx="12" cy="10" r="5" stroke={stroke} strokeWidth="1.5" fill={fill} /><path d="M8 20V16M12 20V16M16 20V16" stroke={stroke} strokeWidth="1.5" /></>; break
    case 'flame':  path = <path d="M12 3C10 8 6 10 6 14C6 17.3 8.7 20 12 20C15.3 20 18 17.3 18 14C18 10 14 8 12 3Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'star':   path = <path d="M12 4L14 9H19L15 12L16.5 17L12 14L7.5 17L9 12L5 9H10L12 4Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'shield': path = <path d="M12 3L5 6V12C5 16 8 19 12 21C16 19 19 16 19 12V6L12 3Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'trophy': path = <><path d="M8 6H16V10C16 12 14 14 12 14C10 14 8 12 8 10V6Z" stroke={stroke} strokeWidth="1.5" fill={fill} /><path d="M12 14V17M9 20H15" stroke={stroke} strokeWidth="1.5" /></>; break
    case 'coin':   path = <><circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.5" fill={fill} /><path d="M12 8v8M9 10.5h4.5a1.5 1.5 0 0 1 0 3H9" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" /></>; break
    default:       path = null
  }
  return <svg {...common}>{path}</svg>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DesktopDashboard(props: DesktopDashboardProps) {
  const {
    vitality, vitalityLoading, hpValue, hpTier, dashOffset, hpCircumference,
    cycleLabel, maxStreak,
    verdict, verdictKey, moodScore, moodLoggedAt, hasCheckedInToday,
    witnessInsight, witnessDismissed,
    quests, dimXpMap, dimMedalsMap,
    todayItems, todayLoading, selectedDate, todayDate, weekStart,
    expandedTaskId, editingTaskId, editTaskTitle, completingTaskId,
    justCompletedIds, reschedulingTaskId, pickerTaskId,
    onMoodSelect, onCompleteTask, onExpandTask, onReschedule, onDelete,
    onStartEdit, onEditTitleChange, onCancelEdit, onSaveEdit,
    onPickerToggle, onDateSelect, onWeekBack, onWeekForward,
    onDismissWitness, onToggleQuickAdd,
  } = props

  void verdictKey // used by parent for animation key

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

  const font: CSSProperties = { fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif' }

  const colScroll: CSSProperties = {
    overflowY: 'auto',
    overflowX: 'hidden',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  }

  // Section label style — readable but subtle
  const sectionLabel: CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '1.8px',
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 600,
    display: 'block',
    marginBottom: 12,
  }

  const muted: CSSProperties = { color: 'rgba(255,255,255,0.45)' }

  return (
    <div style={{ ...font, background: '#0D0820', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: 52,
        background: '#0D0820',
        borderBottom: '0.5px solid rgba(255,255,255,0.07)',
        position: 'sticky', top: 0, zIndex: 40, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ fontSize: 12, letterSpacing: '4px', color: '#C084FC', fontWeight: 600, textTransform: 'uppercase' }}>
            PROTAGONIST
          </span>
          <span style={{ fontSize: 13, ...muted }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {maxStreak > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.25)',
              borderRadius: 20, padding: '5px 12px', fontSize: 12, color: '#F87171',
            }}>
              🔥 {maxStreak}d streak
            </div>
          )}
          <button
            type="button"
            onClick={() => openOracle()}
            style={{
              background: 'rgba(147,51,234,0.15)', border: '0.5px solid rgba(147,51,234,0.45)',
              borderRadius: 20, color: '#C084FC', fontSize: 12, fontWeight: 500,
              padding: '7px 18px', cursor: 'pointer', ...font,
            }}
          >
            ✦ Talk to Oracle
          </button>
        </div>
      </div>

      {/* ── Three-column body ──────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 300px',
        flex: 1, minHeight: 0, overflow: 'hidden',
      }}>

        {/* ══ LEFT: Vital state + Champions ══════════════════════════════ */}
        <div style={{
          ...colScroll,
          borderRight: '0.5px solid rgba(255,255,255,0.06)',
          padding: '20px 16px 32px',
        }}>
          <span style={sectionLabel}>Your state · today</span>

          {/* Vital state row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
            background: '#110828', border: '0.5px solid rgba(255,255,255,0.06)',
            borderRadius: 14, padding: '14px 12px',
          }}>
            {/* Protagonist character */}
            <div style={{ width: 52, height: 60, flexShrink: 0, position: 'relative', overflow: 'visible' }}>
              <div style={{ transform: 'scale(0.52)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
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
            <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
              <svg width="60" height="60" viewBox="0 0 82 82">
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
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#E8E0F0', lineHeight: 1 }}>
                  {hpValue ?? '--'}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>HP</span>
              </div>
            </div>

            {/* Biometric bars */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { label: 'Ready', value: vitality?.readiness_score, color: '#34d399' },
                { label: 'Sleep', value: vitality?.sleep_score,     color: '#60a5fa' },
                { label: 'Move',  value: vitality?.activity_score,  color: '#fb923c' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, ...muted, width: 32, flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${vitalityLoading || value == null ? 0 : value}%`,
                      height: '100%', background: color, borderRadius: 2,
                      transition: 'width 0.6s ease-out',
                    }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: vitalityLoading || value == null ? 'rgba(255,255,255,0.25)' : color, width: 24, textAlign: 'right' }}>
                    {vitalityLoading ? '--' : value ?? '--'}
                  </span>
                </div>
              ))}
              {cycleLabel && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: '#2A1040', border: '0.5px solid #4A1555',
                  borderRadius: 20, padding: '3px 10px', fontSize: 10, color: '#f472b6', marginTop: 2,
                }}>
                  ◐ {cycleLabel}
                </div>
              )}
            </div>
          </div>

          {/* Champions */}
          <span style={{ ...sectionLabel, marginTop: 4 }}>Champions</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    role="button" tabIndex={0}
                    onClick={() => router.push(`/${DIMENSION_TO_SLUG[dim]}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/${DIMENSION_TO_SLUG[dim]}`) }}
                    style={{
                      background: '#140C28',
                      border: `0.5px solid ${needsAttention ? `${char.color}40` : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 12, padding: '9px 12px 9px 14px',
                      position: 'relative', overflow: 'hidden', cursor: 'pointer',
                      display: 'flex', gap: 10, alignItems: 'center',
                    }}
                  >
                    {/* Colour bar */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: char.color }} />

                    {/* Character art */}
                    <div style={{ marginLeft: 4, flexShrink: 0, width: 36, height: 44, position: 'relative' }}>
                      <div style={{ transform: 'scale(0.37)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                        <Hero />
                      </div>
                    </div>

                    {/* Middle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, color: '#E8E0F0', fontWeight: 500 }}>{char.name}</span>
                        <span style={{ fontSize: 10, ...muted }}>
                          · {char.categoryLabel}
                          {taskCount > 0 && <span style={{ color: `${char.color}CC` }}> · {taskCount} task{taskCount > 1 ? 's' : ''}</span>}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 5 }}>
                        {getCharacterTierLabel(dim, xp)}{quest?.vision ? ` · ${quest.vision}` : ' · No active quest'}
                      </div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: char.color, borderRadius: 2 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {medalDefs.map((medal) => {
                          const isEarned = earnedKeys.includes(medal.key)
                          return (
                            <div key={medal.key} title={isEarned ? medal.label : medal.hint}
                              style={{
                                width: 16, height: 16, borderRadius: '50%',
                                background: isEarned ? `${char.color}20` : 'rgba(30,13,64,0.6)',
                                border: `0.5px solid ${isEarned ? `${char.color}60` : '#1E0D40'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              }}>
                              <ChampionMedalIcon icon={medal.icon} earned={isEarned} color={char.color} />
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Right */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: char.color,
                        background: `${char.color}18`, border: `0.5px solid ${char.color}35`,
                        borderRadius: 20, padding: '2px 8px',
                      }}>
                        Lv {level}
                      </span>
                      {needsAttention && (
                        <span style={{
                          fontSize: 8, color: char.color,
                          background: `${char.color}12`, border: `0.5px solid ${char.color}30`,
                          borderRadius: 20, padding: '1px 6px',
                        }}>
                          needs attention
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* ══ CENTER: Today ══════════════════════════════════════════════ */}
        <div style={{ ...colScroll, padding: '20px 28px 32px', borderRight: '0.5px solid rgba(255,255,255,0.06)' }}>

          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 20, fontWeight: 600, color: '#E8E0F0' }}>
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
                background: '#1A0D40', border: '0.5px solid #4A2080',
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
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 22, cursor: 'pointer', padding: '0 6px', lineHeight: 1, ...font }}
            >‹</button>
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
                      background: isSelected ? '#2A1460' : 'transparent',
                      border: isSelected ? '0.5px solid rgba(147,51,234,0.4)' : 'none',
                      cursor: 'pointer', ...font,
                    }}
                  >
                    <span style={{ fontSize: 10, color: isSelected ? '#C084FC' : 'rgba(255,255,255,0.35)' }}>
                      {d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: isSelected ? '#C084FC' : isT ? '#E8E0F0' : 'rgba(255,255,255,0.5)' }}>
                      {d.getDate()}
                    </span>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#9333EA' : isT ? 'rgba(147,51,234,0.5)' : 'transparent' }} />
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={onWeekForward}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 22, cursor: 'pointer', padding: '0 6px', lineHeight: 1, ...font }}
            >›</button>
          </div>

          {/* Items list */}
          {todayLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
              {[0.6, 0.85, 0.5, 0.7].map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                  <div style={{ width: 44, height: 10, borderRadius: 5, background: '#1E0D40' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1E0D40', flexShrink: 0 }} />
                  <div style={{ height: 12, borderRadius: 6, background: '#1E0D40', width: `${w * 100}%` }} />
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
                      <div style={{ width: 46, fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'right', flexShrink: 0, paddingTop: 2 }}>
                        {item.time ?? ''}
                      </div>

                      {/* Dot / check / square */}
                      {isCompleted ? (
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: `${item.color}25`, border: `1.5px solid ${item.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          <svg width="7" height="7" viewBox="0 0 8 8"><path d="M1.5 4L3.5 6L6.5 2" stroke={item.color} strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
                        </div>
                      ) : item.type === 'event' ? (
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(59,130,246,0.15)', border: '1.5px solid #3b82f6', flexShrink: 0, marginTop: 2 }} />
                      ) : (
                        <div
                          style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${item.color}90`, flexShrink: 0, marginTop: 2, cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); void onCompleteTask(item) }}
                        />
                      )}

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, color: isCompleted ? 'rgba(255,255,255,0.35)' : '#E8E0F0',
                          textDecoration: isCompleted ? 'line-through' : 'none', lineHeight: 1.4,
                        }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 11, marginTop: 2, color: item.type === 'event' ? 'rgba(96,165,250,0.6)' : `${item.color}99` }}>
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
                      <div style={{ paddingLeft: 72, paddingBottom: 10 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              autoFocus type="text" value={editTaskTitle}
                              onChange={(e) => onEditTitleChange(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(item.id, editTaskTitle); if (e.key === 'Escape') onCancelEdit() }}
                              style={{ flex: 1, background: '#0D0820', border: `0.5px solid ${item.color}60`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#E8E0F0', outline: 'none', ...font }}
                            />
                            <button type="button" onClick={() => onSaveEdit(item.id, editTaskTitle)}
                              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: item.color, color: '#0D0820', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...font }}>Save</button>
                            <button type="button" onClick={onCancelEdit}
                              style={{ padding: '7px 10px', borderRadius: 8, border: '0.5px solid #2D1B55', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 16, cursor: 'pointer', ...font }}>×</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {[
                              { label: '✏️ Edit',     action: () => onStartEdit(item.id, item.title), s: { border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', background: 'transparent' } },
                              { label: '→ Tomorrow',  action: () => onReschedule(item.id, getTomorrowStr()), s: { border: `0.5px solid ${item.color}60`, color: item.color, background: `${item.color}12` } },
                              { label: 'Someday',     action: () => onReschedule(item.id, null), s: { border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', background: 'transparent' } },
                              { label: 'Delete',      action: () => onDelete(item.id), s: { border: '0.5px solid rgba(239,68,68,0.3)', color: '#ef4444', background: 'rgba(239,68,68,0.06)' } },
                            ].map(({ label, action, s }) => (
                              <button key={label} type="button"
                                onClick={(e) => { e.stopPropagation(); action() }}
                                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', ...s, ...font }}>
                                {label}
                              </button>
                            ))}
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); onPickerToggle(pickerTaskId === item.id ? null : item.id) }}
                              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: pickerTaskId === item.id ? `0.5px solid ${item.color}60` : '0.5px solid rgba(255,255,255,0.1)', color: pickerTaskId === item.id ? item.color : 'rgba(255,255,255,0.4)', background: pickerTaskId === item.id ? `${item.color}12` : 'transparent', ...font }}>
                              📅 Pick date
                            </button>
                          </div>
                        )}
                        {pickerTaskId === item.id && (
                          <input type="date" autoFocus min={getTomorrowStr()}
                            onChange={(e) => { if (e.target.value) { onPickerToggle(null); onReschedule(item.id, e.target.value) } }}
                            style={{ marginTop: 8, width: '100%', background: '#0D0820', border: '0.5px solid #2D1B55', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#E8E0F0', outline: 'none', ...font, colorScheme: 'dark', boxSizing: 'border-box' }}
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
        <div style={{ ...colScroll, padding: '20px 20px 32px' }}>

          {/* Oracle card */}
          <div style={{
            background: '#110828', border: '0.5px solid rgba(147,51,234,0.25)',
            borderRadius: 14, padding: '16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(147,51,234,0.6)', marginBottom: 8, fontWeight: 600 }}>
              Oracle · today
            </div>

            {verdict ? (
              <div style={{ fontStyle: 'italic', fontSize: 13, color: '#C084FC', lineHeight: 1.6, marginBottom: 12 }}>
                &ldquo;{verdict.text}&rdquo;
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginBottom: 12 }}>
                No check-in yet today
              </div>
            )}

            {/* Mood */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              {MOOD_OPTIONS.map(({ value, border, bg }) => (
                <button
                  key={value} type="button"
                  onClick={() => onMoodSelect(value)}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: `2px solid ${border}`,
                    background: moodScore === value ? bg : 'transparent',
                    cursor: 'pointer',
                    transform: moodScore === value ? 'scale(1.25)' : 'scale(1)',
                    transition: 'transform 0.15s',
                    flexShrink: 0,
                    ...font,
                  }}
                  aria-label={`Mood ${value}`}
                />
              ))}
              {moodScore != null && (
                <span style={{ fontSize: 11, ...muted, marginLeft: 4 }}>
                  {MOOD_LABELS[moodScore]}
                  {moodLoggedAt && <span style={{ color: 'rgba(255,255,255,0.25)' }}> · {formatMoodTimestamp(moodLoggedAt)}</span>}
                </span>
              )}
            </div>

            {!hasCheckedInToday && (
              <button type="button" onClick={() => openOracle('', 'morning_checkin')}
                style={{
                  width: '100%', background: 'rgba(147,51,234,0.1)',
                  border: '0.5px solid rgba(147,51,234,0.3)', borderRadius: 10,
                  color: '#C084FC', fontSize: 12, fontWeight: 500,
                  padding: '9px 0', cursor: 'pointer', ...font,
                }}>
                Start morning check-in
              </button>
            )}
          </div>

          {/* Witness */}
          {witnessInsight && !witnessDismissed && (
            <div style={{
              background: 'rgba(147,51,234,0.04)', borderLeft: '2px solid #9333EA',
              borderRadius: '0 10px 10px 0', padding: '10px 12px',
              marginBottom: 14, position: 'relative',
            }}>
              <button type="button" onClick={onDismissWitness}
                style={{ position: 'absolute', top: 8, right: 10, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '2px 4px', ...font }}>×</button>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#6B3FA0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>The Witness</div>
              <div style={{ fontSize: 12, color: '#C0B0E0', lineHeight: 1.6, fontStyle: 'italic', paddingRight: 20 }}>
                &ldquo;{witnessInsight}&rdquo;
              </div>
            </div>
          )}

          {/* Active quests */}
          <span style={sectionLabel}>Active quests</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                    background: '#110828', border: `0.5px solid ${char.color}30`,
                    borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: char.color, flex: 1, marginRight: 10, lineHeight: 1.3 }}>{quest.vision}</span>
                    <span style={{ fontSize: 10, ...muted, whiteSpace: 'nowrap' }}>{char.name} · Lv {level}</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: char.color, borderRadius: 2, opacity: 0.75 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, ...muted }}>
                    <span style={{ color: `${char.color}99` }}>{char.categoryLabel}</span>
                    <span>{pendingTasks > 0 ? `${pendingTasks} task${pendingTasks > 1 ? 's' : ''} today` : `${pct}% to next level`}</span>
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
