'use client'

import { useEffect, useState, useRef, type ReactNode } from 'react'
import { getUserId } from '@/lib/user'
import { loadTodayQuests, loadCompletedQuests } from '@/lib/xp'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OuraData {
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
  cycle_day: number | null
  cycle_phase: string | null
}

interface CalendarEvent {
  id: string
  title: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  event_date: string
}

interface Quest {
  id: string
  title: string
  dimension: string
  xp_reward: number
  completed: boolean
}

interface WealthData {
  net_worth: number | null
  fire_goal: number
  fire_year: number
  total_resisted: number
  last_resist_item: string | null
  last_resist_amount: number | null
}

// ─── Cycle phase config ───────────────────────────────────────────────────────

const CYCLE_PHASES: Record<string, { emoji: string; label: string }> = {
  menstrual: { emoji: '🌑', label: 'Menstrual' },
  follicular: { emoji: '🌒', label: 'Follicular' },
  ovulatory: { emoji: '🌕', label: 'Ovulatory' },
  luteal: { emoji: '🌖', label: 'Luteal' },
}

// ─── Arc verdict logic ────────────────────────────────────────────────────────

function getArcVerdict(oura: OuraData): { text: string; color: string } {
  const r = oura.readiness_score ?? 0
  const s = oura.sleep_score ?? 0
  const phase = oura.cycle_phase?.toLowerCase() ?? null

  if (phase === 'menstrual') {
    if (r < 70 || s < 70) {
      return {
        color: '#f472b6',
        text: 'Menstrual phase + lower scores. Rest is the mission today — gentle movement, iron-rich food, early bed.',
      }
    }
    return {
      color: '#f472b6',
      text: 'Menstrual phase. Even with decent numbers, your body is doing inner work. Choose depth over intensity.',
    }
  }

  if (phase === 'ovulatory') {
    if (r >= 85 && s >= 75) {
      return {
        color: '#34d399',
        text: 'Peak phase + optimal body. Your highest performance window — attack the hardest thing before noon.',
      }
    }
    return {
      color: '#6ee7a4',
      text: 'Ovulatory phase. Good energy window — lead with your best work despite slightly lower recovery.',
    }
  }

  if (phase === 'luteal') {
    if (r >= 80) {
      return {
        color: '#a78bfa',
        text: 'Luteal phase. Good body baseline. Finish things, go deep on existing work — new starts can wait.',
      }
    }
    return {
      color: '#a78bfa',
      text: 'Luteal phase + lower recovery. Protect your energy. Batch tasks, skip draining interactions.',
    }
  }

  if (phase === 'follicular') {
    if (r >= 80) {
      return {
        color: '#34d399',
        text: 'Follicular phase + great readiness. Energy rising — excellent time to start something new or push harder.',
      }
    }
    return {
      color: '#60a5fa',
      text: 'Follicular phase. Energy building. Steady effort today, bigger push coming as the week progresses.',
    }
  }

  if (r >= 85 && s >= 75) {
    return {
      color: '#34d399',
      text: 'Optimal body. No excuses. Attack your hardest challenge before noon.',
    }
  }
  if (r >= 70 && s >= 65) {
    return {
      color: '#60a5fa',
      text: 'Solid baseline today. Steady, focused work — you have good fuel in the tank.',
    }
  }
  if (r < 60 || s < 60) {
    return {
      color: '#f87171',
      text: 'Body asking for recovery. Protect your energy — short deep work sessions, then rest.',
    }
  }
  return {
    color: '#fbbf24',
    text: 'Moderate recovery. Prioritize the one thing that matters most today, then be gentle with the rest.',
  }
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  score,
  label,
  color,
  size = 58,
  stroke = 4.5,
}: {
  score: number | null
  label: string
  color: string
  size?: number
  stroke?: number
}) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const filled = score ? (score / 100) * circ : 0

  const statusLabel = !score
    ? '—'
    : score >= 85
      ? 'Optimal'
      : score >= 70
        ? 'Good'
        : score >= 55
          ? 'Fair'
          : 'Low'

  return (
    <div className="flex flex-col items-center gap-[3px]">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: 'rotate(-90deg)', display: 'block' }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
          />
          {score !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={circ}
              strokeDashoffset={circ - filled}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{score ?? '—'}</span>
        </div>
      </div>
      <p className="text-[9px] text-white/35 m-0">{label}</p>
      <p
        className="text-[9px] font-semibold m-0"
        style={{ color: score !== null ? color : 'rgba(255,255,255,0.3)' }}
      >
        {statusLabel}
      </p>
    </div>
  )
}

