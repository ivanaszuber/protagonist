'use client'

import { useEffect, useState, useRef, useCallback, type FC } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { getLevel } from '@/lib/xp'
import { CHARACTERS, type Dimension } from '@/lib/character'
import { DIMENSION_TO_SLUG } from '@/lib/tierName'
import { getUserId } from '@/lib/user'
import MoodTracker from '@/components/MoodTracker'
import { StatBar } from '@/components/StatBar'
import { XpToastOverlay, showXpFeedback, type XpToast, type LevelUpToast } from '@/components/XpToastOverlay'

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

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
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
      <path d="M33 30Q37 35 33 40" stroke="#F0997B" strokeWidth="2" strokeLinecap="round" fill="none" opacity={0.85} />
      <path d="M36 27Q42 35 36 43" stroke="#F0997B" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.4} />
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
      <path d="M11 51L16 47L20 49L26 44" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.75} />
    </svg>
  )
}

function BlazeCharacter() {
  return (
    <svg width="44" height="54" viewBox="0 0 44 54" fill="none">
      <path d="M18 8 C18 4 22 2 22 2 C22 2 26 4 26 8 C26 12 22 14 22 14 C22 14 18 12 18 8Z" fill="#F43F5E" opacity={0.9} />
      <path d="M20 9 C20 6.5 22 5 22 5 C22 5 24 6.5 24 9 C24 11 22 12.5 22 12.5 C22 12.5 20 11 20 9Z" fill="#FF6B85" opacity={0.7} />
      <rect x="3" y="12" width="30" height="24" rx="9" fill="#F43F5E" />
      <circle cx="13" cy="24" r="6" fill="#3B0010" />
      <circle cx="26" cy="24" r="6" fill="#3B0010" />
      <circle cx="11" cy="22" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="22" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="38" width="22" height="16" rx="5" fill="#BE123C" />
      <polyline points="9,47 12,47 14,43 16,51 18,45 20,47 23,47 25,47 27,47" stroke="#F43F5E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.7} />
    </svg>
  )
}

function SageCharacter() {
  return (
    <svg width="44" height="54" viewBox="0 0 44 54" fill="none">
      <circle cx="22" cy="6" r="3" fill="#818CF8" opacity={0.9} />
      <circle cx="26" cy="3" r="2.2" fill="#818CF8" opacity={0.65} />
      <circle cx="29" cy="1.5" r="1.4" fill="#818CF8" opacity={0.4} />
      <rect x="3" y="10" width="30" height="24" rx="9" fill="#818CF8" />
      <circle cx="12.5" cy="22" r="6.5" fill="#1E1B4B" />
      <circle cx="26" cy="22" r="6.5" fill="#1E1B4B" />
      <circle cx="10" cy="19.5" r="2.5" fill="white" opacity={0.6} />
      <circle cx="23.5" cy="19.5" r="2.5" fill="white" opacity={0.6} />
      <rect x="7" y="36" width="22" height="16" rx="5" fill="#4338CA" />
      <circle cx="12" cy="41" r="1.8" fill="#818CF8" opacity={0.7} />
      <circle cx="18" cy="44" r="1.8" fill="#818CF8" opacity={0.7} />
      <circle cx="24" cy="41" r="1.8" fill="#818CF8" opacity={0.7} />
      <line x1="12" y1="41" x2="18" y2="44" stroke="#818CF8" strokeWidth="1" opacity={0.5} />
      <line x1="18" y1="44" x2="24" y2="41" stroke="#818CF8" strokeWidth="1" opacity={0.5} />
    </svg>
  )
}

