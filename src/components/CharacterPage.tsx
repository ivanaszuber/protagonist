'use client'

import { useEffect, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { StatBar } from '@/components/StatBar'
import {
  BlazeCharacterLarge,
  EchoCharacterLarge,
  ForgeCharacterLarge,
  RootCharacterLarge,
  SageCharacterLarge,
  SolCharacterLarge,
  VaultCharacterLarge,
} from '@/components/characters/CharacterHeroArt'
import { getLevel } from '@/lib/xp'
import { CHARACTERS, type Dimension } from '@/lib/character'
import { DIMENSION_TO_SLUG, getTierName } from '@/lib/tierName'
import {
  XpToastOverlay,
  showXpFeedback,
  type LevelUpToast,
  type XpToast,
} from '@/components/XpToastOverlay'
import { getUserId } from '@/lib/user'
import { TopNav } from '@/components/TopNav'
import { LegendCard } from '@/components/characters/LegendCard'
import {
  MainQuestsSection,
  type MainQuestMilestone,
} from '@/components/characters/MainQuestsSection'
import { BossCard } from '@/components/characters/BossCard'
import { HallOfKills } from '@/components/characters/HallOfKills'
import { MedalsRow } from '@/components/characters/MedalsRow'
import type { BossBattle, BossKillRow, BossTask } from '@/lib/bosses'
import { MEDAL_DEFINITIONS } from '@/lib/medals'

interface Milestone extends MainQuestMilestone {}

interface Task {
  id: string
  title: string
  task_date: string
  completed: boolean
  xp_reward: number
}

interface QuestData {
  id: string
  vision: string
  character_name: string
  character_class: string
  milestones: Milestone[]
  recent_tasks: Task[]
  xp: number
  bosses_slain?: number
  streak_days?: number
}

interface OuraData {
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
}

const HERO_ART: Record<Dimension, ComponentType> = {
  career: ForgeCharacterLarge,
  social: EchoCharacterLarge,
  wealth: VaultCharacterLarge,
  vitality: BlazeCharacterLarge,
  mind: SageCharacterLarge,
  love: SolCharacterLarge,
  family: RootCharacterLarge,
}

const FLOAT_DELAYS: Record<Dimension, string> = {
  career: '0s',
  social: '0.5s',
  wealth: '1s',
  vitality: '0.25s',
  mind: '0.75s',
  love: '1.25s',
  family: '1.5s',
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function LeftBorderCard({
  accentColor,
  children,
  style,
}: {
  accentColor: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        background: '#140C28',
        borderRadius: 14,
        border: '0.5px solid #2D1B55',
        padding: '14px 14px 14px 17px',
        marginBottom: 8,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: accentColor,
        }}
      />
      {children}
    </div>
  )
}

interface CharacterPageProps {
  dimension: Dimension
}