// ─── Character SVG avatars ────────────────────────────────────────────────────

function ForgeAvatar() {
  return (
    <div
      className="w-[42px] h-[42px] rounded-[13px] overflow-hidden flex items-end justify-center flex-shrink-0"
      style={{ background: 'rgba(232,148,26,0.2)' }}
    >
      <svg width="42" height="42" viewBox="0 0 42 42">
        <rect x="13" y="25" width="16" height="13" rx="3" fill="#8B5000" />
        <rect x="14" y="12" width="14" height="14" rx="4" fill="#E8941A" />
        <rect x="13" y="19" width="16" height="3" rx="1" fill="#CC7A10" />
        <ellipse
          cx="18"
          cy="17"
          rx="3"
          ry="2.5"
          fill="#FFD47A"
          stroke="#5A2800"
          strokeWidth="1"
        />
        <ellipse
          cx="24"
          cy="17"
          rx="3"
          ry="2.5"
          fill="#FFD47A"
          stroke="#5A2800"
          strokeWidth="1"
        />
        <rect x="20.5" y="16" width="1" height="3" fill="#8B5000" />
        <circle cx="33" cy="9" r="2.5" fill="#FFD47A" />
        <circle cx="30" cy="13" r="1.5" fill="#FFA030" />
      </svg>
    </div>
  )
}