function SolCharacter() {
  return (
    <svg width="44" height="54" viewBox="0 0 44 54" fill="none">
      <path d="M22 10 C22 10 17 5 17 3 C17 1 19 0 20.5 1 C21.2 1.5 22 2.5 22 2.5 C22 2.5 22.8 1.5 23.5 1 C25 0 27 1 27 3 C27 5 22 10 22 10Z" fill="#F472B6" opacity={0.9} />
      <rect x="3" y="11" width="30" height="24" rx="9" fill="#F472B6" />
      <circle cx="13" cy="23" r="6" fill="#4A0020" />
      <circle cx="26" cy="23" r="6" fill="#4A0020" />
      <circle cx="11" cy="21" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="21" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="37" width="22" height="16" rx="5" fill="#BE185D" />
      <circle cx="15" cy="45" r="4.5" fill="none" stroke="#F472B6" strokeWidth="1.5" opacity={0.7} />
      <circle cx="21" cy="45" r="4.5" fill="none" stroke="#F472B6" strokeWidth="1.5" opacity={0.7} />
    </svg>
  )
}

function RootCharacter() {
  return (
    <svg width="44" height="54" viewBox="0 0 44 54" fill="none">
      <path d="M22 10 C22 10 18 6 18 3 C18 1 20 0 22 2 C24 0 26 1 26 3 C26 6 22 10 22 10Z" fill="#4ADE80" opacity={0.9} />
      <line x1="22" y1="10" x2="22" y2="13" stroke="#4ADE80" strokeWidth="1.2" opacity={0.6} />
      <rect x="3" y="12" width="30" height="24" rx="9" fill="#4ADE80" />
      <circle cx="13" cy="24" r="6" fill="#052E16" />
      <circle cx="26" cy="24" r="6" fill="#052E16" />
      <circle cx="11" cy="22" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="22" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="38" width="22" height="16" rx="5" fill="#16A34A" />
      <rect x="11" y="41" width="6" height="8" rx="2" fill="#4ADE80" opacity={0.5} />
      <circle cx="14" cy="40" r="2.5" fill="#4ADE80" opacity={0.6} />
      <rect x="20" y="44" width="4" height="6" rx="1.5" fill="#4ADE80" opacity={0.4} />
      <circle cx="22" cy="43" r="1.8" fill="#4ADE80" opacity={0.5} />
    </svg>
  )
}

const CHARACTER_COMPONENTS: Record<string, FC> = {
  career: ForgeCharacter,
  social: EchoCharacter,
  wealth: VaultCharacter,
  vitality: BlazeCharacter,
  mind: SageCharacter,
  love: SolCharacter,
  family: RootCharacter,
}

const AREA_LABELS: Record<Dimension, string> = Object.fromEntries(
  Object.keys(CHARACTERS).map((d) => [d, CHARACTERS[d as Dimension].name])
) as Record<Dimension, string>

const CHARACTER_COLORS: Record<Dimension, string> = Object.fromEntries(
  Object.keys(CHARACTERS).map((d) => [d, CHARACTERS[d as Dimension].color])
) as Record<Dimension, string>

const CHAR_PAGE: Record<Dimension, string> = Object.fromEntries(
  Object.keys(CHARACTERS).map((d) => [d, `/${DIMENSION_TO_SLUG[d]}`])
) as Record<Dimension, string>