export function CharacterPage({ dimension }: CharacterPageProps) {
  const char = CHARACTERS[dimension]
  const characterSlug = DIMENSION_TO_SLUG[dimension]
  const accentColor = char.color
  const HeroArt = HERO_ART[dimension]
  const floatDelay = FLOAT_DELAYS[dimension]

  const [quest, setQuest] = useState<QuestData | null>(null)
  const [oura, setOura] = useState<OuraData | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskXp, setNewTaskXp] = useState(50)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [xpToast, setXpToast] = useState<XpToast | null>(null)
  const [levelUpToast, setLevelUpToast] = useState<LevelUpToast | null>(null)
  const [oracleMemories, setOracleMemories] = useState<string[]>([])
  const [boss, setBoss] = useState<BossBattle | null>(null)
  const [escapedBoss, setEscapedBoss] = useState<BossBattle | null>(null)
  const [bossTasks, setBossTasks] = useState<BossTask[]>([])
  const [bossKills, setBossKills] = useState<BossKillRow[]>([])
  const [killStats, setKillStats] = useState({ slain: 0, escaped: 0 })
  const [earnedMedals, setEarnedMedals] = useState<string[]>([])

  async function loadBossAndMedals(uid: string) {
    const [bossRes, killsRes, medalsRes] = await Promise.all([
      fetch(
        `/api/bosses/active?userId=${encodeURIComponent(uid)}&dimension=${encodeURIComponent(dimension)}`
      ).then((r) => r.json()),
      fetch(
        `/api/bosses/kills?userId=${encodeURIComponent(uid)}&dimension=${encodeURIComponent(dimension)}`
      ).then((r) => r.json()),
      fetch(
        `/api/medals/check?userId=${encodeURIComponent(uid)}&dimension=${encodeURIComponent(dimension)}`,
        { method: 'POST' }
      ).then((r) => r.json()),
    ])
    const bossData = bossRes as {
      boss?: BossBattle | null
      tasks?: BossTask[]
      escapedBoss?: BossBattle | null
    }
    setBoss(bossData.boss ?? null)
    setBossTasks(bossData.tasks ?? [])
    setEscapedBoss(bossData.escapedBoss ?? null)
    const killsData = killsRes as {
      kills?: BossKillRow[]
      stats?: { slain: number; escaped: number }
    }
    setBossKills(killsData.kills ?? [])
    setKillStats(killsData.stats ?? { slain: 0, escaped: 0 })
    const medalsData = medalsRes as { earned?: string[] }
    setEarnedMedals(medalsData.earned ?? [])
  }

  useEffect(() => {
    const uid = getUserId()
    const memoryDim = CHARACTERS[dimension].memoryId
    const fetches: Promise<unknown>[] = [
      fetch(`/api/quests/character/${dimension}?userId=${encodeURIComponent(uid)}`).then(
        (r) => r.json()
      ),
      fetch(
        `/api/memories?userId=${encodeURIComponent(uid)}&dimension=${encodeURIComponent(memoryDim)}&limit=3`
      ).then((r) => r.json()),
      loadBossAndMedals(uid),
    ]
    if (dimension === 'vitality') {
      fetches.push(fetch(`/api/oura/sync?userId=${encodeURIComponent(uid)}`).then((r) => r.json()))
    }
    Promise.allSettled(fetches).then((results) => {
      const questRes = results[0]
      const memoriesRes = results[1]
      const ouraRes = dimension === 'vitality' ? results[3] : null
      if (questRes.status === 'fulfilled') {
        const val = questRes.value as { quest?: QuestData | null }
        setQuest(val.quest ?? null)
      }
      if (memoriesRes.status === 'fulfilled') {
        const val = memoriesRes.value as { memories?: string[] }
        setOracleMemories(val.memories ?? [])
      }
      if (ouraRes?.status === 'fulfilled') {
        const val = ouraRes.value as { data?: OuraData }
        if (val.data) setOura(val.data)
      }
      setLoading(false)
    })
  }, [dimension])

  async function handleBossTaskComplete(taskId: string, xpReward: number) {
    const uid = getUserId()
    const res = await fetch(`/api/quests/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid }),
    })
    const data = (await res.json()) as {
      xp_earned?: number
      leveled_up?: boolean
      new_level?: number
      boss?: { slain: boolean; reward_xp?: number }
    }
    if (res.ok) {
      const earned = data.xp_earned ?? xpReward
      setQuest((prev) =>
        prev ? { ...prev, xp: prev.xp + earned } : prev
      )
      showXpFeedback({ dimension }, data, setXpToast, setLevelUpToast)
      return {
        slain: data.boss?.slain,
        reward_xp: data.boss?.reward_xp,
      }
    }
    return {}
  }

  async function refreshAfterBossSlain() {
    const uid = getUserId()
    await loadBossAndMedals(uid)
    const questRes = await fetch(
      `/api/quests/character/${dimension}?userId=${encodeURIComponent(uid)}`
    ).then((r) => r.json())
    const val = questRes as { quest?: QuestData | null }
    setQuest(val.quest ?? null)
  }

  async function handleTaskToggle(taskId: string, xpReward: number) {
    const task = quest?.recent_tasks.find((t) => t.id === taskId)
    if (!task || task.completed) return

    setCompletingId(taskId)
    const uid = getUserId()
    try {
      const res = await fetch(`/api/quests/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      })
      const data = (await res.json()) as {
        xp_earned?: number
        leveled_up?: boolean
        new_level?: number
      }

      if (res.ok) {
        const earned = data.xp_earned ?? xpReward
        setQuest((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            xp: prev.xp + earned,
            recent_tasks: prev.recent_tasks.map((t) =>
              t.id === taskId ? { ...t, completed: true } : t
            ),
          }
        })
        showXpFeedback({ dimension }, data, setXpToast, setLevelUpToast)
      }
    } finally {
      setCompletingId(null)
    }
  }

  async function deleteMilestone(milestoneId: string) {
    const uid = getUserId()
    const res = await fetch(
      `/api/quests/milestones?milestoneId=${encodeURIComponent(milestoneId)}&userId=${encodeURIComponent(uid)}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      setQuest((prev) =>
        prev
          ? { ...prev, milestones: prev.milestones.filter((m) => m.id !== milestoneId) }
          : prev
      )
    }
  }

  async function deleteTask(taskId: string) {
    const uid = getUserId()
    const res = await fetch(
      `/api/quests/tasks?taskId=${encodeURIComponent(taskId)}&userId=${encodeURIComponent(uid)}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      setQuest((prev) =>
        prev ? { ...prev, recent_tasks: prev.recent_tasks.filter((t) => t.id !== taskId) } : prev
      )
    }
  }

  async function addTask() {
    if (!newTaskTitle.trim() || !quest) return
    const today = new Date().toISOString().split('T')[0]
    const activeMilestone = quest.milestones.find((m) => !m.completed)
    const uid = getUserId()

    const res = await fetch('/api/quests/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: uid,
        milestoneId: activeMilestone?.id ?? null,
        dimension,
        title: newTaskTitle.trim(),
        xpReward: newTaskXp,
        taskDate: today,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setQuest((prev) =>
        prev
          ? {
              ...prev,
              recent_tasks: [data.task, ...prev.recent_tasks],
            }
          : prev
      )
      setNewTaskTitle('')
      setAddingTask(false)
    }
  }

  const xp = quest?.xp ?? 0
  const level = getLevel(xp)
  const xpInLevel = xp % 500
  const tierLabel = getTierName(level, characterSlug)
  const activeMilestone = quest?.milestones.find((m) => !m.completed) ?? null
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTasks =
    quest?.recent_tasks.filter((t) => t.task_date === todayStr) ?? []
  const focusTask =
    todayTasks.find((t) => !t.completed) ?? todayTasks[0] ?? null

  const pageShellStyle: CSSProperties = {
    minHeight: '100dvh',
    background: '#0D0820',
    overflowY: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    paddingBottom: 100,
    fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
  }

  if (loading) {
    return (
      <main className="dashboard-scroll" style={pageShellStyle}>
        <TopNav streakDays={0} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
          }}
        >
          <span style={{ color: '#3D3358', fontSize: 13 }}>Loading...</span>
        </div>
      </main>
    )
  }

  return (
    <main className="dashboard-scroll" style={pageShellStyle}>
      <TopNav streakDays={quest?.streak_days ?? 0} />
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '44px 16px 0' }}>
        {/* Hero */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 16,
            paddingBottom: 24,
            gap: 8,
          }}
        >
          <div
            style={{
              animation: 'protagonist-float 3.2s ease-in-out infinite',
              animationDelay: floatDelay,
              transformOrigin: 'center bottom',
            }}
          >
            <HeroArt />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 500, color: '#E8E0F0' }}>{char.name}</span>
            <span
              style={{
                background: '#2A1800',
                border: `0.5px solid ${accentColor}`,
                borderRadius: 20,
                padding: '2px 8px',
                fontSize: 10,
                color: accentColor,
              }}
            >
              {char.categoryLabel}
            </span>
          </div>

          <span
            style={{
              fontSize: 11,
              color: accentColor,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {tierLabel}
          </span>

          <div
            style={{
              display: 'flex',
              gap: 16,
              marginTop: 4,
              fontSize: 10,
              color: '#6B5E8C',
            }}
          >
            <span>
              Bosses Slain{' '}
              <strong style={{ color: accentColor }}>{quest?.bosses_slain ?? killStats.slain}</strong>
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#1E0D40',
              borderRadius: 20,
              padding: '4px 12px',
              border: '0.5px solid #3D2070',
            }}
          >
            <span style={{ fontSize: 11, color: '#7A5FA0' }}>Level</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: accentColor }}>
              {level}
            </span>
          </div>

          <div style={{ width: '60%', marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: '#5A4A7A' }}>{xpInLevel} XP</span>
              <span style={{ fontSize: 9, color: '#5A4A7A' }}>500</span>
            </div>
            <div
              style={{
                height: 4,
                background: '#1E0D40',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.round((xpInLevel / 500) * 100)}%`,
                  background: accentColor,
                  borderRadius: 2,
                  transition: 'width 1s ease',
                }}
              />
            </div>
          </div>
        </div>

        {dimension === 'vitality' && (
          <LeftBorderCard accentColor={accentColor}>
            <span style={{ fontSize: 11, color: '#5A4A7A', display: 'block', marginBottom: 10 }}>
              Today&apos;s stats
            </span>
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
          </LeftBorderCard>
        )}

        <LegendCard
          characterName={char.name}
          dimensionLabel={char.categoryLabel}
          vision={quest?.vision ?? null}
          accentColor={accentColor}
        />

        {quest && (
          <MainQuestsSection
            characterName={char.name}
            dimensionLabel={char.categoryLabel}
            milestones={quest.milestones}
            accentColor={accentColor}
            onDelete={(id) => void deleteMilestone(id)}
          />
        )}

        <BossCard
          characterName={char.name}
          dimensionLabel={char.categoryLabel}
          mainQuestTitle={activeMilestone?.title ?? quest?.vision ?? null}
          boss={boss}
          escapedBoss={escapedBoss}
          tasks={bossTasks}
          onTaskComplete={handleBossTaskComplete}
          onBossSlain={() => void refreshAfterBossSlain()}
        />

        <HallOfKills kills={bossKills} stats={killStats} />

        <MedalsRow
          definitions={MEDAL_DEFINITIONS}
          earned={earnedMedals}
          accentColor={accentColor}
        />

        {oracleMemories.length > 0 && (
          <div
            style={{
              background: '#0D0820',
              border: '0.5px solid #1E1040',
              borderLeft: '2px solid #9333EA',
              borderRadius: '0 10px 10px 0',
              padding: '12px 14px',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: '#4A2878',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: oracleMemories.length < 3 ? 4 : 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="#6B3FA0" strokeWidth="1.2" />
                <circle cx="8" cy="8" r="2" fill="#6B3FA0" />
              </svg>
              Oracle remembers
            </div>
            {oracleMemories.length < 3 && (
              <div style={{ fontSize: 11, color: '#5A4A7A', marginBottom: 8, fontStyle: 'italic' }}>
                Oracle is just starting to know you
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {oracleMemories.map((memory, i) => {
                const dateMatch = memory.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.+)$/)
                const date = dateMatch?.[1]
                const text = dateMatch?.[2] ?? memory
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    {date && (
                      <span
                        style={{
                          fontSize: 9,
                          color: '#3D2060',
                          flexShrink: 0,
                          marginTop: 2,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#7A5FA0', lineHeight: 1.5 }}>{text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Today's quests */}
        {quest && (
          <LeftBorderCard accentColor={accentColor}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 11, color: '#5A4A7A' }}>Today&apos;s tasks</span>
              <button
                type="button"
                onClick={() => setAddingTask(!addingTask)}
                style={{
                  background: '#1E0D40',
                  border: '0.5px solid #3D2070',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 10,
                  color: '#7A5FA0',
                  cursor: 'pointer',
                }}
              >
                + Add
              </button>
            </div>

            {addingTask && (
              <div style={{ marginBottom: 10 }}>
                <input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void addTask()}
                  placeholder="What's the task?"
                  autoFocus
                  style={{
                    width: '100%',
                    background: '#1A0D35',
                    border: '0.5px solid #2D1B55',
                    borderRadius: 8,
                    padding: '8px 10px',
                    color: '#E8E0F0',
                    fontSize: 12,
                    outline: 'none',
                    marginBottom: 8,
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {[25, 50, 100, 200].map((xpVal) => (
                    <button
                      key={xpVal}
                      type="button"
                      onClick={() => setNewTaskXp(xpVal)}
                      style={{
                        flex: 1,
                        background: newTaskXp === xpVal ? accentColor : '#1A0D35',
                        border: '0.5px solid #2D1B55',
                        borderRadius: 6,
                        padding: '5px 0',
                        fontSize: 10,
                        color: newTaskXp === xpVal ? '#0D0820' : '#5A5070',
                        cursor: 'pointer',
                      }}
                    >
                      {xpVal} XP
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => void addTask()}
                    style={{
                      flex: 1,
                      background: accentColor,
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 0',
                      fontSize: 12,
                      color: '#0D0820',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Add task
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingTask(false)}
                    style={{
                      background: '#1A0D35',
                      border: '0.5px solid #2D1B55',
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontSize: 12,
                      color: '#5A5070',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {todayTasks.length === 0 && !addingTask && (
              <span style={{ fontSize: 11, color: '#3D3358', fontStyle: 'italic' }}>
                No quests today yet
              </span>
            )}

            {todayTasks
              .filter((t) => t.id !== focusTask?.id)
              .map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#1A0D35',
                    borderRadius: 8,
                    padding: '7px 10px',
                    marginBottom: 6,
                    border: '0.5px solid #2D1B55',
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleTaskToggle(task.id, task.xp_reward)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        void handleTaskToggle(task.id, task.xp_reward)
                      }
                    }}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      flexShrink: 0,
                      border: `1.5px solid ${task.completed ? '#34d399' : accentColor}`,
                      background: task.completed ? '#34d399' : 'transparent',
                      cursor: task.completed ? 'default' : 'pointer',
                    }}
                  />
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleTaskToggle(task.id, task.xp_reward)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        void handleTaskToggle(task.id, task.xp_reward)
                      }
                    }}
                    style={{
                      fontSize: 10,
                      color: task.completed ? '#5A4A7A' : '#C0B0E0',
                      textDecoration: task.completed ? 'line-through' : 'none',
                      flex: 1,
                      cursor: task.completed ? 'default' : 'pointer',
                    }}
                  >
                    {task.title}
                  </span>
                  {!task.completed && (
                    <span style={{ fontSize: 9, color: '#3D3358' }}>+{task.xp_reward} XP</span>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteTask(task.id)}
                    aria-label="Delete task"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2D1B55',
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: 'pointer',
                      padding: '0 2px',
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
          </LeftBorderCard>
        )}
      </div>

      <XpToastOverlay xpToast={xpToast} levelUpToast={levelUpToast} />
    </main>
  )
}