function EchoAvatar() {
  return (
    <div
      className="w-[42px] h-[42px] rounded-[13px] overflow-hidden flex items-end justify-center flex-shrink-0"
      style={{ background: 'rgba(46,204,113,0.2)' }}
    >
      <svg width="42" height="42" viewBox="0 0 42 42">
        <rect x="13" y="25" width="16" height="13" rx="3" fill="#1A8F50" />
        <rect
          x="11"
          y="24"
          width="6"
          height="10"
          rx="3"
          fill="rgba(110,231,164,0.25)"
          transform="rotate(15,14,29)"
        />
        <circle cx="21" cy="17" r="8" fill="#2ECC71" />
        <path
          d="M30 10 Q33 8 32 12"
          stroke="#6EE7A4"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M32 6 Q36 4 35 9"
          stroke="rgba(110,231,164,0.6)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M28 14 Q31 13 30 17"
          stroke="rgba(110,231,164,0.5)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function VaultAvatar() {
  return (
    <div
      className="w-[42px] h-[42px] rounded-[13px] overflow-hidden flex items-end justify-center flex-shrink-0"
      style={{ background: 'rgba(255,179,71,0.2)' }}
    >
      <svg width="42" height="42" viewBox="0 0 42 42">
        <rect x="13" y="25" width="16" height="13" rx="4" fill="#1A8F50" />
        <rect x="15" y="29" width="12" height="3" rx="1" fill="rgba(110,231,164,0.35)" />
        <rect x="15" y="34" width="9" height="2" rx="1" fill="rgba(110,231,164,0.2)" />
        <rect x="14" y="11" width="14" height="15" rx="4" fill="#2ECC71" />
        <circle cx="30" cy="10" r="5.5" fill="#FFD700" stroke="#B8860B" strokeWidth="1" />
        <text x="30" y="13.5" fontSize="6" fontWeight="700" fill="#7A5800" textAnchor="middle">
          $
        </text>
      </svg>
    </div>
  )
}

// ─── Mission Card ─────────────────────────────────────────────────────────────

function MissionCard({
  avatar,
  dimensionLabel,
  characterName,
  questTitle,
  badge,
  xpReward,
  progressPct,
  progressLabel,
  linkLabel,
  accentColor,
  cardBg,
  cardBorder,
  children,
}: {
  avatar: ReactNode
  dimensionLabel: string
  characterName: string
  questTitle: string
  badge: string
  xpReward: number
  progressPct: number
  progressLabel: string
  linkLabel: string
  accentColor: string
  cardBg: string
  cardBorder: string
  children?: ReactNode
}) {
  return (
    <div
      className="rounded-[18px] p-[11px_13px] mb-[7px]"
      style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
    >
      <div className="flex items-center gap-[10px]">
        {avatar}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[5px] mb-[2px]">
            <p
              className="text-[9px] font-semibold m-0 tracking-[0.08em]"
              style={{ color: accentColor }}
            >
              {characterName} · {dimensionLabel}
            </p>
            <span className="text-[8px] text-white/[0.28] bg-white/[0.08] px-[5px] py-[1px] rounded">
              {badge}
            </span>
          </div>
          <p className="text-[12px] font-semibold text-white m-0 truncate">{questTitle}</p>
        </div>
        <span
          className="text-[10px] font-bold flex-shrink-0 px-[7px] py-[3px] rounded-md"
          style={{ color: accentColor, background: `${accentColor}30` }}
        >
          +{xpReward} XP
        </span>
      </div>

      {children}

      <div className="mt-[8px] h-[2px] bg-white/[0.08] rounded-full">
        <div
          className="h-[2px] rounded-full transition-all duration-1000"
          style={{ width: `${Math.max(progressPct, 2)}%`, background: accentColor }}
        />
      </div>
      <div className="flex justify-between mt-[4px]">
        <span className="text-[8px] text-white/[0.22]">{progressLabel}</span>
        <span className="text-[8px] text-white/[0.22]">{linkLabel} ↗</span>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [oura, setOura] = useState<OuraData | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [wealth, setWealth] = useState<WealthData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const userId = useRef(getUserId())

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    const uid = userId.current
    const today = new Date().toISOString().split('T')[0]

    const [ouraRes, calRes, questRes, wealthRes] = await Promise.allSettled([
      fetch(`/api/oura/sync?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/calendar/sync?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/quests/today?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(`/api/wealth?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
    ])

    if (ouraRes.status === 'fulfilled' && ouraRes.value?.data) {
      setOura(ouraRes.value.data)
    }
    if (calRes.status === 'fulfilled' && calRes.value?.events) {
      setEvents(
        calRes.value.events.filter((e: CalendarEvent) => e.event_date === today)
      )
    }
    if (questRes.status === 'fulfilled' && questRes.value?.quests?.length) {
      setQuests(questRes.value.quests)
    } else {
      const completedIds = loadCompletedQuests()
      const localQuests = loadTodayQuests().map((q) => ({
        id: q.id,
        title: q.title,
        dimension: q.dimensionId,
        xp_reward: q.xpReward,
        completed: completedIds.has(q.id),
      }))
      if (localQuests.length > 0) setQuests(localQuests)
    }
    if (wealthRes.status === 'fulfilled' && wealthRes.value) {
      setWealth(wealthRes.value)
    }
    setLoaded(true)

    void syncBackground(uid, today)
  }

  async function syncBackground(uid: string, today: string) {
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
          calSync.events.filter((e: CalendarEvent) => e.event_date === today)
        )
      }
    } catch {
      // optional
    }
  }

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const verdict = oura ? getArcVerdict(oura) : null
  const cyclePhase = oura?.cycle_phase
    ? (CYCLE_PHASES[oura.cycle_phase.toLowerCase()] ?? null)
    : null

  const careerQuest = quests.find(
    (q) => q.dimension === 'create' || q.dimension === 'career'
  )
  const socialQuest = quests.find((q) => q.dimension === 'social')
  const wealthQuest = quests.find((q) => q.dimension === 'wealth')

  const netWorth = wealth?.net_worth ?? null
  const fireGoal = wealth?.fire_goal ?? 150_000
  const fireYear = wealth?.fire_year ?? 2028
  const firePct = netWorth ? Math.min(Math.round((netWorth / fireGoal) * 100), 100) : 0
  const remaining = netWorth ? fireGoal - netWorth : fireGoal

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  function isNext(event: CalendarEvent) {
    const upcoming = events.filter(
      (e) => e.start_time && new Date(e.start_time).getTime() > Date.now()
    )
    return upcoming[0]?.id === event.id
  }

  function isPast(event: CalendarEvent) {
    return !!(event.end_time && new Date(event.end_time).getTime() < Date.now())
  }

  return (
    <div className="min-h-screen pb-28 overflow-x-hidden" style={{ background: '#0D0820' }}>
      {/* ── Header ── */}
      <div className="px-4 pt-10 pb-4">
        <p className="text-[10px] text-white/[0.28] mb-[2px] tracking-[0.14em] uppercase">
          {todayLabel}
        </p>
        <h1 className="text-[26px] font-bold text-white m-0">Your Day</h1>
      </div>

      {/* ── Body Status Card ── */}
      <div className="mx-4 mb-[10px]">
        <div
          className="rounded-[22px] p-[14px]"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          <div className="flex justify-between items-center mb-[13px]">
            <p className="text-[9px] text-white/[0.28] tracking-[0.13em] m-0 uppercase">
              Body Status
            </p>
            {cyclePhase ? (
              <div
                className="flex items-center gap-1 px-[9px] py-[3px] rounded-lg"
                style={{
                  background: 'rgba(244,114,182,0.16)',
                  border: '1px solid rgba(244,114,182,0.32)',
                }}
              >
                <span className="text-[10px]">{cyclePhase.emoji}</span>
                <span className="text-[9px] font-semibold" style={{ color: '#f9a8d4' }}>
                  {cyclePhase.label}
                  {oura?.cycle_day ? ` · Day ${oura.cycle_day}` : ''}
                </span>
              </div>
            ) : (
              <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
            )}
          </div>

          <div className="flex justify-around mb-[12px]">
            <ScoreRing
              score={oura?.readiness_score ?? null}
              label="Readiness"
              color="#34d399"
            />
            <ScoreRing score={oura?.sleep_score ?? null} label="Sleep" color="#60a5fa" />
            <ScoreRing
              score={oura?.activity_score ?? null}
              label="Activity"
              color="#fb923c"
            />
          </div>

          {verdict && (
            <div
              className="flex items-start gap-2 pt-[10px]"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div
                className="w-[7px] h-[7px] rounded-full flex-shrink-0 mt-[3px]"
                style={{ background: verdict.color }}
              />
              <p className="text-[11px] text-white/[0.78] m-0 leading-[1.5]">{verdict.text}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Active Missions ── */}
      <div className="mx-4 mb-1">
        <div className="flex justify-between items-center mb-[7px]">
          <p className="text-[9px] text-white/[0.28] tracking-[0.13em] m-0 uppercase">
            Active Missions
          </p>
          <p className="text-[9px] text-white/[0.22] m-0">see all →</p>
        </div>

        <MissionCard
          avatar={<ForgeAvatar />}
          characterName="Forge"
          dimensionLabel="Career"
          questTitle={careerQuest?.title ?? 'No quest today — tap to add one'}
          badge="DAILY"
          xpReward={careerQuest?.xp_reward ?? 50}
          progressPct={careerQuest?.completed ? 100 : 0}
          progressLabel="CPTO interviews in progress"
          linkLabel="CPTO Hunt"
          accentColor="#fbbf24"
          cardBg="rgba(232,148,26,0.09)"
          cardBorder="rgba(232,148,26,0.28)"
        />

        <MissionCard
          avatar={<EchoAvatar />}
          characterName="Echo"
          dimensionLabel="Social"
          questTitle={socialQuest?.title ?? 'Message one new person this week'}
          badge="WEEKLY"
          xpReward={socialQuest?.xp_reward ?? 30}
          progressPct={5}
          progressLabel="0 of 1 connections this week"
          linkLabel="London Circle"
          accentColor="#6ee7a4"
          cardBg="rgba(46,204,113,0.09)"
          cardBorder="rgba(46,204,113,0.28)"
        />

        <MissionCard
          avatar={<VaultAvatar />}
          characterName="Vault"
          dimensionLabel="Finances"
          questTitle={
            wealth?.last_resist_item
              ? `${wealth.total_resisted > 0 ? `€${wealth.total_resisted.toLocaleString()} saved` : ''} · log a resist`
              : 'Log a resist · start building your vault'
          }
          badge="LOG RESIST"
          xpReward={wealthQuest?.xp_reward ?? 20}
          progressPct={firePct}
          progressLabel={
            netWorth
              ? `€${netWorth.toLocaleString()} · ${firePct}% to goal`
              : 'Add your net worth to track progress'
          }
          linkLabel="Vault"
          accentColor="#FFB347"
          cardBg="rgba(255,179,71,0.09)"
          cardBorder="rgba(255,179,71,0.30)"
        >
          {netWorth !== null && (
            <div
              className="mt-[9px] rounded-lg px-[10px] py-[8px]"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <div className="flex justify-between items-baseline mb-[5px]">
                <span className="text-[10px] font-bold text-white">
                  €{netWorth.toLocaleString()}
                </span>
                <span className="text-[8px] text-white/[0.30]">
                  goal €{fireGoal.toLocaleString()} by {fireYear}
                </span>
              </div>
              <div
                className="h-[4px] rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-[4px] rounded-full transition-all duration-1000"
                  style={{
                    width: `${firePct}%`,
                    background: 'linear-gradient(90deg,#FFB347,#FFD47A)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-[4px]">
                <span className="text-[8px] font-semibold" style={{ color: '#FFB347' }}>
                  {firePct}% there
                </span>
                <span className="text-[8px] text-white/[0.22]">
                  €{remaining.toLocaleString()} to go
                </span>
              </div>
            </div>
          )}
          {wealth?.last_resist_item && wealth.last_resist_amount !== null && (
            <p className="text-[8px] text-white/[0.22] m-0 mt-[6px]">
              Last resist: {wealth.last_resist_item} €{wealth.last_resist_amount} → €
              {Math.round(wealth.last_resist_amount * 1.97)} in 10y
            </p>
          )}
        </MissionCard>
      </div>

      {/* ── Today Schedule ── */}
      {events.length > 0 && (
        <div className="mx-4 mt-[4px]">
          <div
            className="rounded-[16px] p-[11px_14px]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <p className="text-[9px] text-white/[0.28] tracking-[0.13em] m-0 mb-[8px] uppercase">
              Today
            </p>
            {events.map((event, i) => {
              const next = isNext(event)
              const past = isPast(event)
              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-[9px] py-[2px] ${i > 0 ? 'mt-[4px]' : ''} ${past ? 'opacity-30' : ''}`}
                >
                  <span
                    className="text-[10px] font-semibold w-[30px] text-right flex-shrink-0"
                    style={{ color: next ? '#38bdf8' : 'rgba(255,255,255,0.28)' }}
                  >
                    {event.all_day
                      ? 'all'
                      : event.start_time
                        ? formatTime(event.start_time)
                        : ''}
                  </span>
                  <div
                    className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                    style={{ background: next ? '#38bdf8' : 'rgba(255,255,255,0.15)' }}
                  />
                  <span
                    className="text-[11px] flex-1 truncate"
                    style={{
                      color: next ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)',
                    }}
                  >
                    {event.title}
                  </span>
                  {next && (
                    <span className="text-[9px] flex-shrink-0" style={{ color: '#38bdf8' }}>
                      next
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loaded && !oura && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <div className="text-5xl mb-4">🔮</div>
          <h2 className="text-lg font-bold text-white/60 mb-2">Your dashboard awaits</h2>
          <p className="text-sm text-white/30 mb-6">
            Connect your integrations to bring it to life.
          </p>
          <a
            href="/quests"
            className="px-6 py-3 rounded-2xl text-sm font-semibold"
            style={{
              background: 'rgba(123,63,228,0.3)',
              border: '1px solid rgba(123,63,228,0.3)',
              color: '#a78bfa',
            }}
          >
            Connect integrations →
          </a>
        </div>
      )}
    </div>
  )
}
