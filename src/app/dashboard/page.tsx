'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  BlazeCharacterLarge,
  EchoCharacterLarge,
  ForgeCharacterLarge,
  RootCharacterLarge,
  SageCharacterLarge,
  SolCharacterLarge,
  VaultCharacterLarge,
} from '@/components/characters/CharacterHeroArt'
import { XpToastOverlay, showXpFeedback, type LevelUpToast, type XpToast } from '@/components/XpToastOverlay'
import { ALL_DIMENSIONS, CHARACTERS, getCharacterTierLabel, type Dimension } from '@/lib/character'
import { formatCyclePhase, getHpTier, getOracleVerdict } from '@/lib/oura'
import { DIMENSION_TO_SLUG } from '@/lib/tierName'
import { getLevel, getLevelProgress } from '@/lib/xp'
import { getMedalDefinitions } from '@/lib/medals'
import type { MedalDefinition } from '@/lib/medals'
import { getUserId } from '@/lib/user'
import { openOracle } from '@/lib/oracle-events'
import { TopNav } from '@/components/TopNav'
import { useIsDesktop } from '@/lib/useIsDesktop'
import DesktopDashboard from '@/components/desktop/DesktopDashboardV2'

interface VitalityData {
  hp: number
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
  cycle_day: number | null
  cycle_phase: string | null
  mood_today: number | null
  mood_last_logged_at: string | null
}

interface TaskRow {
  id: string
  title: string
  completed: boolean
  xp_reward: number
}

interface MainQuest {
  id: string
  dimension: Dimension
  vision: string
  xp: number
  streak_days?: number
  todays_tasks?: TaskRow[]
}

interface CalendarEventRow {
  id: string
  title: string
  start: string
  end: string
}

interface TodayItem {
  id: string
  type: 'task' | 'event'
  title: string
  time: string | null
  timeEnd: string | null
  endIso: string | null   // original ISO end time, used to detect past events
  dimension: Dimension | null
  completed: boolean
  xp_reward: number
  color: string
}


const HP_CIRCUMFERENCE = 2 * Math.PI * 34

const HERO_MINI: Record<Dimension, ComponentType> = {
  career: ForgeCharacterLarge,
  social: EchoCharacterLarge,
  wealth: VaultCharacterLarge,
  vitality: BlazeCharacterLarge,
  mind: SageCharacterLarge,
  love: SolCharacterLarge,
  family: RootCharacterLarge,
}

const MOOD_OPTIONS = [
  { value: 1, border: '#ef4444', bg: '#3B0010' },
  { value: 2, border: '#fb923c', bg: '#3B1A0A' },
  { value: 3, border: '#fbbf24', bg: '#2A2500' },
  { value: 4, border: '#34d399', bg: '#0D2A10' },
  { value: 5, border: '#a855f7', bg: '#1A0830' },
] as const

const MOOD_LABELS: Record<number, { text: string; color: string }> = {
  1: { text: 'Rough', color: '#ef4444' },
  2: { text: 'Low', color: '#fb923c' },
  3: { text: 'Okay', color: '#fbbf24' },
  4: { text: 'Good', color: '#34d399' },
  5: { text: 'Energised', color: '#a855f7' },
}

function BiometricBar({
  value,
  color,
  label,
  loading,
}: {
  value: number | null | undefined
  color: string
  label: string
  loading: boolean
}) {
  const pct = loading || value == null ? 0 : value
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ fontSize: 9, color: '#5A4A7A', width: 32, flexShrink: 0 }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 5,
          background: 'rgba(255,255,255,0.07)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 3,
            transition: 'width 0.6s ease-out',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: loading || value == null ? '#5A4A7A' : color,
          width: 22,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {loading ? '--' : value != null ? value : '--'}
      </span>
    </div>
  )
}

