'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import OracleButton from '@/components/characters/OracleButton'
import { getLevel, getTier } from '@/lib/xp'
import { CHARACTERS, type Dimension } from '@/lib/character'
import { getUserId } from '@/lib/user'
import MoodTracker from '@/components/MoodTracker'

interface OuraData {
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
  cycle_day: number | null
  cycle_phase: string | null
}

interface MainQuest {
  id: string
  dimension: string
  character_name: string
  vision: string
  active_milestone?: {
    id: string
    title: string
    target_date: string | null
  } | null
  today_task?: {
    id: string
    title: string
    completed: boolean
    xp_reward: number
  } | null
  todays_tasks?: { completed: boolean }[]
  xp: number
}

interface CalendarEvent {
  title: string
  start: string
}

function getOracleVerdict(
  oura: OuraData,
  moodScore: number | null
): { text: string; color: string } {
  const r = oura.readiness_score ?? 0
  const s = oura.sleep_score ?? 0
  const phase = oura.cycle_phase?.toLowerCase() ?? ''

  if (moodScore !== null && moodScore <= 2 && r >= 70) {
    return {
      color: '#fb923c',
      text: `Your body is recovered but you logged ${moodScore === 1 ? 'Depleted' : 'Drained'}. Rest your mind today — slow Forge tasks only.`,
    }
  }

  if (moodScore === 5) {
    return {
      color: '#a855f7',
      text: 'Transcendent mood — rare. Whatever you set out to do today, do it now.',
    }
  }

  if (phase === 'menstrual') {
    return {
      color: '#f472b6',
      text: 'Menstrual phase — rest is the mission today. Let Forge and Echo wait.',
    }
  }
  if (phase === 'ovulatory') {
    if (r >= 85 && s >= 75) {
      return {
        color: '#34d399',
        text: 'Ovulatory peak — your best window for interviews, negotiations, and big asks.',
      }
    }
    return {
      color: '#34d399',
      text: 'Ovulatory phase — high social energy. Push Echo quests and connect boldly.',
    }
  }
  if (phase === 'luteal') {
    if (r < 70) {
      return {
        color: '#fb923c',
        text: 'Luteal phase + low readiness — deep focus work only. Skip social heavy-lifting.',
      }
    }
    return {
      color: '#fb923c',
      text: 'Luteal phase — channel your detail focus into Forge prep work today.',
    }
  }
  if (r >= 85 && s >= 80) {
    return {
      color: '#34d399',
      text: 'All systems optimal. This is a high-leverage day — go after the hard things.',
    }
  }
  if (r >= 75) {
    return {
      color: '#34d399',
      text: 'Follicular phase — energy building. Push hard in your interviews today.',
    }
  }
  if (r >= 60) {
    return {
      color: '#fb923c',
      text: 'Moderate readiness. Prioritise Forge tasks, keep social energy for tomorrow.',
    }
  }
  return {
    color: '#f472b6',
    text: 'Low readiness — protect your energy. One focused task per character.',
  }
}

function formatCyclePhase(phase: string | null, day: number | null): string {
  if (!phase) return ''
  const label = phase.charAt(0).toUpperCase() + phase.slice(1)
  return day ? `${label} · Day ${day}` : label
}

