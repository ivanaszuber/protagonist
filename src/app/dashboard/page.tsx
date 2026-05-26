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
import { getLevel } from '@/lib/xp'
import { getUserId } from '@/lib/user'
import { openOracle } from '@/lib/oracle-events'
import { TopNav } from '@/components/TopNav'

interface VitalityData {
  hp: number
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
  cycle_day: number | null
  cycle_phase: string | null
  mood_today: number | null
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
}

interface TodayItem {
  id: string
  type: 'task' | 'event'
  title: string
  time: string | null
  dimension: Dimension | null
  completed: boolean
  xp_reward: number
  color: string
}

type TodayTab = 'all' | 'tasks' | 'calendar'

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
  { value: 4, border: '#4ade80', bg: '#0D2A10' },
  { value: 5, border: '#a855f7', bg: '#1A0830' },
] as const

const MOOD_LABELS: Record<number, { text: string; color: string }> = {
  1: { text: 'Rough', color: '#ef4444' },
  2: { text: 'Low', color: '#fb923c' },
  3: { text: 'Okay', color: '#fbbf24' },
  4: { text: 'Good', color: '#4ade80' },
  5: { text: 'Energised', color: '#a855f7' },
}

const BIO_CIRCUMFERENCE = 2 * Math.PI * 13  // r=13, inside a 32px circle

function BiometricRing({
  value,
  color,
  bg,
  label,
  loading,
}: {
  value: number | null | undefined
  color: string
  bg: string
  label: string
  loading: boolean
}) {
  const score = value ?? 0
  const offset = loading || value == null ? BIO_CIRCUMFERENCE : BIO_CIRCUMFERENCE * (1 - score / 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* track */}
          <circle cx="16" cy="16" r="13" fill={bg} stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          {/* progress arc */}
          <circle
            cx="16"
            cy="16"
            r="13"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={BIO_CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: loading || value == null ? 8 : 9,
            fontWeight: 700,
            color: loading || value == null ? '#5A4A7A' : color,
          }}
        >
          {loading ? '--' : value != null ? value : '--'}
        </div>
      </div>
      <span style={{ fontSize: 9, color: '#5A4A7A' }}>{label}</span>
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

