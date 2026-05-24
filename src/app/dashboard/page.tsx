'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { getUserId } from '@/lib/user'
import { loadXP, loadTodayQuests, loadCompletedQuests } from '@/lib/xp'

interface OuraData {
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
  hrv_balance: number | null
  steps: number | null
  sleep_total_seconds: number | null
  deep_sleep_seconds: number | null
  rem_sleep_seconds: number | null
  light_sleep_seconds: number | null
  respiratory_rate: number | null
  body_temperature_deviation: number | null
  skin_temperature_deviation: number | null
  cycle_day: number | null
  cycle_phase: string | null
  recovery_index: number | null
}

interface CalendarEvent {
  id: string
  title: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  location: string | null
  event_date: string
}

interface ActionItem {
  subject: string
  from: string
  urgency: 'high' | 'medium' | 'low'
  snippet: string
}

interface Quest {
  id: string
  title: string
  description: string
  dimension: string
  xp_reward: number
  completed: boolean
}

const DIMENSIONS = [
  { key: 'vitality', label: 'Vitality', emoji: '💪', color: '#34d399' },
  { key: 'mind', label: 'Mind', emoji: '🧠', color: '#818cf8' },
  { key: 'create', label: 'Create', emoji: '✨', color: '#f59e0b' },
  { key: 'social', label: 'Social', emoji: '🤝', color: '#38bdf8' },
  { key: 'love', label: 'Love', emoji: '💕', color: '#f472b6' },
  { key: 'family', label: 'Family', emoji: '👧', color: '#a78bfa' },
  { key: 'wealth', label: 'Wealth', emoji: '💰', color: '#fbbf24' },
]

const XP_PER_LEVEL = 500

const CYCLE_PHASES: Record<
  string,
  { label: string; color: string; emoji: string; note: string }
> = {
  menstrual: {
    label: 'Menstrual',
    color: '#f87171',
    emoji: '🌑',
    note: 'Rest & restore. Iron-rich foods. Gentle movement.',
  },
  follicular: {
    label: 'Follicular',
    color: '#fb923c',
    emoji: '🌒',
    note: 'Energy rising. Great time for new projects & hard workouts.',
  },
  ovulatory: {
    label: 'Ovulatory',
    color: '#fbbf24',
    emoji: '🌕',
    note: 'Peak energy & confidence. Your highest performance window.',
  },
  luteal: {
    label: 'Luteal',
    color: '#a78bfa',
    emoji: '🌖',
    note: 'Focus inward. Finish things. Prioritize sleep & recovery.',
  },
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function isHappening(event: CalendarEvent): boolean {
  if (!event.start_time || !event.end_time) return false
  const now = Date.now()
  return (
    now >= new Date(event.start_time).getTime() &&
    now <= new Date(event.end_time).getTime()
  )
}

function isNext(events: CalendarEvent[], event: CalendarEvent): boolean {
  const upcoming = events.filter(
    (e) => e.start_time && new Date(e.start_time).getTime() > Date.now()
  )
  return upcoming[0]?.id === event.id
}

function scoreColor(score: number | null): string {
  if (!score) return '#ffffff40'
  if (score >= 85) return '#34d399'
  if (score >= 70) return '#60a5fa'
  if (score >= 55) return '#fbbf24'
  return '#f87171'
}

function scoreLabel(score: number | null): string {
  if (!score) return '—'
  if (score >= 85) return 'Optimal'
  if (score >= 70) return 'Good'
  if (score >= 55) return 'Fair'
  return 'Low'
}

function mapCalendarEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id: (row.id as string) ?? (row.google_event_id as string),
    title: row.title as string,
    start_time: (row.start_time as string | null) ?? null,
    end_time: (row.end_time as string | null) ?? null,
    all_day: Boolean(row.all_day),
    location: (row.location as string | null) ?? null,
    event_date: row.event_date as string,
  }
}