function formatNextEvent(event: CalendarEvent): { title: string; time: string } {
  const d = new Date(event.start)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return {
    title: event.title,
    time: isToday
      ? time
      : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`,
  }
}

function openOracle() {
  window.dispatchEvent(new CustomEvent('protagonist:open-oracle'))
}

function PulsingDot({ color }: { color: string }) {
  return (
    <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0, marginTop: 3 }}>
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }}
        animate={{ scale: [1, 2.8, 1], opacity: [1, 0, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
      />
      <div style={{ position: 'absolute', inset: 1, borderRadius: '50%', background: color }} />
    </div>
  )
}

function StatBar({
  label,
  value,
  color,
}: {
  label: string
  value: number | null
  color: string
}) {
  const pct = value ?? 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: '#5A4A7A' }}>{label}</span>
        <span style={{ fontSize: 10, color: '#7A5FA0' }}>{value ?? '—'}</span>
      </div>
      <div style={{ height: 6, background: '#1E0D40', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: 'width 1s ease',
          }}
        />
      </div>
    </div>
  )
}

function ForgeCharacter() {
  return (
    <svg width="44" height="54" viewBox="0 0 44 54" fill="none">
      <circle cx="39" cy="10" r="3.5" fill="#FAC775" opacity={0.85} />
      <circle cx="35" cy="5" r="1.8" fill="#FAC775" opacity={0.55} />
      <rect x="3" y="8" width="30" height="24" rx="9" fill="#EF9F27" />
      <circle cx="13" cy="20" r="6" fill="#1A0800" />
      <circle cx="26" cy="20" r="6" fill="#1A0800" />
      <circle cx="11" cy="18" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="18" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="34" width="22" height="16" rx="5" fill="#BA7517" />
      <line x1="11" y1="41" x2="25" y2="41" stroke="#EF9F27" strokeWidth="1.5" opacity={0.45} />
      <line x1="11" y1="46" x2="25" y2="46" stroke="#EF9F27" strokeWidth="1" opacity={0.25} />
    </svg>
  )
}

function EchoCharacter() {
  return (
    <svg width="46" height="54" viewBox="0 0 46 54" fill="none">
      <circle cx="38" cy="10" r="3" fill="#FFCAB6" opacity={0.8} />
      <rect x="3" y="8" width="30" height="24" rx="9" fill="#F0997B" />
      <circle cx="13" cy="20" r="6" fill="#1A0800" />
      <circle cx="26" cy="20" r="6" fill="#1A0800" />
      <circle cx="11" cy="18" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="18" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="34" width="22" height="16" rx="5" fill="#D85A30" />
      <path
        d="M33 30Q37 35 33 40"
        stroke="#F0997B"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      <path
        d="M36 27Q42 35 36 43"
        stroke="#F0997B"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.4}
      />
    </svg>
  )
}

function VaultCharacter() {
  return (
    <svg width="42" height="56" viewBox="0 0 42 56" fill="none">
      <circle cx="18" cy="7" r="5.5" fill="#FAC775" opacity={0.95} />
      <circle cx="18" cy="7" r="3.5" fill="#EF9F27" />
      <path d="M17.5 4.5V9.5M15.5 7H21" stroke="#FAC775" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="3" y="12" width="30" height="24" rx="9" fill="#1D9E75" />
      <circle cx="13" cy="24" r="6" fill="#012A1E" />
      <circle cx="26" cy="24" r="6" fill="#012A1E" />
      <circle cx="11" cy="22" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="22" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="38" width="22" height="16" rx="5" fill="#0F6E56" />
      <path
        d="M11 51L16 47L20 49L26 44"
        stroke="#1D9E75"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.75}
      />
    </svg>
  )
}

const CHARACTER_COMPONENTS: Record<string, React.FC> = {
  career: ForgeCharacter,
  social: EchoCharacter,
  wealth: VaultCharacter,
}

const AREA_LABELS: Record<string, string> = {
  career: 'Career',
  social: 'Social',
  wealth: 'Finances',
}

const CHARACTER_COLORS: Record<string, string> = {
  career: '#EF9F27',
  social: '#F0997B',
  wealth: '#1D9E75',
}

const LEFT_BORDER_COLORS: Record<string, string> = {
  career: '#EF9F27',
  social: '#F0997B',
  wealth: '#1D9E75',
}

function MissionCard({
  quest,
  dimension,
  xp,
  level,
  tierLabel,
  todayTasks,
}: {
  quest: { title: string }
  dimension: string
  xp: number
  level: number
  tierLabel: string
  todayTasks: { completed: boolean }[]
}) {
  const CharSvg = CHARACTER_COMPONENTS[dimension] ?? ForgeCharacter
  const areaLabel = AREA_LABELS[dimension] ?? dimension
  const color = CHARACTER_COLORS[dimension] ?? '#9333EA'
  const charName =
    dimension === 'career' ? 'Forge' : dimension === 'social' ? 'Echo' : 'Vault'

  const xpInLevel = xp % 500
  const xpNeeded = 500
  const pct = Math.round((xpInLevel / xpNeeded) * 100)

  const doneTasks = todayTasks.filter((t) => t.completed).length
  const totalTasks = todayTasks.length

  const router = useRouter()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() =>
        router.push(
          dimension === 'career' ? '/forge' : dimension === 'social' ? '/echo' : '/vault'
        )
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          router.push(
            dimension === 'career' ? '/forge' : dimension === 'social' ? '/echo' : '/vault'
          )
        }
      }}
      style={{
        background: '#140C28',
        borderRadius: 14,
        border: '0.5px solid #2D1B55',
        padding: '12px 12px 12px 14px',
        marginBottom: 8,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: LEFT_BORDER_COLORS[dimension] ?? '#9333EA',
        }}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 16, fontWeight: 500, color: '#E8E0F0', lineHeight: 1 }}>
          {areaLabel}
        </span>
        <span style={{ fontSize: 10, color: '#5A4A7A', lineHeight: 1.3 }}>{quest.title}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 9, color: '#5A4A7A', whiteSpace: 'nowrap' }}>
            {xpInLevel}/{xpNeeded} XP
          </span>
          <div
            style={{
              flex: 1,
              height: 4,
              background: '#1E0D40',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: color,
                borderRadius: 2,
                transition: 'width 1s ease',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {todayTasks.map((t, i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: t.completed ? '#34d399' : '#1E0D40',
                border: t.completed ? 'none' : '0.5px solid #3D2878',
              }}
            />
          ))}
          <span style={{ fontSize: 9, color: '#5A4A7A', marginLeft: 3 }}>
            {doneTasks} of {totalTasks} today
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
        }}
      >
        <CharSvg />
        <span style={{ fontSize: 9, fontWeight: 500, color }}>{charName}</span>
        <span style={{ fontSize: 8, color: '#5A4A7A' }}>
          Lv {level} · {tierLabel}
        </span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const userId = useRef(getUserId())
  const [oura, setOura] = useState<OuraData | null>(null)
  const [quests, setQuests] = useState<MainQuest[]>([])
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [todayMood, setTodayMood] = useState<number | null>(null)

  const loadDashboard = useCallback(async () => {
    const uid = userId.current
    setLoading(true)

    const [ouraRes, questsRes, calRes, moodRes] = await Promise.allSettled([
      fetch(`/api/oura/sync?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/quests/main?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/calendar/next?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/mood?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
    ])

    if (ouraRes.status === 'fulfilled' && ouraRes.value?.data) {
      setOura(ouraRes.value.data)
    }
    if (questsRes.status === 'fulfilled' && questsRes.value?.quests) {
      setQuests(questsRes.value.quests)
    }
    if (calRes.status === 'fulfilled' && calRes.value?.event) {
      setNextEvent(calRes.value.event)
    }
    if (moodRes.status === 'fulfilled' && moodRes.value?.mood?.mood_score) {
      setTodayMood(moodRes.value.mood.mood_score)
    }
    setLoading(false)

    try {
      const ouraSync = await fetch('/api/oura/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      }).then((r) => r.json())
      if (ouraSync.data) setOura(ouraSync.data)
    } catch {
      // optional background refresh
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  async function handleSyncOura() {
    try {
      const ouraSync = await fetch('/api/oura/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.current }),
      }).then((r) => r.json())
      if (ouraSync.data) setOura(ouraSync.data)
    } catch {
      // ignore
    }
  }

  const totalXP = quests.reduce((sum, q) => sum + q.xp, 0)
  const avgXP = quests.length > 0 ? Math.floor(totalXP / quests.length) : 0
  const protagonistLevel = getLevel(avgXP)
  const protagonistTiers = ['Wanderer', 'Seeker', 'Legend'] as const
  const protagonistTier =
    protagonistLevel <= 3
      ? protagonistTiers[0]
      : protagonistLevel <= 7
        ? protagonistTiers[1]
        : protagonistTiers[2]

  const oracle = oura ? getOracleVerdict(oura, todayMood) : null
  const cycleLabel = oura ? formatCyclePhase(oura.cycle_phase, oura.cycle_day) : ''

  const ORDER: Dimension[] = ['career', 'social', 'wealth']
  const sortedQuests = [...quests].sort(
    (a, b) =>
      ORDER.indexOf(a.dimension as Dimension) - ORDER.indexOf(b.dimension as Dimension)
  )

  return (
    <main
      className="dashboard-scroll"
      style={{
        background: '#0D0820',
        minHeight: '100vh',
        padding: '0 0 100px 0',
        fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '0 16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '18px 4px 16px',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#3D3358' }}>
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
          <button
            type="button"
            onClick={() => void handleSyncOura()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            aria-label="Sync Oura"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8a6 6 0 1 1 1.5 4"
                stroke="#3D3358"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M2 12V8h4"
                stroke="#3D3358"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div
          style={{
            background: '#140C28',
            border: '0.5px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                background: '#1E0840',
                border: '1.5px solid #9333EA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="34" height="42" viewBox="0 0 34 42" fill="none">
                <path d="M4 14 L8 6 L17 11 L26 6 L30 14Z" fill="#FAC775" />
                <circle cx="4" cy="14" r="2.5" fill="#ef4444" />
                <circle cx="17" cy="10" r="2.5" fill="#22c55e" />
                <circle cx="30" cy="14" r="2.5" fill="#60a5fa" />
                <rect x="4" y="12" width="26" height="20" rx="8" fill="#9333EA" />
                <circle cx="12" cy="22" r="5.5" fill="#1A003A" />
                <circle cx="22" cy="22" r="5.5" fill="#1A003A" />
                <circle cx="10.2" cy="20.2" r="1.8" fill="white" opacity={0.6} />
                <circle cx="20.2" cy="20.2" r="1.8" fill="white" opacity={0.6} />
                <rect x="7" y="34" width="20" height="9" rx="4" fill="#7C3AED" />
                <path
                  d="M17 35.5L18.2 38.8L21.8 38.8L19 40.8L20 44L17 42L14 44L15 40.8L12.2 38.8L15.8 38.8Z"
                  fill="#FAC775"
                  transform="scale(0.52) translate(12,27)"
                />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 500, color: '#E8E0F0' }}>Ivana</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: '#C084FC',
                    background: 'rgba(168,85,247,0.12)',
                    border: '0.5px solid rgba(168,85,247,0.28)',
                    padding: '2px 8px',
                    borderRadius: 3,
                  }}
                >
                  Lv.{protagonistLevel}
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#6A5E80' }}>{protagonistTier}</span>
            </div>
          </div>

          <div
            style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', marginBottom: 14 }}
          />

          <StatBar
            label="Resilience"
            value={oura?.readiness_score ?? null}
            color="#34d399"
          />
          <StatBar label="Sleep" value={oura?.sleep_score ?? null} color="#60a5fa" />
          <StatBar
            label="Activity"
            value={oura?.activity_score ?? null}
            color="#EF9F27"
          />

          {oracle && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
              <PulsingDot color={oracle.color} />
              <span style={{ fontSize: 11, color: '#A090C0', fontStyle: 'italic' }}>
                {oracle.text}
              </span>
            </div>
          )}

          {cycleLabel && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span
                style={{
                  fontSize: 11,
                  color: '#C084FC',
                  background: 'rgba(168,85,247,0.1)',
                  border: '0.5px solid rgba(168,85,247,0.25)',
                  padding: '3px 12px',
                  borderRadius: 20,
                }}
              >
                {cycleLabel}
              </span>
            </div>
          )}

          <MoodTracker
            userId={userId.current}
            onMoodChange={(score) => setTodayMood(score)}
          />
        </div>

        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.06em',
            color: '#3D3358',
            margin: '0 0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M1 11 L5 7 L2 4 L8 1 L11 4 L8 7 L4 10 Z"
              stroke="#3D3358"
              strokeWidth="1"
              strokeLinejoin="round"
              fill="none"
            />
            <line x1="4" y1="8" x2="2" y2="10" stroke="#3D3358" strokeWidth="1" strokeLinecap="round" />
          </svg>
          Active missions
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#3D3358', fontSize: 13 }}>
            Loading your quests...
          </div>
        ) : sortedQuests.length === 0 ? (
          <Link
            href="/quests"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '20px',
              background: '#140C28',
              borderRadius: 16,
              border: '0.5px solid rgba(255,255,255,0.07)',
              color: '#6A6080',
              fontSize: 13,
              textDecoration: 'none',
              marginBottom: 10,
            }}
          >
            No quests yet — tap to begin your journey
          </Link>
        ) : (
          sortedQuests.map((q) => {
            const dim = q.dimension as Dimension
            const char = CHARACTERS[dim] ?? CHARACTERS.career
            const tier = getTier(q.xp)
            const level = getLevel(q.xp)
            const tierLabel = char.tierLabels[tier - 1]
            const todayTasks = (q.todays_tasks ?? []).map((t) => ({
              completed: Boolean(t.completed),
            }))
            const subtitle = q.active_milestone?.title ?? q.vision

            return (
              <MissionCard
                key={q.id}
                quest={{ title: subtitle }}
                dimension={q.dimension}
                xp={q.xp}
                level={level}
                tierLabel={tierLabel}
                todayTasks={todayTasks}
              />
            )
          })
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          {nextEvent ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#140C28',
                border: '0.5px solid rgba(255,255,255,0.07)',
                borderRadius: 20,
                padding: '9px 14px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <rect x="1" y="2" width="12" height="11" rx="2" stroke="#5A5070" strokeWidth="1.2" />
                <line x1="1" y1="5.5" x2="13" y2="5.5" stroke="#5A5070" strokeWidth="1" />
                <line x1="4" y1="1" x2="4" y2="3.5" stroke="#5A5070" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="10" y1="1" x2="10" y2="3.5" stroke="#5A5070" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span
                style={{
                  fontSize: 13,
                  color: '#C8C0D8',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatNextEvent(nextEvent).title}
              </span>
              <span
                style={{ marginLeft: 'auto', fontSize: 12, color: '#3D3358', flexShrink: 0 }}
              >
                {formatNextEvent(nextEvent).time}
              </span>
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}
          <OracleButton onClick={openOracle} />
        </div>
      </div>

    </main>
  )
}
