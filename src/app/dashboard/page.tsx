'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import ScoreRing from '@/components/ScoreRing'
import ForgeCharacter from '@/components/characters/ForgeCharacter'
import EchoCharacter from '@/components/characters/EchoCharacter'
import VaultCharacter from '@/components/characters/VaultCharacter'
import ProtagonistCharacter from '@/components/characters/ProtagonistCharacter'
import OracleButton from '@/components/characters/OracleButton'
import { getLevel, getLevelProgress, getTier } from '@/lib/xp'
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
  xp: number
}

interface CalendarEvent {
  title: string
  start: string
}

function getArcVerdict(
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

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
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

function XPToast({ xp, show }: { xp: number; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          style={{
            position: 'fixed',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#FAC775',
            color: '#412402',
            padding: '8px 18px',
            borderRadius: 20,
            fontSize: 14,
            fontWeight: 500,
            zIndex: 50,
          }}
        >
          +{xp} XP
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const CHARACTER_COMPONENTS = {
  career: ForgeCharacter,
  social: EchoCharacter,
  wealth: VaultCharacter,
} as const

const FLOAT_DELAYS = { career: 0, social: 1.2, wealth: 0.6 }

function WealthProgress({ userId }: { userId: string }) {
  const [wealth, setWealth] = useState<{
    net_worth: number | null
    fire_goal: number
    fire_year: number
  } | null>(null)

  useEffect(() => {
    fetch(`/api/wealth?userId=${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setWealth)
      .catch(() => {})
  }, [userId])

  if (!wealth?.net_worth) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px' }}>
        <span style={{ fontSize: 12, color: '#3D3358', fontStyle: 'italic' }}>
          Add your net worth to track progress
        </span>
      </div>
    )
  }

  const pct = Math.min((wealth.net_worth / wealth.fire_goal) * 100, 100)
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '7px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#C8C0D8' }}>
          €{wealth.net_worth.toLocaleString()}
        </span>
        <span style={{ fontSize: 11, color: '#4A4060' }}>
          €{(wealth.fire_goal / 1000).toFixed(0)}k goal
        </span>
      </div>
      <div
        style={{
          background: 'rgba(255,255,255,0.07)',
          height: 4,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 1 }}
          style={{ height: '100%', background: '#1D9E75', borderRadius: 2 }}
        />
      </div>
    </div>
  )
}

interface MissionCardProps {
  quest: MainQuest
  userId: string
  onCompleteTask: (taskId: string, xpReward: number, dimension: string) => void
  completingTaskId: string | null
}

function MissionCard({ quest, userId, onCompleteTask, completingTaskId }: MissionCardProps) {
  const dim = quest.dimension as Dimension
  const char = CHARACTERS[dim] ?? CHARACTERS.career
  const CharSVG = CHARACTER_COMPONENTS[dim] ?? ForgeCharacter
  const tier = getTier(quest.xp)
  const level = getLevel(quest.xp)
  const progressPct = Math.round(getLevelProgress(quest.xp) * 100)
  const tierLabel = char.tierLabels[tier - 1]
  const milestone = quest.active_milestone
  const days =
    milestone?.target_date ? daysUntil(milestone.target_date) : null
  const isWealth = dim === 'wealth'

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: 'easeOut', duration: 0.45 }}
      style={{
        background: '#140C28',
        border: `1.5px solid ${char.color}`,
        borderRadius: 16,
        padding: '12px 14px',
        marginBottom: 10,
        display: 'flex',
        gap: 12,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 54,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <CharSVG tier={tier} delay={FLOAT_DELAYS[dim] ?? 0} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: char.color,
            background: char.badgeBg,
            border: `0.5px solid ${char.badgeBorder}`,
            padding: '2px 7px',
            borderRadius: 3,
          }}
        >
          Lv.{level}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 2,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 500, color: '#E8E0F0' }}>{char.name}</span>
          <span style={{ fontSize: 10, color: char.color, opacity: 0.8 }}>{tierLabel}</span>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.07)',
            height: 3,
            borderRadius: 2,
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.8 }}
            style={{ height: '100%', background: char.color, borderRadius: 2 }}
          />
        </div>

        <p
          style={{
            fontSize: 11,
            color: '#4A4060',
            margin: '0 0 6px',
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {quest.vision}
        </p>

        {milestone && (
          <p
            style={{
              fontSize: 11,
              color: '#6A6080',
              margin: '0 0 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" style={{ flexShrink: 0 }}>
              <path d="M2 1 L9 1 L9 7 L2 7 L5.5 10 Z" fill={char.color} opacity="0.7" />
            </svg>
            {milestone.title}
            {days !== null && <span style={{ color: '#4A4060' }}> · {days}d left</span>}
          </p>
        )}

        {isWealth ? (
          <WealthProgress userId={userId} />
        ) : quest.today_task ? (
          <button
            type="button"
            onClick={() =>
              !quest.today_task!.completed &&
              onCompleteTask(quest.today_task!.id, quest.today_task!.xp_reward, dim)
            }
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'rgba(255,255,255,0.04)',
              border: 'none',
              borderRadius: 8,
              padding: '6px 8px',
              cursor: quest.today_task.completed ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <motion.div
              animate={quest.today_task.completed ? { scale: [1, 1.3, 1] } : {}}
              style={{
                width: 15,
                height: 15,
                borderRadius: '50%',
                border: `1.5px solid ${char.color}`,
                background: quest.today_task.completed ? char.color : 'transparent',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {quest.today_task.completed && (
                <svg width="8" height="8" viewBox="0 0 8 8">
                  <path
                    d="M1.5 4 L3.5 6 L6.5 2"
                    stroke="#0D0820"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              )}
            </motion.div>
            <span
              style={{
                fontSize: 12,
                color: quest.today_task.completed ? '#4A4060' : '#B8B0C8',
                textDecoration: quest.today_task.completed ? 'line-through' : 'none',
              }}
            >
              {completingTaskId === quest.today_task.id
                ? 'Completing...'
                : quest.today_task.title}
            </span>
            {!quest.today_task.completed && (
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4A4060' }}>
                +{quest.today_task.xp_reward} XP
              </span>
            )}
          </button>
        ) : (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              padding: '6px 8px',
            }}
          >
            <span style={{ fontSize: 12, color: '#3D3358', fontStyle: 'italic' }}>
              No quest today —{' '}
              <Link href="/quests" style={{ color: char.color, textDecoration: 'none' }}>
                add one
              </Link>
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function DashboardPage() {
  const userId = useRef(getUserId())
  const [oura, setOura] = useState<OuraData | null>(null)
  const [quests, setQuests] = useState<MainQuest[]>([])
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [todayMood, setTodayMood] = useState<number | null>(null)
  const [xpToast, setXpToast] = useState<{ xp: number; visible: boolean }>({
    xp: 0,
    visible: false,
  })

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

  async function handleCompleteTask(taskId: string, xpReward: number, dimension: string) {
    setCompletingTaskId(taskId)
    try {
      const res = await fetch(`/api/quests/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.current }),
      })
      const data = await res.json()
      if (res.ok) {
        setQuests((prev) =>
          prev.map((q) =>
            q.today_task?.id === taskId
              ? {
                  ...q,
                  xp: q.xp + (data.xp_earned ?? xpReward),
                  today_task: { ...q.today_task!, completed: true },
                }
              : q
          )
        )
        setXpToast({ xp: data.xp_earned ?? xpReward, visible: true })
        setTimeout(() => setXpToast((t) => ({ ...t, visible: false })), 2000)
      }
    } finally {
      setCompletingTaskId(null)
    }
  }

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

  const arc = oura ? getArcVerdict(oura, todayMood) : null
  const cycleLabel = oura ? formatCyclePhase(oura.cycle_phase, oura.cycle_day) : ''

  const ORDER: Dimension[] = ['career', 'social', 'wealth']
  const sortedQuests = [...quests].sort(
    (a, b) =>
      ORDER.indexOf(a.dimension as Dimension) - ORDER.indexOf(b.dimension as Dimension)
  )

  return (
    <main
      style={{
        background: '#0D0820',
        minHeight: '100vh',
        padding: '0 0 100px 0',
        fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
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
            <ProtagonistCharacter size={50} />
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

          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 14 }}>
            <ScoreRing
              value={oura?.readiness_score ?? null}
              color="#34d399"
              label="Stamina"
            />
            <ScoreRing value={oura?.sleep_score ?? null} color="#60a5fa" label="Mana" />
            <ScoreRing value={oura?.activity_score ?? null} color="#fb923c" label="Power" />
          </div>

          {arc && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <PulsingDot color={arc.color} />
              <p
                style={{
                  fontSize: 13,
                  color: '#C8C0E0',
                  margin: 0,
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}
              >
                {arc.text}
              </p>
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
          sortedQuests.map((q) => (
            <MissionCard
              key={q.id}
              quest={q}
              userId={userId.current}
              onCompleteTask={handleCompleteTask}
              completingTaskId={completingTaskId}
            />
          ))
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

      <XPToast xp={xpToast.xp} show={xpToast.visible} />
    </main>
  )
}