function MissionCard({
  quest,
  dimension,
  xp,
  level,
  todayTask,
  milestone,
  onCompleteTask,
  completingTaskId,
}: {
  quest: { title: string; vision?: string } | null
  dimension: Dimension
  xp: number
  level: number
  todayTask: { id: string; title: string; completed: boolean; xp_reward: number } | null
  milestone: { title: string; daysLeft: number } | null
  onCompleteTask: (taskId: string, xpReward: number, dimension: Dimension) => void
  completingTaskId: string | null
}) {
  const CharSvg = CHARACTER_COMPONENTS[dimension] ?? ForgeCharacter
  const areaLabel = AREA_LABELS[dimension] ?? dimension
  const color = CHARACTER_COLORS[dimension] ?? '#9333EA'
  const charName = CHARACTERS[dimension].name
  const FLOAT_DELAYS: Record<string, string> = {
    career: '0s', social: '0.3s', wealth: '0.6s',
    vitality: '0.9s', mind: '1.2s', love: '1.5s', family: '1.8s',
  }
  const floatDelay = FLOAT_DELAYS[dimension] ?? '0s'

  const xpInLevel = xp % 500
  const pct = Math.round((xpInLevel / 500) * 100)

  const router = useRouter()

  if (!quest) {
    return (
      <div
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
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: color,
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#E8E0F0' }}>{areaLabel}</span>
          <span style={{ fontSize: 9, color: '#3D3358' }}>No active quest yet</span>
          <button
            type="button"
            onClick={() => router.push(CHAR_PAGE[dimension] ?? '/quests')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: '#1E0D40',
              border: '0.5px solid #3D2070',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 10,
              color: '#7A5FA0',
              width: 'fit-content',
            }}
          >
            + Add quest
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
            opacity: 0.4,
          }}
        >
          <div
            style={{
              animation: 'protagonist-float 3.2s ease-in-out infinite',
              animationDelay: floatDelay,
            }}
          >
            <CharSvg />
          </div>
          <span style={{ fontSize: 9, fontWeight: 500, color }}>{charName}</span>
          <span style={{ fontSize: 8, color: '#5A4A7A' }}>Lv {level}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(CHAR_PAGE[dimension] ?? '/quests')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          router.push(CHAR_PAGE[dimension] ?? '/quests')
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
        alignItems: 'stretch',
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
          background: color,
        }}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: '#E8E0F0', lineHeight: 1 }}>
          {areaLabel}
        </span>

        {quest.vision && (
          <span style={{ fontSize: 9, color: '#5A4A7A', fontStyle: 'italic', lineHeight: 1.4 }}>
            {quest.vision}
          </span>
        )}

        {milestone && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9,
              color: '#7A5FA0',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 1V9M2 1L8 4L2 7"
                stroke="#7A5FA0"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {milestone.title} · {milestone.daysLeft}d left
          </div>
        )}

        {todayTask && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              if (!todayTask.completed && completingTaskId !== todayTask.id) {
                onCompleteTask(todayTask.id, todayTask.xp_reward, dimension)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                if (!todayTask.completed && completingTaskId !== todayTask.id) {
                  onCompleteTask(todayTask.id, todayTask.xp_reward, dimension)
                }
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#1A0D35',
              borderRadius: 8,
              padding: '6px 8px',
              cursor: todayTask.completed ? 'default' : 'pointer',
              border: '0.5px solid #2D1B55',
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: `1.5px solid ${todayTask.completed ? '#34d399' : color}`,
                background: todayTask.completed ? '#34d399' : 'transparent',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {completingTaskId === todayTask.id && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    border: `1.5px solid ${color}`,
                    borderTopColor: 'transparent',
                    animation: 'spin 0.6s linear infinite',
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontSize: 9,
                color: todayTask.completed ? '#5A4A7A' : '#C0B0E0',
                lineHeight: 1.3,
                textDecoration: todayTask.completed ? 'line-through' : 'none',
              }}
            >
              {todayTask.title}
            </span>
          </div>
        )}

        {!todayTask && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              window.dispatchEvent(
                new CustomEvent('protagonist:open-oracle', {
                  detail: { prefill: `add task for ${areaLabel} today — `, dimension },
                })
              )
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                window.dispatchEvent(
                  new CustomEvent('protagonist:open-oracle', {
                    detail: { prefill: `add task for ${areaLabel} today — `, dimension },
                  })
                )
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              padding: '2px 0',
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: `1.5px dashed ${color}`,
                flexShrink: 0,
                opacity: 0.5,
              }}
            />
            <span style={{ fontSize: 9, color: '#5A4A7A' }}>+ Add task for today</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 8, color: '#3D3358', whiteSpace: 'nowrap' }}>
            {xpInLevel} / 500 XP
          </span>
          <div
            style={{
              flex: 1,
              height: 3,
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
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            animation: 'protagonist-float 3.2s ease-in-out infinite',
            animationDelay: floatDelay,
          }}
        >
          <CharSvg />
        </div>
        <span style={{ fontSize: 9, fontWeight: 500, color }}>{charName}</span>
        <span style={{ fontSize: 8, color: '#5A4A7A' }}>Lv {level}</span>
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
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false)
  const [witnessInsight, setWitnessInsight] = useState<string | null>(null)
  const [witnessDismissed, setWitnessDismissed] = useState(false)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [xpToast, setXpToast] = useState<XpToast | null>(null)
  const [levelUpToast, setLevelUpToast] = useState<LevelUpToast | null>(null)

  const loadDashboard = useCallback(async () => {
    const uid = userId.current
    setLoading(true)

    const [ouraRes, questsRes, calRes, moodRes, checkInRes] = await Promise.allSettled([
      fetch(`/api/oura/sync?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/quests/main?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/calendar/next?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/mood?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/checkin/today?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
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
    if (checkInRes.status === 'fulfilled' && checkInRes.value?.hasCheckIn) {
      setHasCheckedInToday(checkInRes.value.hasCheckIn)
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

  // Refresh quests when Oracle adds a task (so it appears on the card immediately)
  useEffect(() => {
    const handler = () => void loadDashboard()
    window.addEventListener('protagonist:task-added', handler)
    return () => window.removeEventListener('protagonist:task-added', handler)
  }, [loadDashboard])

  useEffect(() => {
    const dismissedKey = `witness_dismissed_${new Date().toISOString().split('T')[0].slice(0, 7)}`
    const alreadyDismissed = localStorage.getItem(dismissedKey) === 'true'
    if (alreadyDismissed) {
      setWitnessDismissed(true)
      return
    }

    const uid = getUserId()
    fetch(`/api/witness?userId=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((d: { insight?: string | null }) => {
        if (d.insight) {
          setWitnessInsight(d.insight)
        }
      })
      .catch(() => {})
  }, [])

  async function handleCompleteTask(taskId: string, xpReward: number, dimension: Dimension) {
    setCompletingTaskId(taskId)
    // Optimistic update — mark completed + add XP immediately so the UI snaps
    setQuests((prev) =>
      prev.map((q) =>
        q.dimension === dimension && q.today_task?.id === taskId
          ? {
              ...q,
              xp: q.xp + xpReward,
              today_task: { ...q.today_task!, completed: true },
            }
          : q
      )
    )
    try {
      const res = await fetch(`/api/quests/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.current }),
      })
      const data = await res.json()
      if (res.ok) {
        showXpFeedback({ dimension }, data, setXpToast, setLevelUpToast)
        // Silent re-fetch to sync actual XP from DB without showing loading spinner
        fetch(`/api/quests/main?userId=${encodeURIComponent(userId.current)}`)
          .then((r) => r.json())
          .then((d: { quests?: MainQuest[] }) => {
            if (d.quests) setQuests(d.quests)
          })
          .catch(() => {})
      } else {
        // Rollback optimistic update on failure
        setQuests((prev) =>
          prev.map((q) =>
            q.dimension === dimension && q.today_task?.id === taskId
              ? {
                  ...q,
                  xp: q.xp - xpReward,
                  today_task: { ...q.today_task!, completed: false },
                }
              : q
          )
        )
      }
    } catch {
      // Rollback on network error
      setQuests((prev) =>
        prev.map((q) =>
          q.dimension === dimension && q.today_task?.id === taskId
            ? {
                ...q,
                xp: q.xp - xpReward,
                today_task: { ...q.today_task!, completed: false },
              }
            : q
        )
      )
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

  const oracle = oura ? getOracleVerdict(oura, todayMood) : null
  const cycleLabel = oura ? formatCyclePhase(oura.cycle_phase, oura.cycle_day) : ''

  const ORDER: Dimension[] = ['career', 'social', 'wealth', 'vitality', 'mind', 'love', 'family']

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link
            href="/settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#140C28',
              border: '0.5px solid #2D1B55',
              color: '#5A4A7A',
            }}
            aria-label="Settings"
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <line x1="0" y1="1" x2="16" y2="1" stroke="#5A4A7A" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="0" y1="6" x2="16" y2="6" stroke="#5A4A7A" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="0" y1="11" x2="16" y2="11" stroke="#5A4A7A" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
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

          {hasCheckedInToday ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 4px',
                marginTop: 10,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'rgba(52,211,153,0.15)',
                  border: '1px solid rgba(52,211,153,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5 4-4" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ fontSize: 11, color: '#34d399', opacity: 0.7 }}>Checked in today</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('protagonist:open-oracle', {
                    detail: { prefill: 'Good morning, checking in for today. ' },
                  })
                )
                setHasCheckedInToday(true)
              }}
              style={{
                width: '100%',
                padding: '13px 16px',
                background: 'rgba(147,51,234,0.06)',
                border: '1px solid rgba(147,51,234,0.25)',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                marginBottom: 12,
                marginTop: 10,
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#200A45',
                  border: '1.5px solid #9333EA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="#9333EA" strokeWidth="1.2" />
                  <circle cx="8" cy="8" r="2.5" stroke="#C084FC" strokeWidth="1" />
                  <circle cx="8" cy="8" r="1.2" fill="#E879F9" />
                  <circle cx="7" cy="7" r=".6" fill="white" opacity={0.5} />
                </svg>
              </div>
              <div>
                <div
                  style={{ fontSize: 13, fontWeight: 500, color: '#E8E0F0', marginBottom: 2 }}
                >
                  Good morning — check in with Oracle
                </div>
                <div style={{ fontSize: 11, color: '#5A4A7A' }}>
                  Tell me how you&apos;re feeling · takes 30 seconds
                </div>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ marginLeft: 'auto', flexShrink: 0 }}
              >
                <path
                  d="M6 4l4 4-4 4"
                  stroke="#5A4A7A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          <MoodTracker
            userId={userId.current}
            onMoodChange={(score) => setTodayMood(score)}
          />
        </div>

        {witnessInsight && !witnessDismissed && (
          <div
            style={{
              background: 'linear-gradient(135deg, #12083A 0%, #1A0D35 100%)',
              border: '1px solid rgba(147,51,234,0.25)',
              borderLeft: '3px solid #9333EA',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 12,
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setWitnessDismissed(true)
                const dismissedKey = `witness_dismissed_${new Date().toISOString().split('T')[0].slice(0, 7)}`
                localStorage.setItem(dismissedKey, 'true')
              }}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'transparent',
                border: 'none',
                color: '#3D2878',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: '2px 6px',
              }}
              aria-label="Dismiss"
            >
              ×
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingRight: 24 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#200A45',
                  border: '1px solid rgba(147,51,234,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
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
                    fontSize: 13,
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
        ) : (
          ORDER.map((dim) => {
            const q = quests.find((quest) => quest.dimension === dim) ?? null
            const level = getLevel(q?.xp ?? 0)

            const milestone = q?.active_milestone
              ? {
                  title: q.active_milestone.title,
                  daysLeft: daysUntil(q.active_milestone.target_date),
                }
              : null

            const todayTask = q?.today_task
              ? {
                  id: q.today_task.id,
                  title: q.today_task.title,
                  completed: q.today_task.completed,
                  xp_reward: q.today_task.xp_reward,
                }
              : null

            return (
              <MissionCard
                key={dim}
                quest={
                  q
                    ? { title: q.vision, vision: q.vision }
                    : null
                }
                dimension={dim}
                xp={q?.xp ?? 0}
                level={level}
                todayTask={todayTask}
                milestone={milestone}
                onCompleteTask={handleCompleteTask}
                completingTaskId={completingTaskId}
              />
            )
          })
        )}

        {nextEvent && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#140C28',
              border: '0.5px solid rgba(255,255,255,0.07)',
              borderRadius: 20,
              padding: '9px 14px',
              marginBottom: 4,
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
                flex: 1,
              }}
            >
              {formatNextEvent(nextEvent).title}
            </span>
            <span style={{ fontSize: 12, color: '#6A5A8A', flexShrink: 0 }}>
              {formatNextEvent(nextEvent).time}
            </span>
          </div>
        )}
      </div>

      <XpToastOverlay xpToast={xpToast} levelUpToast={levelUpToast} />
    </main>
  )
}