function ScoreRing({
  score,
  label,
  size = 72,
  strokeWidth = 5,
}: {
  score: number | null
  label: string
  size?: number
  strokeWidth?: number
}) {
  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  const filled = score ? (score / 100) * circ : 0
  const color = scoreColor(score)

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={circ - filled}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${color}60)`,
              transition: 'stroke-dashoffset 1s ease',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold text-white">{score ?? '—'}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs text-white/50">{label}</p>
        <p className="text-xs font-semibold" style={{ color }}>
          {scoreLabel(score)}
        </p>
      </div>
    </div>
  )
}

function StatPill({
  label,
  value,
  color = '#ffffff70',
  icon,
}: {
  label: string
  value: string
  color?: string
  icon?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 min-w-[72px] shrink-0">
      {icon && <span className="text-sm">{icon}</span>}
      <span className="text-sm font-bold" style={{ color }}>
        {value}
      </span>
      <span className="text-xs text-white/40 text-center leading-tight">{label}</span>
    </div>
  )
}

export default function DashboardPage() {
  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(true)
  const [oura, setOura] = useState<OuraData | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [gmail, setGmail] = useState<{
    unread_count: number
    needs_reply_count: number
    action_items: ActionItem[]
  } | null>(null)
  const [quests, setQuests] = useState<Quest[]>([])
  const [xp, setXp] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)
  const userId = useRef(getUserId())

  const generateBriefing = useCallback(async (uid: string) => {
    setBriefingLoading(true)
    try {
      const res = await fetch('/api/dashboard/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      })
      const data = await res.json()
      if (data.briefing) setBriefing(data.briefing)
    } finally {
      setBriefingLoading(false)
    }
  }, [])

  const syncBackground = useCallback(async (uid: string, today: string) => {
    try {
      const ouraSync = await fetch('/api/oura/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      }).then((r) => r.json())
      if (ouraSync.data) setOura(ouraSync.data)
    } catch {
      // optional
    }

    try {
      const calSync = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      }).then((r) => r.json())
      if (calSync.events) {
        setEvents(
          calSync.events
            .filter((e: CalendarEvent) => e.event_date === today)
            .map((e: Record<string, unknown>) => mapCalendarEvent(e))
        )
      }
    } catch {
      // optional
    }

    try {
      const gmailSync = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      }).then((r) => r.json())
      if (gmailSync.digest) setGmail(gmailSync.digest)
    } catch {
      // optional
    }
  }, [])

  const loadAll = useCallback(async () => {
    const uid = userId.current

    const [ouraRes, calRes, gmailRes, briefRes, questRes, xpRes] =
      await Promise.allSettled([
        fetch(`/api/oura/sync?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
        fetch(`/api/calendar/sync?userId=${encodeURIComponent(uid)}`).then((r) =>
          r.json()
        ),
        fetch(`/api/gmail/sync?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
        fetch(`/api/dashboard/briefing?userId=${encodeURIComponent(uid)}`).then((r) =>
          r.json()
        ),
        fetch(`/api/quests/today?userId=${encodeURIComponent(uid)}`).then((r) =>
          r.json()
        ),
        fetch(`/api/xp?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      ])

    const today = new Date().toISOString().split('T')[0]

    if (ouraRes.status === 'fulfilled' && ouraRes.value?.data) {
      setOura(ouraRes.value.data)
    }
    if (calRes.status === 'fulfilled' && calRes.value?.events) {
      setEvents(
        calRes.value.events
          .filter((e: Record<string, unknown>) => e.event_date === today)
          .map(mapCalendarEvent)
      )
    }
    if (gmailRes.status === 'fulfilled' && gmailRes.value?.digest) {
      setGmail(gmailRes.value.digest)
    }
    if (briefRes.status === 'fulfilled' && briefRes.value?.briefing) {
      setBriefing(briefRes.value.briefing)
      setBriefingLoading(false)
    }
    if (questRes.status === 'fulfilled' && questRes.value?.quests?.length) {
      setQuests(questRes.value.quests)
    } else {
      const completedIds = loadCompletedQuests()
      const localQuests = loadTodayQuests().map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        dimension: q.dimensionId,
        xp_reward: q.xpReward,
        completed: completedIds.has(q.id),
      }))
      if (localQuests.length > 0) setQuests(localQuests)
    }
    const apiXp =
      xpRes.status === 'fulfilled' && xpRes.value?.xp && Object.keys(xpRes.value.xp).length > 0
        ? (xpRes.value.xp as Record<string, number>)
        : null
    setXp({ ...loadXP(), ...apiXp })

    setLoaded(true)

    if (briefRes.status !== 'fulfilled' || !briefRes.value?.briefing) {
      void generateBriefing(uid)
    }

    void syncBackground(uid, today)
  }, [generateBriefing, syncBackground])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const cycleKey = oura?.cycle_phase?.toLowerCase() ?? ''
  const cycleInfo = cycleKey ? (CYCLE_PHASES[cycleKey] ?? null) : null

  return (
    <div className="min-h-screen bg-[#0D0820] text-white pb-28 overflow-x-hidden">
      <div className="relative px-4 pt-10 pb-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/40 to-transparent pointer-events-none" />
        <p className="text-xs text-white/30 uppercase tracking-[0.2em] mb-1 relative">
          {today}
        </p>
        <h1 className="text-3xl font-black bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent relative">
          Your Day
        </h1>
      </div>

      <div className="mx-4 mb-6">
        <div className="relative rounded-3xl overflow-hidden border border-violet-500/25 bg-gradient-to-br from-violet-950/60 to-fuchsia-950/40 p-5 backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-start gap-3 relative">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-lg shrink-0 shadow-lg shadow-violet-500/30">
              🔮
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-violet-300/70 mb-2 uppercase tracking-wider">
                Arc
              </p>
              {briefingLoading ? (
                <div className="space-y-2">
                  {[100, 85, 70].map((w) => (
                    <div
                      key={w}
                      className="h-3 bg-white/10 rounded-full animate-pulse"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              ) : briefing ? (
                <p className="text-sm text-white/85 leading-relaxed">{briefing}</p>
              ) : (
                <p className="text-sm text-white/40 italic">Gathering your data...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {oura && (
        <div className="mx-4 mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span>💍</span>
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Biometrics
              </span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
          </div>

          <div className="bg-white/5 rounded-3xl border border-white/10 p-5 mb-3 backdrop-blur-sm">
            <div className="flex justify-around mb-5">
              <ScoreRing score={oura.readiness_score} label="Readiness" size={76} />
              <ScoreRing score={oura.sleep_score} label="Sleep" size={76} />
              <ScoreRing score={oura.activity_score} label="Activity" size={76} />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {oura.hrv_balance !== null && (
                <StatPill
                  label="HRV Balance"
                  value={String(oura.hrv_balance)}
                  color="#c084fc"
                  icon="💜"
                />
              )}
              {oura.steps !== null && (
                <StatPill
                  label="Steps"
                  value={oura.steps.toLocaleString()}
                  color="#34d399"
                  icon="👟"
                />
              )}
              {oura.sleep_total_seconds !== null && (
                <StatPill
                  label="Total Sleep"
                  value={formatTime(oura.sleep_total_seconds)}
                  color="#60a5fa"
                  icon="🌙"
                />
              )}
              {oura.recovery_index !== null && (
                <StatPill
                  label="Recovery"
                  value={String(oura.recovery_index)}
                  color="#f472b6"
                  icon="⚡"
                />
              )}
              {oura.respiratory_rate !== null && (
                <StatPill
                  label="Breath"
                  value={`${oura.respiratory_rate.toFixed(1)}/m`}
                  color="#94a3b8"
                  icon="🫁"
                />
              )}
            </div>
          </div>

          {(oura.deep_sleep_seconds ||
            oura.rem_sleep_seconds ||
            oura.light_sleep_seconds) && (
            <div className="bg-white/5 rounded-3xl border border-white/10 p-4 mb-3 backdrop-blur-sm">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Sleep Stages
              </p>
              <div className="space-y-2.5">
                {[
                  {
                    label: 'Deep',
                    seconds: oura.deep_sleep_seconds,
                    color: '#1e40af',
                  },
                  { label: 'REM', seconds: oura.rem_sleep_seconds, color: '#7c3aed' },
                  {
                    label: 'Light',
                    seconds: oura.light_sleep_seconds,
                    color: '#0369a1',
                  },
                ].map((stage) => {
                  if (!stage.seconds) return null
                  const total = oura.sleep_total_seconds ?? 1
                  const pct = Math.round((stage.seconds / total) * 100)
                  return (
                    <div key={stage.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-white/60">{stage.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40">{pct}%</span>
                          <span className="text-xs font-semibold text-white/80">
                            {formatTime(stage.seconds)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: stage.color,
                            boxShadow: `0 0 8px ${stage.color}80`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {oura.body_temperature_deviation !== null &&
            Math.abs(oura.body_temperature_deviation) > 0.05 &&
            Math.abs(oura.body_temperature_deviation) < 5 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 px-4 py-3 mb-3 flex items-center justify-between backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span>🌡️</span>
                  <span className="text-xs text-white/60">Body Temp</span>
                </div>
                <span
                  className={`text-sm font-bold ${
                    oura.body_temperature_deviation > 0.2
                      ? 'text-red-400'
                      : oura.body_temperature_deviation < -0.2
                        ? 'text-blue-400'
                        : 'text-white/70'
                  }`}
                >
                  {oura.body_temperature_deviation > 0 ? '+' : ''}
                  {oura.body_temperature_deviation.toFixed(2)}°C
                </span>
              </div>
            )}

          {cycleInfo && (
            <div
              className="rounded-3xl border p-4 backdrop-blur-sm"
              style={{
                backgroundColor: `${cycleInfo.color}12`,
                borderColor: `${cycleInfo.color}30`,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{cycleInfo.emoji}</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">
                      {cycleInfo.label} Phase
                    </span>
                    {oura.cycle_day !== null && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full text-white/60"
                        style={{ backgroundColor: `${cycleInfo.color}20` }}
                      >
                        Day {oura.cycle_day}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                    {cycleInfo.note}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {quests.length > 0 && (
        <div className="mx-4 mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span>⚔️</span>
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Today&apos;s Quests
              </span>
            </div>
            <span className="text-xs text-white/30">
              {quests.filter((q) => q.completed).length}/{quests.length} done
            </span>
          </div>
          <div className="space-y-3">
            {quests.map((quest) => {
              const dim = DIMENSIONS.find((d) => d.key === quest.dimension)
              return (
                <div
                  key={quest.id}
                  className={`rounded-3xl border p-4 transition-all backdrop-blur-sm ${
                    quest.completed
                      ? 'bg-white/5 border-white/5 opacity-50'
                      : 'bg-white/5 border-white/10'
                  }`}
                  style={
                    !quest.completed && dim
                      ? {
                          borderColor: `${dim.color}30`,
                          background: `${dim.color}08`,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
                      style={{
                        backgroundColor: dim
                          ? `${dim.color}20`
                          : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      {dim?.emoji ?? '🎯'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="text-xs font-semibold uppercase tracking-wide"
                          style={{ color: dim?.color ?? '#ffffff60' }}
                        >
                          {dim?.label ?? quest.dimension}
                        </span>
                        <span className="text-xs font-bold text-amber-400">
                          +{quest.xp_reward} XP
                        </span>
                        {quest.completed && (
                          <span className="text-xs text-emerald-400">✓ Done</span>
                        )}
                      </div>
                      <p
                        className={`text-sm font-bold mb-1 ${quest.completed ? 'line-through text-white/40' : 'text-white'}`}
                      >
                        {quest.title}
                      </p>
                      <p className="text-xs text-white/50 leading-relaxed">
                        {quest.description}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loaded && (
        <div className="mx-4 mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <span>🏆</span>
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Character Stats
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {DIMENSIONS.map((dim) => {
              const dimXp = xp[dim.key] ?? 0
              const level = Math.floor(dimXp / XP_PER_LEVEL) + 1
              const progress = (dimXp % XP_PER_LEVEL) / XP_PER_LEVEL
              const nextLevelXp = XP_PER_LEVEL - (dimXp % XP_PER_LEVEL)
              return (
                <div
                  key={dim.key}
                  className="rounded-2xl border p-3.5 backdrop-blur-sm"
                  style={{
                    backgroundColor: `${dim.color}08`,
                    borderColor: `${dim.color}25`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{dim.emoji}</span>
                      <span className="text-xs font-semibold text-white/70">
                        {dim.label}
                      </span>
                    </div>
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded-full"
                      style={{
                        color: dim.color,
                        backgroundColor: `${dim.color}20`,
                      }}
                    >
                      Lv.{level}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(progress * 100, 100)}%`,
                        backgroundColor: dim.color,
                        boxShadow: `0 0 6px ${dim.color}60`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-white/30">{dimXp} XP</span>
                    <span className="text-xs text-white/25">{nextLevelXp} to next</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div className="mx-4 mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span>📅</span>
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Schedule
              </span>
            </div>
            <span className="text-xs text-white/25">{events.length} events</span>
          </div>
          <div className="bg-white/5 rounded-3xl border border-white/10 p-4 space-y-2 backdrop-blur-sm">
            {events.map((event) => {
              const happening = isHappening(event)
              const next = isNext(events, event)
              const past =
                event.end_time && new Date(event.end_time).getTime() < Date.now()
              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all ${
                    happening
                      ? 'bg-violet-500/15 border border-violet-400/20'
                      : 'border border-transparent'
                  } ${past ? 'opacity-30' : ''}`}
                >
                  <div className="text-right w-10 shrink-0">
                    {event.all_day ? (
                      <span className="text-xs text-white/25">all day</span>
                    ) : event.start_time ? (
                      <span
                        className={`text-xs font-bold ${happening ? 'text-violet-300' : 'text-white/40'}`}
                      >
                        {formatEventTime(event.start_time)}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      happening
                        ? 'bg-violet-400 shadow-sm shadow-violet-400'
                        : next
                          ? 'bg-white/40'
                          : 'bg-white/15'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-semibold truncate ${happening ? 'text-white' : 'text-white/70'}`}
                    >
                      {event.title}
                    </p>
                    {event.location && (
                      <p className="text-xs text-white/25 truncate">📍 {event.location}</p>
                    )}
                  </div>
                  {happening && (
                    <span className="text-xs bg-violet-500 text-white px-2 py-0.5 rounded-full font-bold shrink-0">
                      NOW
                    </span>
                  )}
                  {next && !happening && (
                    <span className="text-xs text-cyan-400/70 shrink-0">next</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {gmail && gmail.unread_count > 0 && (
        <div className="mx-4 mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span>📧</span>
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Inbox
              </span>
            </div>
            <div className="flex items-center gap-2">
              {gmail.action_items.some((i) => i.urgency === 'high') && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-semibold">
                  urgent
                </span>
              )}
              <span className="text-xs text-white/25">{gmail.unread_count} unread</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-3xl border border-white/10 p-4 space-y-2 backdrop-blur-sm">
            {gmail.needs_reply_count > 0 && (
              <p className="text-xs text-amber-400 font-semibold mb-3">
                ↩ {gmail.needs_reply_count} thread
                {gmail.needs_reply_count !== 1 ? 's' : ''} waiting for reply
              </p>
            )}
            {gmail.action_items.slice(0, 4).map((item, i) => (
              <div
                key={`${item.subject}-${i}`}
                className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5"
              >
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    item.urgency === 'high'
                      ? 'bg-red-400'
                      : item.urgency === 'medium'
                        ? 'bg-amber-400'
                        : 'bg-white/20'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/75 truncate">{item.from}</p>
                  <p className="text-xs text-white/40 truncate">{item.subject}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loaded && !oura && events.length === 0 && !gmail && quests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <div className="text-5xl mb-4">🔮</div>
          <h2 className="text-lg font-bold text-white/60 mb-2">Your dashboard awaits</h2>
          <p className="text-sm text-white/30 mb-6">
            Connect your integrations to bring it to life.
          </p>
          <Link
            href="/quests"
            className="px-6 py-3 rounded-2xl bg-violet-600/30 border border-violet-500/30 text-sm text-violet-300 font-semibold no-underline"
          >
            Connect integrations →
          </Link>
        </div>
      )}
    </div>
  )
}