function ProtagonistCharacter() {
  return (
    <div style={{ animation: 'protagonist-float 3.2s ease-in-out infinite' }}>
      <svg width="58" height="70" viewBox="0 0 58 70" fill="none">
        <path
          d="M18 14 L21 8 L24 12 L29 6 L34 12 L37 8 L40 14Z"
          fill="#A855F7"
          opacity={0.9}
        />
        <rect x="16" y="13" width="26" height="4" rx="2" fill="#7C3AED" />
        <rect x="12" y="18" width="34" height="26" rx="10" fill="#7C3AED" />
        <circle cx="22" cy="31" r="6.5" fill="#1A0030" />
        <circle cx="36" cy="31" r="6.5" fill="#1A0030" />
        <circle cx="20" cy="29" r="2.2" fill="white" opacity={0.65} />
        <circle cx="34" cy="29" r="2.2" fill="white" opacity={0.65} />
        <path d="M12 26 Q4 34 8 46 L12 44Z" fill="#5B21B6" opacity={0.7} />
        <path d="M46 26 Q54 34 50 46 L46 44Z" fill="#5B21B6" opacity={0.7} />
        <rect x="16" y="46" width="26" height="20" rx="6" fill="#5B21B6" />
        <path
          d="M29 52 L30.5 56 L34.5 56 L31.5 58.5 L32.7 62.5 L29 60 L25.3 62.5 L26.5 58.5 L23.5 56 L27.5 56Z"
          fill="#A855F7"
          opacity={0.7}
        />
      </svg>
    </div>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function formatTimeFromIso(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatTimeRange(start: string, end: string): string {
  const s = formatTimeFromIso(start)
  const e = formatTimeFromIso(end)
  if (!s) return ''
  if (!e || e === s) return s
  return `${s}–${e}`
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekStart(d: Date): Date {
  const day = new Date(d)
  day.setDate(d.getDate() - d.getDay()) // Sunday
  return day
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatMoodTimestamp(iso: string): string {
  const logged = new Date(iso)
  const now = new Date()
  const isToday =
    logged.getFullYear() === now.getFullYear() &&
    logged.getMonth() === now.getMonth() &&
    logged.getDate() === now.getDate()

  const timeStr = logged.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  if (isToday) return timeStr

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    logged.getFullYear() === yesterday.getFullYear() &&
    logged.getMonth() === yesterday.getMonth() &&
    logged.getDate() === yesterday.getDate()

  if (isYesterday) return `Yesterday · ${timeStr}`

  const dayLabel = logged.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return `${dayLabel} · ${timeStr}`
}

const quickAddInputStyle: CSSProperties = {
  width: '100%',
  background: '#1A0D3A',
  border: '0.5px solid #3D2070',
  borderRadius: 8,
  padding: '7px 10px',
  color: '#E8E0F0',
  fontSize: 12,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const primaryButtonStyle: CSSProperties = {
  flex: 1,
  background: '#4A2080',
  border: '0.5px solid #7C3AED',
  borderRadius: 8,
  color: '#C084FC',
  fontSize: 11,
  fontWeight: 500,
  padding: '7px 0',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const ghostButtonStyle: CSSProperties = {
  background: 'transparent',
  border: '0.5px solid #2D1B55',
  borderRadius: 8,
  color: '#5A4A7A',
  fontSize: 11,
  padding: '7px 12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

function ChampionMedalIcon({ icon, earned, color }: { icon: MedalDefinition['icon']; earned: boolean; color: string }) {
  const stroke = earned ? color : '#3D2878'
  const fill = earned ? color : 'none'
  const common = { width: 8, height: 8, viewBox: '0 0 24 24', fill: 'none' as const }
  let path: React.ReactNode
  switch (icon) {
    case 'sword':
      path = <path d="M4 20L14 10M14 10L11 7L17 4L20 10L17 13L14 10Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'pulse':
      path = <path d="M4 12H8L10 6L14 18L16 12H20" stroke={stroke} strokeWidth="1.5" />; break
    case 'skull':
      path = <><circle cx="12" cy="10" r="5" stroke={stroke} strokeWidth="1.5" fill={fill} /><path d="M8 20V16M12 20V16M16 20V16" stroke={stroke} strokeWidth="1.5" /></>; break
    case 'flame':
      path = <path d="M12 3C10 8 6 10 6 14C6 17.3 8.7 20 12 20C15.3 20 18 17.3 18 14C18 10 14 8 12 3Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'star':
      path = <path d="M12 4L14 9H19L15 12L16.5 17L12 14L7.5 17L9 12L5 9H10L12 4Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'shield':
      path = <path d="M12 3L5 6V12C5 16 8 19 12 21C16 19 19 16 19 12V6L12 3Z" stroke={stroke} strokeWidth="1.5" fill={fill} />; break
    case 'trophy':
      path = <><path d="M8 6H16V10C16 12 14 14 12 14C10 14 8 12 8 10V6Z" stroke={stroke} strokeWidth="1.5" fill={fill} /><path d="M12 14V17M9 20H15" stroke={stroke} strokeWidth="1.5" /></>; break
    case 'coin':
      path = <><circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.5" fill={fill} /><path d="M12 8v8M9 10.5h4.5a1.5 1.5 0 0 1 0 3H9" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" /></>; break
    default:
      path = null
  }
  return <svg {...common}>{path}</svg>
}

// ── Module-level cache: survives React unmount/remount in the same browser tab ──
// This means navigating away and back shows data instantly instead of a blank screen.
interface DashboardCache {
  vitality: VitalityData | null
  quests: MainQuest[]
  dimXpMap: Record<string, number>
  dimMedalsMap: Record<string, string[]>
  hasCheckedInToday: boolean
  moodScore: number | null
  moodLoggedAt: string | null
  events: CalendarEventRow[]
  dateStr: string
}
let _cache: DashboardCache | null = null

export default function DashboardPage() {
  const router = useRouter()
  const userIdRef = useRef(getUserId())
  const selectedDateRef = useRef(new Date())

  // Initialise from cache so revisiting the page never shows a blank screen
  const [vitalityLoading, setVitalityLoading] = useState(() => _cache == null)
  const [vitality, setVitality] = useState<VitalityData | null>(() => _cache?.vitality ?? null)
  const [moodScore, setMoodScore] = useState<number | null>(() => _cache?.moodScore ?? null)
  const [moodLoggedAt, setMoodLoggedAt] = useState<string | null>(() => _cache?.moodLoggedAt ?? null)
  const [hasCheckedInToday, setHasCheckedInToday] = useState(() => _cache?.hasCheckedInToday ?? false)
  const [witnessInsight, setWitnessInsight] = useState<string | null>(null)
  const [witnessDismissed, setWitnessDismissed] = useState(false)
  const [quests, setQuests] = useState<MainQuest[]>(() => _cache?.quests ?? [])
  const [events, setEvents] = useState<CalendarEventRow[]>(() => _cache?.events ?? [])
  const [hpDisplay, setHpDisplay] = useState<number | null>(null)
  const [xpToast, setXpToast] = useState<XpToast | null>(null)
  const [levelUpToast, setLevelUpToast] = useState<LevelUpToast | null>(null)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set())
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [reschedulingTaskId, setReschedulingTaskId] = useState<string | null>(null)
  const [pickerTaskId, setPickerTaskId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTaskTitle, setEditTaskTitle] = useState('')
  // Loading state specifically for the Today section (tasks + calendar)
  const [todayLoading, setTodayLoading] = useState(() => _cache == null)
  const todayDate = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => toDateStr(todayDate), [todayDate])
  const [selectedDate, setSelectedDate] = useState<Date>(todayDate)
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))

  const selectDate = useCallback((d: Date) => {
    selectedDateRef.current = d
    setSelectedDate(d)
  }, [])
  const [dimXpMap, setDimXpMap] = useState<Record<string, number>>(() => _cache?.dimXpMap ?? {})
  const [dimMedalsMap, setDimMedalsMap] = useState<Record<string, string[]>>(() => _cache?.dimMedalsMap ?? {})
  const [dimBaselineMap, setDimBaselineMap] = useState<Record<string, number>>({})
  const [verdictKey, setVerdictKey] = useState(0)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddTitle, setQuickAddTitle] = useState('')
  const [quickAddDate, setQuickAddDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  )
  const [quickAddTime, setQuickAddTime] = useState('')
  const [quickAddDuration, setQuickAddDuration] = useState(60)
  const [quickAddError, setQuickAddError] = useState('')
  const [quickAddLoading, setQuickAddLoading] = useState(false)

  const refreshCalendarEvents = useCallback(async (dateStr?: string) => {
    const uid = userIdRef.current
    try {
      await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      })
      const date = dateStr ?? toDateStr(new Date())
      const r = await fetch(
        `/api/calendar/next?userId=${encodeURIComponent(uid)}&limit=20&date=${encodeURIComponent(date)}`
      )
      const d = (await r.json()) as { events?: CalendarEventRow[] }
      if (d.events) setEvents(d.events)
    } catch {
      /* calendar optional */
    }
  }, [])

  // Full dashboard load: vitality + quests + calendar + checkin + medals.
  // Only shows loading state on very first visit (no cache). Subsequent calls
  // refresh in the background without blanking the UI.
  const loadDashboard = useCallback(async (dateOverride?: string) => {
    const uid = userIdRef.current
    const hasCache = _cache != null
    if (!hasCache) setVitalityLoading(true)

    // Fire Oura sync in the background — don't await it, it's slow
    fetch('/api/oura/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid }),
    }).catch(() => {})

    const dateStr = dateOverride ?? toDateStr(new Date())

    const [vitalityRes, questsRes, calRes, checkInRes, medalsRes, scoresRes] = await Promise.allSettled([
      fetch(`/api/dashboard/vitality?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/quests/main?userId=${encodeURIComponent(uid)}&date=${encodeURIComponent(dateStr)}`).then((r) => r.json()),
      fetch(`/api/calendar/next?userId=${encodeURIComponent(uid)}&limit=20&date=${encodeURIComponent(dateStr)}`).then((r) => r.json()),
      fetch(`/api/checkin/today?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/medals/all?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/dimension-score?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
    ])

    // Build updated cache entry from whatever succeeded
    const next: DashboardCache = _cache ?? {
      vitality: null, quests: [], dimXpMap: {}, dimMedalsMap: {},
      hasCheckedInToday: false, moodScore: null, moodLoggedAt: null,
      events: [], dateStr,
    }

    if (vitalityRes.status === 'fulfilled') {
      const v = vitalityRes.value as VitalityData
      setVitality(v)
      setMoodScore(v.mood_today)
      setMoodLoggedAt(v.mood_last_logged_at ?? null)
      next.vitality = v
      next.moodScore = v.mood_today
      next.moodLoggedAt = v.mood_last_logged_at ?? null
    }
    if (questsRes.status === 'fulfilled') {
      const qs = (questsRes.value.quests ?? []) as MainQuest[]
      setQuests(qs)
      next.quests = qs
      next.dateStr = dateStr
      if (questsRes.value.dimXpMap) {
        const xm = questsRes.value.dimXpMap as Record<string, number>
        setDimXpMap(xm)
        next.dimXpMap = xm
      }
    }
    if (medalsRes.status === 'fulfilled') {
      const mm = (medalsRes.value.earned ?? {}) as Record<string, string[]>
      setDimMedalsMap(mm)
      next.dimMedalsMap = mm
    }
    if (scoresRes.status === 'fulfilled') {
      const sm = (scoresRes.value.scores ?? {}) as Record<string, number>
      setDimBaselineMap(sm)
    }
    if (calRes.status === 'fulfilled') {
      const eventsData = (calRes.value.events ?? []) as CalendarEventRow[]
      setEvents(eventsData)
      next.events = eventsData
      // If nothing returned, try a calendar sync then re-fetch once
      if (eventsData.length === 0) {
        fetch('/api/calendar/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid }),
        })
          .then(() => fetch(`/api/calendar/next?userId=${encodeURIComponent(uid)}&limit=10&date=${encodeURIComponent(dateStr)}`))
          .then((r) => r.json())
          .then((d: { events?: CalendarEventRow[] }) => {
            if (d.events?.length) {
              setEvents(d.events)
              if (_cache) _cache.events = d.events
            }
          })
          .catch(() => {})
      }
    }
    if (checkInRes.status === 'fulfilled') {
      const v = Boolean(checkInRes.value.hasCheckIn)
      setHasCheckedInToday(v)
      next.hasCheckedInToday = v
    }

    _cache = next
    setVitalityLoading(false)
    setTodayLoading(false)
  }, [])

  // Light load for date navigation: only tasks + calendar events.
  // Vitality/medals/checkin don't change per date so we skip them.
  const loadDateData = useCallback(async (dateStr: string) => {
    const uid = userIdRef.current
    setTodayLoading(true)
    const [questsRes, calRes] = await Promise.allSettled([
      fetch(`/api/quests/main?userId=${encodeURIComponent(uid)}&date=${encodeURIComponent(dateStr)}`).then((r) => r.json()),
      fetch(`/api/calendar/next?userId=${encodeURIComponent(uid)}&limit=20&date=${encodeURIComponent(dateStr)}`).then((r) => r.json()),
    ])
    if (questsRes.status === 'fulfilled') {
      const qs = (questsRes.value.quests ?? []) as MainQuest[]
      setQuests(qs)
      if (questsRes.value.dimXpMap) setDimXpMap(questsRes.value.dimXpMap as Record<string, number>)
      if (_cache) { _cache.quests = qs; _cache.dateStr = dateStr }
    }
    if (calRes.status === 'fulfilled') {
      const eventsData = (calRes.value.events ?? []) as CalendarEventRow[]
      setEvents(eventsData)
      if (_cache) { _cache.events = eventsData; _cache.dateStr = dateStr }
    }
    setTodayLoading(false)
  }, [])

  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      void loadDashboard(toDateStr(selectedDate))
    } else {
      // Date changed — only refresh tasks + calendar, not vitality/medals/etc.
      void loadDateData(toDateStr(selectedDate))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  useEffect(() => {
    function onOracleClose() {
      void loadDashboard(toDateStr(selectedDateRef.current))
    }
    window.addEventListener('protagonist:oracle-closed', onOracleClose)
    return () => window.removeEventListener('protagonist:oracle-closed', onOracleClose)
  }, [loadDashboard])

  useEffect(() => {
    function onCalendarUpdated() {
      void refreshCalendarEvents()
    }
    window.addEventListener('protagonist:calendar-updated', onCalendarUpdated)
    return () =>
      window.removeEventListener('protagonist:calendar-updated', onCalendarUpdated)
  }, [refreshCalendarEvents])

  useEffect(() => {
    const dismissKey = `witness_dismissed_${new Date().toISOString().slice(0, 7)}`
    if (localStorage.getItem(dismissKey) === 'true') {
      setWitnessDismissed(true)
      return
    }
    const uid = userIdRef.current
    fetch(`/api/witness?userId=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((d: { insight?: string | null }) => {
        if (d.insight) setWitnessInsight(d.insight)
      })
      .catch(() => {})
  }, [])

  const handleResetCheckin = useCallback(async () => {
    await fetch('/api/dev/reset-checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userIdRef.current }),
    })
    setHasCheckedInToday(false)
    setMoodScore(null)
    setMoodLoggedAt(null)
  }, [])

  async function handleQuickAddSubmit() {
    if (!quickAddTitle.trim()) {
      setQuickAddError('Event title is required')
      return
    }
    setQuickAddLoading(true)
    setQuickAddError('')

    const res = await fetch('/api/calendar/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userIdRef.current,
        title: quickAddTitle.trim(),
        date: quickAddDate,
        startTime: quickAddTime || undefined,
        durationMinutes: quickAddDuration,
      }),
    })

    if (res.status === 403) {
      setQuickAddError(
        'Google Calendar needs updated permissions. Reconnect in Settings.'
      )
    } else if (!res.ok) {
      setQuickAddError("Couldn't add event — try again.")
    } else {
      setQuickAddTitle('')
      setQuickAddTime('')
      setQuickAddDuration(60)
      setShowQuickAdd(false)
      void refreshCalendarEvents(selectedDateStr)
    }
    setQuickAddLoading(false)
  }

  useEffect(() => {
    if (vitality?.hp == null) return
    const target = vitality.hp
    const start = performance.now()
    const duration = 600
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setHpDisplay(Math.round(target * eased))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [vitality?.hp])

  const oracleInput = useMemo(
    () => ({
      readiness_score: vitality?.readiness_score ?? null,
      sleep_score: vitality?.sleep_score ?? null,
      cycle_phase: vitality?.cycle_phase ?? null,
    }),
    [vitality]
  )

  const verdict = getOracleVerdict(oracleInput, moodScore)
  const maxStreak = useMemo(
    () => Math.max(0, ...quests.map((q) => q.streak_days ?? 0)),
    [quests]
  )
  const hpValue = vitalityLoading ? null : (hpDisplay ?? vitality?.hp ?? null)
  const hpTier = hpValue != null ? getHpTier(hpValue) : null
  const cycleLabel = formatCyclePhase(vitality?.cycle_phase ?? null, vitality?.cycle_day ?? null)

  const selectedDateStr = useMemo(() => toDateStr(selectedDate), [selectedDate])
  const isToday = selectedDateStr === todayStr

  const todayItems = useMemo(() => {
    const items: TodayItem[] = []

    for (const quest of quests) {
      for (const task of quest.todays_tasks ?? []) {
        items.push({
          id: task.id,
          type: 'task',
          title: task.title,
          time: null,
          timeEnd: null,
          endIso: null,
          dimension: quest.dimension,
          completed: task.completed,
          xp_reward: task.xp_reward ?? 50,
          color: CHARACTERS[quest.dimension].color,
        })
      }
    }

    for (const ev of events) {
      items.push({
        id: ev.id,
        type: 'event',
        title: ev.title,
        time: formatTimeFromIso(ev.start),
        timeEnd: formatTimeFromIso(ev.end),
        endIso: ev.end || null,
        dimension: null,
        completed: false,
        xp_reward: 0,
        color: '#3b82f6',
      })
    }

    items.sort((a, b) => {
      // Events always before tasks
      if (a.type === 'event' && b.type === 'task') return -1
      if (a.type === 'task' && b.type === 'event') return 1
      // Both events: sort by time
      if (a.type === 'event' && b.type === 'event') {
        if (a.time && b.time) return a.time.localeCompare(b.time)
        if (a.time && !b.time) return -1
        if (!a.time && b.time) return 1
        return 0
      }
      // Both tasks: preserve original order (don't sink completed to bottom mid-session)
      return 0
    })

    return items
  }, [quests, events])


  function handleMoodSelect(score: number) {
    setMoodScore(score)
    setVerdictKey((k) => k + 1)
    const uid = userIdRef.current
    void fetch('/api/mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, mood_score: score }),
    })
      .then((res) => res.json())
      .then((data: { mood?: { created_at?: string } }) => {
        if (data.mood?.created_at) setMoodLoggedAt(data.mood.created_at)
      })
      .catch(() => {})
  }

  async function handleCompleteTask(item: TodayItem) {
    if (item.type !== 'task' || item.completed || !item.dimension) return
    setCompletingTaskId(item.id)

    setQuests((prev) =>
      prev.map((q) => ({
        ...q,
        todays_tasks: q.todays_tasks?.map((t) =>
          t.id === item.id ? { ...t, completed: true } : t
        ),
      }))
    )

    try {
      const res = await fetch(`/api/quests/tasks/${item.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userIdRef.current }),
      })
      const data = (await res.json()) as {
        xp_earned?: number
        leveled_up?: boolean
        new_level?: number
      }
      if (res.ok) {
        showXpFeedback(
          { dimension: item.dimension },
          data,
          setXpToast,
          setLevelUpToast
        )
        setJustCompletedIds((prev) => new Set(prev).add(item.id))
        setTimeout(() => {
          setJustCompletedIds((prev) => {
            const next = new Set(prev)
            next.delete(item.id)
            return next
          })
        }, 700)
        void loadDashboard()
      }
    } catch {
      void loadDashboard()
    } finally {
      setCompletingTaskId(null)
    }
  }

  function getTomorrowStr() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  async function handleRescheduleTask(id: string, newDate: string | null) {
    setReschedulingTaskId(id)
    // Optimistic: remove from current day's list immediately
    setQuests((prev) =>
      prev.map((q) => ({
        ...q,
        todays_tasks: q.todays_tasks?.filter((t) => t.id !== id),
      }))
    )
    setExpandedTaskId(null)
    try {
      await fetch(`/api/quests/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userIdRef.current, task_date: newDate }),
      })
    } finally {
      setReschedulingTaskId(null)
    }
  }

  async function handleEditTask(id: string, newTitle: string) {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    // Optimistic update
    setQuests((prev) =>
      prev.map((q) => ({
        ...q,
        todays_tasks: q.todays_tasks?.map((t) =>
          t.id === id ? { ...t, title: trimmed } : t
        ),
      }))
    )
    setEditingTaskId(null)
    await fetch(`/api/quests/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userIdRef.current, title: trimmed }),
    }).catch(() => {})
  }

  async function handleDeleteTask(id: string) {
    // Optimistic: remove immediately
    setQuests((prev) =>
      prev.map((q) => ({
        ...q,
        todays_tasks: q.todays_tasks?.filter((t) => t.id !== id),
      }))
    )
    setExpandedTaskId(null)
    await fetch(`/api/quests/tasks/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userIdRef.current }),
    }).catch(() => {})
  }

  const dashOffset =
    hpValue != null ? HP_CIRCUMFERENCE * (1 - hpValue / 100) : HP_CIRCUMFERENCE

  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <>
        <DesktopDashboard
          vitality={vitality}
          vitalityLoading={vitalityLoading}
          hpValue={hpValue}
          hpTier={hpTier}
          dashOffset={dashOffset}
          hpCircumference={HP_CIRCUMFERENCE}
          cycleLabel={cycleLabel}
          maxStreak={maxStreak}
          verdict={verdict}
          verdictKey={verdictKey}
          moodScore={moodScore}
          moodLoggedAt={moodLoggedAt}
          hasCheckedInToday={hasCheckedInToday}
          witnessInsight={witnessInsight}
          witnessDismissed={witnessDismissed}
          quests={quests}
          dimXpMap={dimXpMap}
          dimBaselineMap={dimBaselineMap}
          dimMedalsMap={dimMedalsMap}
          todayItems={todayItems}
          todayLoading={todayLoading}
          selectedDate={selectedDate}
          todayDate={todayDate}
          weekStart={weekStart}
          expandedTaskId={expandedTaskId}
          editingTaskId={editingTaskId}
          editTaskTitle={editTaskTitle}
          completingTaskId={completingTaskId}
          justCompletedIds={justCompletedIds}
          reschedulingTaskId={reschedulingTaskId}
          pickerTaskId={pickerTaskId}
          showQuickAdd={showQuickAdd}
          onMoodSelect={handleMoodSelect}
          onCompleteTask={handleCompleteTask}
          onExpandTask={setExpandedTaskId}
          onReschedule={handleRescheduleTask}
          onDelete={handleDeleteTask}
          onStartEdit={(id, title) => { setEditingTaskId(id); setEditTaskTitle(title) }}
          onEditTitleChange={setEditTaskTitle}
          onCancelEdit={() => setEditingTaskId(null)}
          onSaveEdit={handleEditTask}
          onPickerToggle={setPickerTaskId}
          onDateSelect={selectDate}
          onWeekBack={() => {
            const prev = new Date(weekStart)
            prev.setDate(prev.getDate() - 7)
            setWeekStart(prev)
          }}
          onWeekForward={() => {
            const next = new Date(weekStart)
            next.setDate(next.getDate() + 7)
            setWeekStart(next)
          }}
          onDismissWitness={() => {
            setWitnessDismissed(true)
            const dismissKey = `witness_dismissed_${new Date().toISOString().slice(0, 7)}`
            localStorage.setItem(dismissKey, 'true')
          }}
          onToggleQuickAdd={() => setShowQuickAdd((v) => !v)}
        />
        <XpToastOverlay xpToast={xpToast} levelUpToast={levelUpToast} />
      </>
    )
  }

  return (
    <main
      className="dashboard-scroll"
      style={{
        background: '#0D0820',
        minHeight: '100dvh',
        padding: '44px 0 calc(120px + env(safe-area-inset-bottom, 0px))',
        fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        maxWidth: 430,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <TopNav streakDays={maxStreak} />

      <div style={{ padding: '16px 16px 0' }}>

      {/* Greeting */}
      <p style={{ fontSize: 18, fontWeight: 500, color: '#E8E0F0', margin: '0 0 14px' }}>
        {getGreeting()}, Ivana
      </p>

      {/* Vital State */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <ProtagonistCharacter />

        <div style={{ position: 'relative', width: 82, height: 82, flexShrink: 0 }}>
          <svg width="82" height="82" viewBox="0 0 82 82">
            <circle
              cx="41"
              cy="41"
              r="34"
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="7"
            />
            <circle
              cx="41"
              cy="41"
              r="34"
              fill="none"
              stroke={hpTier?.color ?? '#2D1B55'}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={HP_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 41 41)"
              style={{ transition: 'stroke-dashoffset 0.1s linear' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 700, color: '#E8E0F0', lineHeight: 1 }}>
              {hpValue != null ? hpValue : '--'}
            </span>
            <span style={{ fontSize: 9, color: '#6A5A8A' }}>HP</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <BiometricBar label="Ready" value={vitality?.readiness_score} color="#34d399" loading={vitalityLoading} />
            <BiometricBar label="Sleep" value={vitality?.sleep_score} color="#60a5fa" loading={vitalityLoading} />
            <BiometricBar label="Move" value={vitality?.activity_score} color="#fb923c" loading={vitalityLoading} />
          </div>
          {cycleLabel && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: '#2A1040',
                border: '0.5px solid #4A1555',
                borderRadius: 20,
                padding: '3px 10px',
                fontSize: 9,
                color: '#f472b6',
                alignSelf: 'flex-start',
              }}
            >
              ◐ {cycleLabel}
            </div>
          )}
        </div>
      </div>

      {/* Oracle + Mood + Check-in unified card */}
      <div
        style={{
          background: '#110828',
          border: '0.5px solid #2D1B55',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {/* Verdict row */}
        <button
          type="button"
          onClick={() => openOracle('How should I approach today based on my readiness?')}
          style={{
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            borderBottom: '0.5px solid #1E1040',
            padding: '12px 14px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              fontSize: 8,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#3D2878',
              fontWeight: 600,
              marginBottom: 5,
            }}
          >
            Today
          </div>
          <span
            key={verdictKey}
            style={{
              fontSize: 12,
              fontStyle: 'italic',
              color: verdict.color,
              lineHeight: 1.55,
              animation: 'verdict-flash 0.3s ease-out',
            }}
          >
            {verdict.text}
          </span>
        </button>

        {/* Mood + Check-in row */}
        <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#5A4A7A', flexShrink: 0 }}>Mood</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {MOOD_OPTIONS.map((m) => {
              const selected = moodScore === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => void handleMoodSelect(m.value)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    border: `1.5px solid ${m.border}`,
                    background: m.bg,
                    cursor: 'pointer',
                    transform: selected ? 'scale(1.2)' : 'scale(1)',
                    opacity: moodScore != null && !selected ? 0.4 : 1,
                    boxShadow: selected ? `0 0 0 3px ${m.border}33` : 'none',
                    transition: 'transform 0.15s, opacity 0.15s, box-shadow 0.15s',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 600,
                    color: m.border,
                    fontFamily: 'inherit',
                  }}
                  aria-label={`Mood ${m.value}`}
                >
                  {m.value}
                </button>
              )
            })}
          </div>
          {moodScore != null && MOOD_LABELS[moodScore] && (
            <span
              key={moodScore}
              style={{
                fontSize: 10,
                color: MOOD_LABELS[moodScore].color,
                whiteSpace: 'nowrap',
                animation: 'verdict-flash 0.3s ease-out',
              }}
            >
              {MOOD_LABELS[moodScore].text}
              {moodLoggedAt && (
                <span style={{ color: '#3D2D55' }}> · {formatMoodTimestamp(moodLoggedAt)}</span>
              )}
            </span>
          )}
          {hasCheckedInToday ? (
            <button
              type="button"
              onClick={() => void handleResetCheckin()}
              title="Reset today's check-in"
              style={{
                marginLeft: 'auto',
                padding: '6px 11px',
                background: 'transparent',
                border: '0.5px solid #2D1B55',
                borderRadius: 20,
                color: '#3D2878',
                fontSize: 10,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Checked in ✓
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openOracle('Good morning', 'morning_checkin')}
              style={{
                marginLeft: 'auto',
                padding: '6px 11px',
                background: '#1A0D40',
                border: '0.5px solid #4A2080',
                borderRadius: 20,
                color: '#A78BFA',
                fontSize: 10,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Check in
            </button>
          )}
        </div>
      </div>

      {witnessInsight && !witnessDismissed && (
        <div
          style={{
            background: 'linear-gradient(135deg, #12083A 0%, #1A0D35 100%)',
            border: '0.5px solid rgba(147,51,234,0.3)',
            borderLeft: '3px solid #9333EA',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 12,
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setWitnessDismissed(true)
              const dismissKey = `witness_dismissed_${new Date().toISOString().slice(0, 7)}`
              localStorage.setItem(dismissKey, 'true')
            }}
            aria-label="Dismiss"
            style={{
              position: 'absolute',
              top: 8,
              right: 10,
              background: 'transparent',
              border: 'none',
              color: '#3D2878',
              fontSize: 16,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ×
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingRight: 20 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: '#200A45',
                border: '0.5px solid rgba(147,51,234,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="#9333EA" strokeWidth="1.2" />
                <circle cx="8" cy="8" r="2.5" stroke="#C084FC" strokeWidth="1" />
                <circle cx="8" cy="8" r="1.2" fill="#E879F9" />
                <circle cx="7" cy="7" r=".6" fill="white" opacity={0.5} />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: '#6B3FA0',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 5,
                }}
              >
                The Witness
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#C0B0E0',
                  lineHeight: 1.6,
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{witnessInsight}&rdquo;
              </div>
            </div>
          </div>
        </div>
      )}


      <div
        style={{
          height: '0.5px',
          background: '#2D1B55',
          margin: '0 0 16px',
        }}
      />

      {/* Today */}
      <div style={{ marginBottom: 16 }}>
        {/* Row 1: label + add button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: '#E8E0F0' }}>
            {isToday ? 'Today' : selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
            <span style={{ fontSize: 10, fontWeight: 400, color: '#5A4A7A', marginLeft: 6 }}>
              {isToday
                ? selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                : ''}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setShowQuickAdd((v) => !v)}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#1A0D40',
              border: '0.5px solid #4A2080',
              color: '#C084FC',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              lineHeight: 1,
              padding: 0,
              fontFamily: 'inherit',
            }}
            aria-label="Add calendar event"
          >
            +
          </button>
        </div>

        {/* Row 2: ‹ week strip › */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => {
              const prev = new Date(weekStart)
              prev.setDate(prev.getDate() - 7)
              setWeekStart(prev)
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#5A4A7A',
              fontSize: 20,
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
            aria-label="Previous week"
          >
            ‹
          </button>

          <div style={{ display: 'flex', flex: 1, gap: 2 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(weekStart)
              d.setDate(d.getDate() + i)
              const dStr = toDateStr(d)
              const isSelected = dStr === selectedDateStr
              const isTodayDay = dStr === todayStr
              const dayLetter = d.toLocaleDateString('en-GB', { weekday: 'narrow' })
              const dayNum = d.getDate()
              return (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => selectDate(new Date(d))}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    padding: '5px 0 6px',
                    borderRadius: 8,
                    background: isSelected ? '#2A1460' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  aria-label={d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  aria-pressed={isSelected}
                >
                  <span style={{ fontSize: 9, color: isSelected ? '#C084FC' : isTodayDay ? '#7A5FA0' : '#3D2878' }}>
                    {dayLetter}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: isSelected ? 500 : 400, color: isSelected ? '#E8E0F0' : isTodayDay ? '#7A5FA0' : '#5A4A7A' }}>
                    {dayNum}
                  </span>
                  {isTodayDay && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#A78BFA' : '#3D2070' }} />
                  )}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const next = new Date(weekStart)
              next.setDate(next.getDate() + 7)
              setWeekStart(next)
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#5A4A7A',
              fontSize: 20,
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
            aria-label="Next week"
          >
            ›
          </button>
        </div>

        {showQuickAdd && (
          <div
            style={{
              background: '#140C28',
              border: '0.5px solid #3D2070',
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#9370CC',
                marginBottom: 10,
                fontWeight: 500,
              }}
            >
              📅 New Calendar Event
            </div>
            <input
              placeholder="Event title"
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              style={quickAddInputStyle}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                type="date"
                value={quickAddDate}
                onChange={(e) => setQuickAddDate(e.target.value)}
                style={{ ...quickAddInputStyle, flex: 1 }}
              />
              <input
                type="time"
                value={quickAddTime}
                onChange={(e) => setQuickAddTime(e.target.value)}
                style={{ ...quickAddInputStyle, flex: 1 }}
              />
              <select
                value={quickAddDuration}
                onChange={(e) => setQuickAddDuration(Number(e.target.value))}
                style={{ ...quickAddInputStyle, flex: 1 }}
              >
                <option value={30}>30 min</option>
                <option value={60}>1 hr</option>
                <option value={90}>90 min</option>
                <option value={120}>2 hr</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => void handleQuickAddSubmit()}
                disabled={quickAddLoading}
                style={{
                  ...primaryButtonStyle,
                  opacity: quickAddLoading ? 0.6 : 1,
                }}
              >
                {quickAddLoading ? 'Adding...' : 'Add to Calendar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuickAdd(false)
                  setQuickAddError('')
                }}
                style={ghostButtonStyle}
              >
                Cancel
              </button>
            </div>
            {quickAddError && (
              <div style={{ fontSize: 10, color: '#ef4444', marginTop: 6 }}>
                {quickAddError}
              </div>
            )}
          </div>
        )}

        {todayLoading ? (
          /* Skeleton loader — matches the shape of task rows */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
            {[0.7, 0.5, 0.85, 0.6].map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span style={{ width: 80, flexShrink: 0 }} />
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#1E0D40', flexShrink: 0 }} />
                <div style={{ height: 10, borderRadius: 5, background: '#1E0D40', width: `${w * 100}%`, maxWidth: 200 }} />
              </div>
            ))}
          </div>
        ) : todayItems.length === 0 ? (
          <button
            type="button"
            onClick={() => openOracle()}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: '#3D3358',
              fontSize: 12,
              cursor: 'pointer',
              padding: '24px 8px',
              fontFamily: 'inherit',
              textAlign: 'center',
            }}
          >
            Nothing scheduled for today. Ask Oracle to build your plan.
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 420,
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {todayItems.map((item) => {
              const isPast = item.type === 'event' && isToday && !!item.endIso && new Date(item.endIso) < new Date()
              if (item.type === 'event') return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                    opacity: isPast ? 0.38 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <span
                    style={{
                      width: 80,
                      flexShrink: 0,
                      fontSize: 9,
                      color: '#5A4A7A',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      textDecoration: isPast ? 'line-through' : 'none',
                    }}
                  >
                    {item.time && item.timeEnd && item.timeEnd !== item.time
                      ? `${item.time}–${item.timeEnd}`
                      : item.time}
                  </span>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#3b82f6',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: '#C8C0E0',
                    }}
                  >
                    {item.title}
                  </span>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ opacity: 0.6, flexShrink: 0 }}
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="16"
                      rx="2"
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                    />
                    <path d="M3 9h18M8 3v4M16 3v4" stroke="#3b82f6" strokeWidth="1.5" />
                  </svg>
                </div>
              )
              {
                const isExpanded = expandedTaskId === item.id && !item.completed
                return (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Task row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '6px 0 6px',
                        opacity: item.completed ? 0.4 : 1,
                        cursor: item.completed ? 'default' : 'pointer',
                      }}
                    >
                      <span style={{ width: 80, flexShrink: 0 }} />
                      {/* Circle — completes the task */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedTaskId(null)
                          setPickerTaskId(null)
                          void handleCompleteTask(item)
                        }}
                        disabled={item.completed}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: `1.5px solid ${item.completed ? '#34d399' : item.color}`,
                          background: item.completed ? '#34d399' : 'transparent',
                          flexShrink: 0,
                          marginTop: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          cursor: item.completed ? 'default' : 'pointer',
                          '--glow-color': hexToRgba(item.color, 0.65),
                          '--glow-color-fade': hexToRgba(item.color, 0),
                          animation: justCompletedIds.has(item.id)
                            ? 'task-check-glow 0.55s ease-out'
                            : 'none',
                        } as React.CSSProperties}
                        aria-label={item.completed ? 'Completed' : 'Mark complete'}
                      >
                        {completingTaskId === item.id && (
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              border: `1.5px solid ${item.color}`,
                              borderTopColor: 'transparent',
                              animation: 'spin 0.6s linear infinite',
                            }}
                          />
                        )}
                        {item.completed && completingTaskId !== item.id && (
                          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                            <path
                              d="M2.5 5l2 2 3-3.5"
                              stroke="white"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                      {/* Text area — expands action strip */}
                      <div
                        role="button"
                        tabIndex={item.completed ? -1 : 0}
                        onClick={() => {
                          if (!item.completed) {
                            setExpandedTaskId(isExpanded ? null : item.id)
                          }
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !item.completed) {
                            setExpandedTaskId(isExpanded ? null : item.id)
                          }
                        }}
                        style={{ flex: 1, minWidth: 0, cursor: item.completed ? 'default' : 'pointer' }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: isExpanded ? '#E8E0F0' : '#C8C0E0',
                            textDecoration: item.completed ? 'line-through' : 'none',
                          }}
                        >
                          {item.title}
                        </div>
                        {item.dimension && (
                          <div style={{ fontSize: 9, color: item.color, marginTop: 2 }}>
                            {CHARACTERS[item.dimension].name} · +{item.xp_reward} XP
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Inline action strip */}
                    {isExpanded && (
                      <div
                        style={{
                          paddingLeft: 104,
                          paddingBottom: 8,
                          paddingTop: 2,
                        }}
                      >
                        {/* Edit mode: inline title input */}
                        {editingTaskId === item.id ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              autoFocus
                              type="text"
                              value={editTaskTitle}
                              onChange={(e) => setEditTaskTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleEditTask(item.id, editTaskTitle)
                                if (e.key === 'Escape') setEditingTaskId(null)
                              }}
                              style={{
                                flex: 1,
                                background: '#0D0820',
                                border: `0.5px solid ${item.color}60`,
                                borderRadius: 8,
                                padding: '6px 10px',
                                fontSize: 12,
                                color: '#E8E0F0',
                                outline: 'none',
                                fontFamily: 'inherit',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => void handleEditTask(item.id, editTaskTitle)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                border: 'none',
                                background: item.color,
                                color: '#0D0820',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                flexShrink: 0,
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTaskId(null)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: 8,
                                border: '0.5px solid #2D1B55',
                                background: 'transparent',
                                color: '#5A4A7A',
                                fontSize: 14,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                flexShrink: 0,
                                lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                        /* Buttons row */
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTaskId(item.id)
                              setEditTaskTitle(item.title)
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 20,
                              border: '0.5px solid #2D1B55',
                              background: 'transparent',
                              color: '#9B8EC4',
                              fontSize: 10,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ✏️ Edit
                          </button>
                          {/* Tomorrow */}
                          <button
                            type="button"
                            disabled={reschedulingTaskId === item.id}
                            onClick={() => void handleRescheduleTask(item.id, getTomorrowStr())}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 20,
                              border: `0.5px solid ${item.color}60`,
                              background: `${item.color}12`,
                              color: item.color,
                              fontSize: 10,
                              fontWeight: 500,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            → Tomorrow
                          </button>
                          {/* Pick date toggle */}
                          <button
                            type="button"
                            onClick={() => setPickerTaskId(pickerTaskId === item.id ? null : item.id)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 20,
                              border: pickerTaskId === item.id ? `0.5px solid ${item.color}60` : '0.5px solid #2D1B55',
                              background: pickerTaskId === item.id ? `${item.color}12` : 'transparent',
                              color: pickerTaskId === item.id ? item.color : '#7A6090',
                              fontSize: 10,
                              fontWeight: 500,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            📅 Pick date
                          </button>
                          {/* Someday */}
                          <button
                            type="button"
                            disabled={reschedulingTaskId === item.id}
                            onClick={() => void handleRescheduleTask(item.id, null)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 20,
                              border: '0.5px solid #2D1B55',
                              background: 'transparent',
                              color: '#5A4A7A',
                              fontSize: 10,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Someday
                          </button>
                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => void handleDeleteTask(item.id)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 20,
                              border: '0.5px solid rgba(239,68,68,0.3)',
                              background: 'rgba(239,68,68,0.06)',
                              color: '#ef4444',
                              fontSize: 10,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                        )}
                        {/* Real date input — shown when picker toggled */}
                        {pickerTaskId === item.id && (
                          <input
                            type="date"
                            autoFocus
                            min={getTomorrowStr()}
                            onChange={(e) => {
                              if (e.target.value) {
                                setPickerTaskId(null)
                                void handleRescheduleTask(item.id, e.target.value)
                              }
                            }}
                            style={{
                              marginTop: 8,
                              width: '100%',
                              background: '#0D0820',
                              border: '0.5px solid #2D1B55',
                              borderRadius: 8,
                              padding: '7px 10px',
                              fontSize: 12,
                              color: '#E8E0F0',
                              outline: 'none',
                              fontFamily: 'inherit',
                              colorScheme: 'dark',
                              boxSizing: 'border-box',
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              }
            })}
          </div>
        )}
      </div>

      <div
        style={{
          height: '0.5px',
          background: '#2D1B55',
          margin: '0 0 16px',
        }}
      />

      {/* Champions */}
      <div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#E8E0F0',
            display: 'block',
            marginBottom: 10,
          }}
        >
          Champions
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...ALL_DIMENSIONS]
            .sort((a, b) => {
              const xpA = Math.max(dimXpMap[a] ?? 0, quests.find((q) => q.dimension === a)?.xp ?? 0)
              const xpB = Math.max(dimXpMap[b] ?? 0, quests.find((q) => q.dimension === b)?.xp ?? 0)
              return xpB - xpA
            })
            .map((dim) => {
            const quest = quests.find((q) => q.dimension === dim)
            const char = CHARACTERS[dim]
            // Take the higher of both XP sources — guards against stale zeros in either
            const xp = Math.max(dimXpMap[dim] ?? 0, quest?.xp ?? 0)
            const level = getLevel(xp)
            const pct = Math.round(getLevelProgress(xp) * 100)
            const Hero = HERO_MINI[dim]
            const streak = quest?.streak_days ?? 0
            const taskCount = quest?.todays_tasks?.filter((t) => !t.completed).length ?? 0
            const earnedKeys = dimMedalsMap[dim] ?? []
            const medalDefs = getMedalDefinitions(dim).slice(0, 5)

            return (
              <div
                key={dim}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/${DIMENSION_TO_SLUG[dim]}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    router.push(`/${DIMENSION_TO_SLUG[dim]}`)
                  }
                }}
                style={{
                  background: '#140C28',
                  border: '0.5px solid #2D1B55',
                  borderRadius: 12,
                  padding: '8px 10px 8px 14px',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                {/* Colour accent bar */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: char.color,
                  }}
                />

                {/* Character art — unchanged */}
                <div
                  style={{
                    marginLeft: 4,
                    flexShrink: 0,
                    width: 38,
                    height: 46,
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      transform: 'scale(0.38)',
                      transformOrigin: 'top left',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}
                  >
                    <Hero />
                  </div>
                </div>

                {/* Middle: name + tier + task count, vision, XP bar, medals */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, color: '#E8E0F0', fontWeight: 500 }}>
                      {char.name}
                    </span>
                    <span style={{ fontSize: 9, color: '#5A4A7A', whiteSpace: 'nowrap' }}>
                      {getCharacterTierLabel(dim, xp)}
                      {taskCount > 0 && (
                        <span style={{ color: `${char.color}99` }}>
                          {' · '}{taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: '#8A80A8',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: 5,
                    }}
                  >
                    {quest?.vision || 'No active quest yet'}
                  </div>
                  <div
                    style={{
                      height: 3,
                      background: '#2D1B55',
                      borderRadius: 2,
                      overflow: 'hidden',
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: char.color,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  {/* Medal icons row */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {medalDefs.map((medal) => {
                      const isEarned = earnedKeys.includes(medal.key)
                      return (
                        <div
                          key={medal.key}
                          title={isEarned ? medal.label : medal.hint}
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: isEarned ? `${char.color}20` : 'rgba(30,13,64,0.6)',
                            border: `0.5px solid ${isEarned ? `${char.color}60` : '#1E0D40'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <ChampionMedalIcon
                            icon={medal.icon}
                            earned={isEarned}
                            color={char.color}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Right: category pill + level badge + streak */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 4,
                    flexShrink: 0,
                    paddingLeft: 4,
                  }}
                >
                  <span
                    style={{
                      background: 'transparent',
                      border: `0.5px solid ${char.color}`,
                      borderRadius: 20,
                      padding: '2px 7px',
                      fontSize: 8,
                      color: char.color,
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {char.categoryLabel}
                  </span>
                  <span
                    style={{
                      background: '#1E0D40',
                      borderRadius: 6,
                      padding: '2px 6px',
                      fontSize: 9,
                      color: '#7A5FA0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Lv {level}
                  </span>
                  {streak > 0 && (
                    <span style={{ fontSize: 9, color: '#fb923c' }}>🔥 {streak}d</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      </div>

      <XpToastOverlay xpToast={xpToast} levelUpToast={levelUpToast} />
    </main>
  )
}