function formatTimeFromIso(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
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

export default function DashboardPage() {
  const router = useRouter()
  const userIdRef = useRef(getUserId())

  const [vitalityLoading, setVitalityLoading] = useState(true)
  const [vitality, setVitality] = useState<VitalityData | null>(null)
  const [moodScore, setMoodScore] = useState<number | null>(null)
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false)
  const [witnessInsight, setWitnessInsight] = useState<string | null>(null)
  const [witnessDismissed, setWitnessDismissed] = useState(false)
  const [quests, setQuests] = useState<MainQuest[]>([])
  const [events, setEvents] = useState<CalendarEventRow[]>([])
  const [todayTab, setTodayTab] = useState<TodayTab>('all')
  const [hpDisplay, setHpDisplay] = useState<number | null>(null)
  const [xpToast, setXpToast] = useState<XpToast | null>(null)
  const [levelUpToast, setLevelUpToast] = useState<LevelUpToast | null>(null)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
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

  const refreshCalendarEvents = useCallback(async () => {
    const uid = userIdRef.current
    try {
      await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      })
      const r = await fetch(
        `/api/calendar/next?userId=${encodeURIComponent(uid)}&limit=10`
      )
      const d = (await r.json()) as { events?: CalendarEventRow[] }
      if (d.events) setEvents(d.events)
    } catch {
      /* calendar optional */
    }
  }, [])

  const loadDashboard = useCallback(async () => {
    const uid = userIdRef.current
    setVitalityLoading(true)

    const [vitalityRes, questsRes, calRes, checkInRes] = await Promise.allSettled([
      fetch(`/api/dashboard/vitality?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/quests/main?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/calendar/next?userId=${encodeURIComponent(uid)}&limit=10`).then((r) =>
        r.json()
      ),
      fetch(`/api/checkin/today?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
    ])

    if (vitalityRes.status === 'fulfilled') {
      const v = vitalityRes.value as VitalityData
      setVitality(v)
      setMoodScore(v.mood_today)
    }
    if (questsRes.status === 'fulfilled') {
      setQuests((questsRes.value.quests ?? []) as MainQuest[])
    }
    if (calRes.status === 'fulfilled') {
      const eventsData = (calRes.value.events ?? []) as CalendarEventRow[]
      setEvents(eventsData)

      if (eventsData.length === 0) {
        fetch('/api/calendar/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid }),
        })
          .then(() =>
            fetch(`/api/calendar/next?userId=${encodeURIComponent(uid)}&limit=10`)
          )
          .then((r) => r.json())
          .then((d: { events?: CalendarEventRow[] }) => {
            if (d.events?.length) setEvents(d.events)
          })
          .catch(() => {
            /* calendar optional */
          })
      }
    }
    if (checkInRes.status === 'fulfilled') {
      setHasCheckedInToday(Boolean(checkInRes.value.hasCheckIn))
    }
    setVitalityLoading(false)
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    function onOracleClose() {
      void fetch(`/api/checkin/today?userId=${encodeURIComponent(userIdRef.current)}`)
        .then((r) => r.json())
        .then((d: { hasCheckIn?: boolean }) => {
          setHasCheckedInToday(Boolean(d.hasCheckIn))
          void loadDashboard()
        })
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
      void refreshCalendarEvents()
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

  const todayItems = useMemo(() => {
    const items: TodayItem[] = []

    for (const quest of quests) {
      for (const task of quest.todays_tasks ?? []) {
        items.push({
          id: task.id,
          type: 'task',
          title: task.title,
          time: null,
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
        dimension: null,
        completed: false,
        xp_reward: 0,
        color: '#3b82f6',
      })
    }

    items.sort((a, b) => {
      if (a.time === null && b.time !== null) return -1
      if (a.time !== null && b.time === null) return 1
      if (a.time && b.time) return a.time.localeCompare(b.time)
      return 0
    })

    return items
  }, [quests, events])

  const filteredToday = useMemo(() => {
    if (todayTab === 'tasks') return todayItems.filter((i) => i.type === 'task')
    if (todayTab === 'calendar') return todayItems.filter((i) => i.type === 'event')
    return todayItems
  }, [todayItems, todayTab])

  async function handleMoodSelect(score: number) {
    setMoodScore(score)
    setVerdictKey((k) => k + 1)
    const uid = userIdRef.current
    await fetch('/api/mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, mood_score: score }),
    })
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
        void loadDashboard()
      }
    } catch {
      void loadDashboard()
    } finally {
      setCompletingTaskId(null)
    }
  }

  const dashOffset =
    hpValue != null ? HP_CIRCUMFERENCE * (1 - hpValue / 100) : HP_CIRCUMFERENCE

  return (
    <main
      className="dashboard-scroll"
      style={{
        background: '#0D0820',
        minHeight: '100dvh',
        padding: '44px 0 calc(120px + env(safe-area-inset-bottom, 0px))',
        fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        maxWidth: 430,
        margin: '0 auto',
      }}
    >
      <TopNav streakDays={maxStreak} />

      <div style={{ padding: '16px 16px 0' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BiometricRing label="Ready" value={vitality?.readiness_score} color="#34d399" bg="#16523A" loading={vitalityLoading} />
            <BiometricRing label="Sleep" value={vitality?.sleep_score} color="#60a5fa" bg="#1A2E4A" loading={vitalityLoading} />
            <BiometricRing label="Move" value={vitality?.activity_score} color="#fb923c" bg="#3B1A0A" loading={vitalityLoading} />
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

      {/* Oracle verdict */}
      <button
        type="button"
        onClick={() =>
          openOracle('How should I approach today based on my readiness?')
        }
        style={{
          width: '100%',
          textAlign: 'left',
          background: '#160C30',
          border: '0.5px solid #3D2070',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }}>🔮</span>
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

      {/* Mood */}
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            fontSize: 10,
            color: '#5A4A7A',
            display: 'block',
            marginBottom: 8,
          }}
        >
          How do you feel?
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {MOOD_OPTIONS.map((m) => {
            const selected = moodScore === m.value
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => void handleMoodSelect(m.value)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: `2px solid ${m.border}`,
                  background: m.bg,
                  cursor: 'pointer',
                  transform: selected ? 'scale(1.2)' : 'scale(1)',
                  opacity: moodScore != null && !selected ? 0.45 : 1,
                  boxShadow: selected ? `0 0 0 3px ${m.border}44` : 'none',
                  transition: 'transform 0.15s, opacity 0.15s, box-shadow 0.15s',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
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
          {moodScore != null && MOOD_LABELS[moodScore] && (
            <span
              key={moodScore}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: MOOD_LABELS[moodScore].color,
                marginLeft: 4,
                animation: 'verdict-flash 0.3s ease-out',
              }}
            >
              {MOOD_LABELS[moodScore].text}
            </span>
          )}
        </div>
      </div>

      {/* Check-in */}
      {hasCheckedInToday ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <p style={{ textAlign: 'center', fontSize: 11, color: '#34d399', margin: 0 }}>
            Checked in today ✓
          </p>
          {process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === 'true' && (
            <button
              type="button"
              onClick={() => void handleResetCheckin()}
              title="Dev: reset today's check-in"
              style={{
                background: 'transparent',
                border: '0.5px solid #2D1B55',
                borderRadius: 6,
                color: '#3D2D55',
                fontSize: 10,
                padding: '2px 6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ↺
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openOracle('Good morning', 'morning_checkin')}
          style={{
            width: '100%',
            padding: '12px 14px',
            background: '#1A0D40',
            border: '0.5px solid #4A2080',
            borderRadius: 12,
            color: '#C084FC',
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 16,
            fontFamily: 'inherit',
          }}
        >
          🌅 Good morning — check in with Oracle
        </button>
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: '#E8E0F0' }}>Today</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#5A4A7A' }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
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

        <div
          style={{
            display: 'flex',
            borderBottom: '0.5px solid #2D1B55',
            marginBottom: 12,
          }}
        >
          {(['all', 'tasks', 'calendar'] as TodayTab[]).map((tab) => {
            const active = todayTab === tab
            const label = tab === 'all' ? 'All' : tab === 'tasks' ? 'Tasks' : 'Calendar'
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setTodayTab(tab)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid #9333EA' : '2px solid transparent',
                  color: active ? '#C084FC' : '#5A4A7A',
                  fontWeight: active ? 500 : 400,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textTransform: 'capitalize',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {filteredToday.length === 0 ? (
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredToday.map((item) =>
              item.type === 'event' ? (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                  }}
                >
                  <span
                    style={{
                      width: 34,
                      flexShrink: 0,
                      fontSize: 9,
                      color: '#5A4A7A',
                      textAlign: 'right',
                    }}
                  >
                    {item.time}
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
              ) : (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleCompleteTask(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') void handleCompleteTask(item)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '6px 0',
                    cursor: item.completed ? 'default' : 'pointer',
                    opacity: item.completed ? 0.4 : 1,
                  }}
                >
                  <span style={{ width: 34, flexShrink: 0 }} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
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
                    }}
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#C8C0E0',
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
              )
            )}
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          {ALL_DIMENSIONS.map((dim) => {
            const quest = quests.find((q) => q.dimension === dim)
            const char = CHARACTERS[dim]
            const xp = quest?.xp ?? 0
            const level = getLevel(xp)
            const pct = Math.round(((xp % 500) / 500) * 100)
            const Hero = HERO_MINI[dim]
            const isRoot = dim === 'family'
            const streak = quest?.streak_days ?? 0

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
                  gridColumn: isRoot ? '1 / -1' : undefined,
                  background: '#140C28',
                  border: '0.5px solid #2D1B55',
                  borderRadius: 12,
                  padding: '10px 8px',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
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
                {/* Left: character art + tier label stacked */}
                <div
                  style={{
                    marginLeft: 4,
                    flexShrink: 0,
                    width: 38,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <div style={{ width: 38, height: 46, position: 'relative' }}>
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
                  <span
                    style={{
                      fontSize: 8,
                      color: '#5A4A7A',
                      textAlign: 'center',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getCharacterTierLabel(dim, xp)}
                  </span>
                </div>

                {/* Right: pill+level, name, vision, bar, streak */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Dimension pill + Level badge paired together */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        color: char.color,
                        background: `${char.color}18`,
                        border: `0.5px solid ${char.color}`,
                        borderRadius: 20,
                        padding: '2px 7px',
                        lineHeight: 1.4,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {dim.charAt(0).toUpperCase() + dim.slice(1)}
                    </span>
                    <span
                      style={{
                        background: '#1E0D40',
                        borderRadius: 6,
                        padding: '2px 6px',
                        fontSize: 9,
                        color: '#7A5FA0',
                      }}
                    >
                      Lv {level}
                    </span>
                    {streak > 0 && (
                      <span style={{ fontSize: 9, color: '#fb923c', marginLeft: 'auto' }}>
                        🔥 {streak}d
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#E8E0F0',
                      fontWeight: 500,
                      marginBottom: 2,
                    }}
                  >
                    {char.name}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: '#5A4A7A',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: 6,
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
