'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getUserId } from '@/lib/user'
import { loadXP } from '@/lib/xp'
import { DIMENSIONS } from '@/lib/dimensions'

interface OuraData {
  readiness_score: number | null
  sleep_score: number | null
  hrv_balance: number | null
  activity_score: number | null
  steps: number | null
  sleep_total_seconds: number | null
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

interface DashboardData {
  briefing: string | null
  oura: OuraData | null
  events: CalendarEvent[]
  gmail: {
    unread_count: number
    needs_reply_count: number
    action_items: ActionItem[]
  } | null
  quests: Quest[]
  xp: Record<string, number>
}

const DIMENSION_LIST = [
  { key: 'vitality', label: 'Vitality', emoji: DIMENSIONS.vitality.emoji, color: '#34d399' },
  { key: 'mind', label: 'Mind', emoji: DIMENSIONS.mind.emoji, color: '#818cf8' },
  { key: 'create', label: 'Create', emoji: DIMENSIONS.create.emoji, color: '#f59e0b' },
  { key: 'social', label: 'Social', emoji: DIMENSIONS.social.emoji, color: '#38bdf8' },
  { key: 'love', label: 'Love', emoji: DIMENSIONS.love.emoji, color: '#f472b6' },
  { key: 'family', label: 'Family', emoji: DIMENSIONS.family.emoji, color: '#a78bfa' },
  { key: 'wealth', label: 'Wealth', emoji: DIMENSIONS.wealth.emoji, color: '#fbbf24' },
]

const XP_PER_LEVEL = 500

function VitalRing({
  score,
  label,
  color,
}: {
  score: number | null
  label: string
  color: string
}) {
  if (score === null) return null
  const circumference = 2 * Math.PI * 22
  const filled = (score / 100) * circumference
  const level =
    score >= 85 ? 'Optimal' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : 'Low'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 52 52">
          <circle
            cx="26"
            cy="26"
            r="22"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="4"
          />
          <circle
            cx="26"
            cy="26"
            r="22"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - filled}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
          {score}
        </span>
      </div>
      <span className="text-xs text-white/50">{label}</span>
      <span className="text-xs font-semibold" style={{ color }}>
        {level}
      </span>
    </div>
  )
}

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function isHappening(event: CalendarEvent) {
  if (!event.start_time || !event.end_time) return false
  const now = Date.now()
  return (
    now >= new Date(event.start_time).getTime() &&
    now <= new Date(event.end_time).getTime()
  )
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    briefing: null,
    oura: null,
    events: [],
    gmail: null,
    quests: [],
    xp: {},
  })
  const [loading, setLoading] = useState(true)
  const [briefingLoading, setBriefingLoading] = useState(false)

  const generateBriefing = useCallback(async (userId: string) => {
    setBriefingLoading(true)
    try {
      const res = await fetch('/api/dashboard/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const result = await res.json()
      if (result.briefing) {
        setData((prev) => ({ ...prev, briefing: result.briefing }))
      }
    } catch (err) {
      console.error('Briefing error:', err)
    } finally {
      setBriefingLoading(false)
    }
  }, [])

  const syncFreshData = useCallback(async (userId: string) => {
    try {
      const ouraSync = await fetch('/api/oura/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).then((r) => r.json())
      if (ouraSync.data) {
        setData((prev) => ({ ...prev, oura: ouraSync.data }))
      }
    } catch {
      // optional
    }

    try {
      const calSync = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).then((r) => r.json())
      if (calSync.events) {
        const today = new Date().toISOString().split('T')[0]
        setData((prev) => ({
          ...prev,
          events: calSync.events
            .filter((e: CalendarEvent) => e.event_date === today)
            .map((e: CalendarEvent) => ({ ...e, id: e.id ?? (e as { google_event_id?: string }).google_event_id ?? e.title })),
        }))
      }
    } catch {
      // optional
    }

    try {
      const gmailSync = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).then((r) => r.json())
      if (gmailSync.digest) {
        setData((prev) => ({ ...prev, gmail: gmailSync.digest }))
      }
    } catch {
      // optional
    }
  }, [])

  const loadDashboard = useCallback(async () => {
    const userId = getUserId()
    setLoading(true)

    try {
      const [ouraRes, calendarRes, gmailRes, briefingRes, questsRes, xpRes] =
        await Promise.allSettled([
          fetch(`/api/oura/sync?userId=${encodeURIComponent(userId)}`).then((r) =>
            r.json()
          ),
          fetch(`/api/calendar/sync?userId=${encodeURIComponent(userId)}`).then((r) =>
            r.json()
          ),
          fetch(`/api/gmail/sync?userId=${encodeURIComponent(userId)}`).then((r) =>
            r.json()
          ),
          fetch(`/api/dashboard/briefing?userId=${encodeURIComponent(userId)}`).then(
            (r) => r.json()
          ),
          fetch(`/api/quests/today?userId=${encodeURIComponent(userId)}`).then((r) =>
            r.json()
          ),
          fetch(`/api/dashboard/xp?userId=${encodeURIComponent(userId)}`).then((r) =>
            r.json()
          ),
        ])

      const newData: DashboardData = {
        briefing: null,
        oura: null,
        events: [],
        gmail: null,
        quests: [],
        xp: {},
      }

      if (ouraRes.status === 'fulfilled' && ouraRes.value?.data) {
        newData.oura = ouraRes.value.data
      }

      if (calendarRes.status === 'fulfilled' && calendarRes.value?.events) {
        const today = new Date().toISOString().split('T')[0]
        newData.events = calendarRes.value.events
          .filter((e: Record<string, unknown>) => e.event_date === today)
          .map(mapCalendarEvent)
      }

      if (gmailRes.status === 'fulfilled' && gmailRes.value?.digest) {
        newData.gmail = gmailRes.value.digest
      }

      if (briefingRes.status === 'fulfilled' && briefingRes.value?.briefing) {
        newData.briefing = briefingRes.value.briefing
      }

      if (questsRes.status === 'fulfilled' && questsRes.value?.quests) {
        newData.quests = questsRes.value.quests
      }

      if (xpRes.status === 'fulfilled' && xpRes.value?.xp) {
        newData.xp = xpRes.value.xp
      } else {
        const localXp = loadXP()
        newData.xp = { ...localXp }
      }

      setData(newData)

      if (!newData.briefing) {
        void generateBriefing(userId)
      }

      void syncFreshData(userId)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [generateBriefing, syncFreshData])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const hasContent =
    data.oura ||
    data.events.length > 0 ||
    data.gmail ||
    data.quests.length > 0 ||
    Object.keys(data.xp).some((k) => (data.xp[k] ?? 0) > 0)

  return (
    <div className="min-h-screen bg-[#0D0820] text-white pb-28">
      <div className="px-4 pt-8 pb-4">
        <p className="text-xs text-white/40 uppercase tracking-widest mb-1">{today}</p>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          Your Day
        </h1>
      </div>

      <div className="mx-4 mb-5">
        <div className="relative rounded-2xl overflow-hidden border border-violet-500/20 bg-violet-500/5 p-5">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-transparent" />
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-0.5">🔮</div>
            <div className="flex-1">
              {briefingLoading || (!data.briefing && loading) ? (
                <div className="space-y-2">
                  <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
                  <div className="h-3 bg-white/10 rounded animate-pulse w-4/5" />
                  <div className="h-3 bg-white/10 rounded animate-pulse w-3/5" />
                </div>
              ) : data.briefing ? (
                <p className="text-sm text-white/85 leading-relaxed">{data.briefing}</p>
              ) : (
                <p className="text-sm text-white/40 italic">Arc is thinking about your day...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {data.oura && (
        <div className="mx-4 mb-5">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base">💍</span>
                <span className="text-xs font-medium text-white/60">Oura Ring</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-green-400" />
            </div>
            <div className="flex justify-around">
              <VitalRing
                score={data.oura.readiness_score}
                label="Readiness"
                color="#a78bfa"
              />
              <VitalRing score={data.oura.sleep_score} label="Sleep" color="#60a5fa" />
              <VitalRing
                score={data.oura.activity_score}
                label="Activity"
                color="#34d399"
              />
            </div>
            {(data.oura.hrv_balance !== null ||
              data.oura.steps !== null ||
              data.oura.sleep_total_seconds !== null) && (
              <div className="flex gap-4 mt-4 pt-3 border-t border-white/10 justify-center">
                {data.oura.hrv_balance !== null && (
                  <div className="text-center">
                    <div className="text-sm font-bold text-fuchsia-400">
                      {data.oura.hrv_balance}
                    </div>
                    <div className="text-xs text-white/40">HRV</div>
                  </div>
                )}
                {data.oura.steps !== null && (
                  <div className="text-center">
                    <div className="text-sm font-bold text-emerald-400">
                      {data.oura.steps.toLocaleString()}
                    </div>
                    <div className="text-xs text-white/40">Steps</div>
                  </div>
                )}
                {data.oura.sleep_total_seconds !== null && (
                  <div className="text-center">
                    <div className="text-sm font-bold text-blue-400">
                      {Math.floor(data.oura.sleep_total_seconds / 3600)}h{' '}
                      {Math.round((data.oura.sleep_total_seconds % 3600) / 60)}m
                    </div>
                    <div className="text-xs text-white/40">Duration</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {data.events.length > 0 && (
        <div className="mx-4 mb-5">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📅</span>
                <span className="text-xs font-medium text-white/60">Today</span>
              </div>
              <span className="text-xs text-white/30">{data.events.length} events</span>
            </div>
            <div className="space-y-2">
              {data.events.map((event) => {
                const happening = isHappening(event)
                const past =
                  event.end_time && new Date(event.end_time).getTime() < Date.now()
                return (
                  <div
                    key={event.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                      happening
                        ? 'bg-violet-500/15 border border-violet-500/25'
                        : 'bg-white/[0.03]'
                    } ${past ? 'opacity-35' : ''}`}
                  >
                    <div className="text-right min-w-[40px]">
                      {event.all_day ? (
                        <span className="text-xs text-white/30">all day</span>
                      ) : event.start_time ? (
                        <span
                          className={`text-xs font-semibold ${happening ? 'text-violet-300' : 'text-white/50'}`}
                        >
                          {formatEventTime(event.start_time)}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${happening ? 'bg-violet-400' : 'bg-white/20'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/80 truncate">
                        {event.title}
                      </p>
                      {event.location && (
                        <p className="text-xs text-white/30 truncate">📍 {event.location}</p>
                      )}
                    </div>
                    {happening && (
                      <span className="text-xs bg-violet-500 text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">
                        NOW
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {data.gmail && data.gmail.unread_count > 0 && (
        <div className="mx-4 mb-5">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📧</span>
                <span className="text-xs font-medium text-white/60">Inbox</span>
              </div>
              <div className="flex items-center gap-2">
                {data.gmail.action_items.some((i) => i.urgency === 'high') && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                    urgent
                  </span>
                )}
                <span className="text-xs text-white/30">{data.gmail.unread_count} unread</span>
              </div>
            </div>
            {data.gmail.needs_reply_count > 0 && (
              <p className="text-xs text-amber-400 mb-2">
                ↩ {data.gmail.needs_reply_count} waiting for reply
              </p>
            )}
            <div className="space-y-1.5">
              {data.gmail.action_items.slice(0, 3).map((item, i) => (
                <div
                  key={`${item.subject}-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      item.urgency === 'high'
                        ? 'bg-red-400'
                        : item.urgency === 'medium'
                          ? 'bg-amber-400'
                          : 'bg-white/20'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/70 truncate">{item.from}</p>
                    <p className="text-xs text-white/40 truncate">{item.subject}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {data.quests.length > 0 && (
        <div className="mx-4 mb-5">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 px-1">
            Today&apos;s Quests
          </h2>
          <div className="space-y-3">
            {data.quests.map((quest) => (
              <div
                key={quest.id}
                className={`rounded-2xl p-4 border ${
                  quest.completed
                    ? 'bg-white/[0.03] border-white/5 opacity-50'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-white/40 uppercase tracking-wide">
                        {quest.dimension}
                      </span>
                      <span className="text-xs text-amber-400 font-semibold">
                        +{quest.xp_reward}XP
                      </span>
                    </div>
                    <p
                      className={`text-sm font-semibold ${quest.completed ? 'line-through text-white/40' : 'text-white'}`}
                    >
                      {quest.title}
                    </p>
                    <p className="text-xs text-white/50 mt-1 leading-relaxed">
                      {quest.description}
                    </p>
                  </div>
                  {quest.completed && <span className="text-lg shrink-0">✅</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(data.xp).length > 0 && (
        <div className="mx-4 mb-5">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 px-1">
            Character Stats
          </h2>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
            {DIMENSION_LIST.map((dim) => {
              const xp = data.xp[dim.key] ?? 0
              const level = Math.floor(xp / XP_PER_LEVEL) + 1
              const progress = (xp % XP_PER_LEVEL) / XP_PER_LEVEL
              return (
                <div key={dim.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{dim.emoji}</span>
                      <span className="text-xs font-medium text-white/70">{dim.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/30">{xp} XP</span>
                      <span className="text-xs font-bold" style={{ color: dim.color }}>
                        Lv.{level}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(progress * 100, 100)}%`,
                        backgroundColor: dim.color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && !hasContent && (
        <div className="mx-4 text-center py-12">
          <div className="text-4xl mb-4">🔮</div>
          <p className="text-white/40 text-sm">
            Connect your integrations to bring your dashboard to life.
          </p>
          <Link href="/quests" className="mt-4 inline-block text-xs text-violet-400 underline">
            Go to Quests →
          </Link>
        </div>
      )}
    </div>
  )
}
