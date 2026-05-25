'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { StatBar } from '@/components/StatBar'
import {
  EchoCharacterLarge,
  ForgeCharacterLarge,
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

interface Milestone {
  id: string
  title: string
  target_date: string | null
  completed: boolean
  sort_order: number
}

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
}

interface OuraData {
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
}

const HERO_ART = {
  career: ForgeCharacterLarge,
  social: EchoCharacterLarge,
  wealth: VaultCharacterLarge,
} as const

/** Character nav dimensions → dimension_memories.dimension_id */
const MEMORY_DIMENSION_ID: Record<Dimension, string> = {
  career: 'create',
  social: 'social',
  wealth: 'wealth',
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
  const floatDelay =
    dimension === 'career' ? '0s' : dimension === 'social' ? '0.5s' : '1s'

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

  useEffect(() => {
    const uid = getUserId()
    const memoryDim = MEMORY_DIMENSION_ID[dimension]
    Promise.allSettled([
      fetch(`/api/quests/character/${dimension}?userId=${encodeURIComponent(uid)}`).then(
        (r) => r.json()
      ),
      fetch(`/api/oura/sync?userId=${encodeURIComponent(uid)}`).then((r) => r.json()),
      fetch(
        `/api/memories?userId=${encodeURIComponent(uid)}&dimension=${encodeURIComponent(memoryDim)}&limit=3`
      ).then((r) => r.json()),
    ]).then(([questRes, ouraRes, memoriesRes]) => {
      if (questRes.status === 'fulfilled') {
        setQuest(questRes.value.quest ?? null)
      }
      if (ouraRes.status === 'fulfilled' && ouraRes.value?.data) {
        setOura(ouraRes.value.data)
      }
      if (memoriesRes.status === 'fulfilled') {
        setOracleMemories(memoriesRes.value.memories ?? [])
      }
      setLoading(false)
    })
  }, [dimension])

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
  const completedMilestones = quest?.milestones.filter((m) => m.completed) ?? []
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

  const questTitle = quest
    ? `${quest.character_name} · ${quest.character_class}`
    : ''

  return (
    <main className="dashboard-scroll" style={pageShellStyle}>
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '0 16px' }}>
        {/* Hero */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 32,
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

          <span style={{ fontSize: 22, fontWeight: 500, color: '#E8E0F0', marginTop: 4 }}>
            {char.name}
          </span>

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

        {/* Today's stats */}
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

        {/* Active quest */}
        {quest ? (
          <LeftBorderCard accentColor={accentColor}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#E8E0F0',
                display: 'block',
                marginBottom: 4,
              }}
            >
              {questTitle}
            </span>

            {quest.vision && (
              <span
                style={{
                  fontSize: 10,
                  color: '#5A4A7A',
                  fontStyle: 'italic',
                  display: 'block',
                  marginBottom: 8,
                }}
              >
                {quest.vision}
              </span>
            )}

            {activeMilestone && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  marginBottom: 8,
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
                <span style={{ fontSize: 10, color: '#7A5FA0' }}>{activeMilestone.title}</span>
                <span style={{ fontSize: 10, color: '#3D3358', marginLeft: 'auto' }}>
                  {daysUntil(activeMilestone.target_date)}d left
                </span>
              </div>
            )}

            {focusTask && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => void handleTaskToggle(focusTask.id, focusTask.xp_reward)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    void handleTaskToggle(focusTask.id, focusTask.xp_reward)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  background: '#1A0D35',
                  borderRadius: 8,
                  padding: '7px 10px',
                  cursor: focusTask.completed ? 'default' : 'pointer',
                  border: '0.5px solid #2D1B55',
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: `1.5px solid ${focusTask.completed ? '#34d399' : accentColor}`,
                    background: focusTask.completed ? '#34d399' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {completingId === focusTask.id && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        border: `1.5px solid ${accentColor}`,
                        borderTopColor: 'transparent',
                        animation: 'spin 0.6s linear infinite',
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: focusTask.completed ? '#5A4A7A' : '#C0B0E0',
                    textDecoration: focusTask.completed ? 'line-through' : 'none',
                    lineHeight: 1.4,
                  }}
                >
                  {focusTask.title}
                </span>
              </div>
            )}
          </LeftBorderCard>
        ) : (
          <LeftBorderCard accentColor={accentColor}>
            <span style={{ fontSize: 13, color: '#3D3358', display: 'block', marginBottom: 8 }}>
              No active quest yet
            </span>
            <Link
              href="/quests"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#1E0D40',
                border: '0.5px solid #3D2070',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 11,
                color: '#7A5FA0',
                textDecoration: 'none',
              }}
            >
              + Add quest
            </Link>
          </LeftBorderCard>
        )}

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

        {/* Completed milestones */}
        {completedMilestones.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <span
              style={{
                fontSize: 10,
                color: '#3D3358',
                display: 'block',
                marginBottom: 6,
                paddingLeft: 2,
              }}
            >
              Completed milestones
            </span>
            {completedMilestones.map((m) => (
              <div
                key={m.id}
                style={{
                  background: '#140C28',
                  borderRadius: 12,
                  border: '0.5px solid #1E1040',
                  padding: '10px 12px 10px 15px',
                  marginBottom: 6,
                  position: 'relative',
                  overflow: 'hidden',
                  opacity: 0.6,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: '#2D1B55',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="4" stroke="#34d399" strokeWidth="1.2" />
                    <path
                      d="M3 5L4.5 6.5L7 3.5"
                      stroke="#34d399"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span style={{ fontSize: 10, color: '#7A5FA0' }}>{m.title}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Additional today's quests */}
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
              <span style={{ fontSize: 11, color: '#5A4A7A' }}>Today&apos;s quests</span>
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
                  placeholder="What's the quest?"
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
                    Add quest
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
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleTaskToggle(task.id, task.xp_reward)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      void handleTaskToggle(task.id, task.xp_reward)
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#1A0D35',
                    borderRadius: 8,
                    padding: '7px 10px',
                    marginBottom: 6,
                    cursor: task.completed ? 'default' : 'pointer',
                    border: '0.5px solid #2D1B55',
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      flexShrink: 0,
                      border: `1.5px solid ${task.completed ? '#34d399' : accentColor}`,
                      background: task.completed ? '#34d399' : 'transparent',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      color: task.completed ? '#5A4A7A' : '#C0B0E0',
                      textDecoration: task.completed ? 'line-through' : 'none',
                      flex: 1,
                    }}
                  >
                    {task.title}
                  </span>
                  {!task.completed && (
                    <span style={{ fontSize: 9, color: '#3D3358' }}>+{task.xp_reward} XP</span>
                  )}
                </div>
              ))}
          </LeftBorderCard>
        )}
      </div>

      <XpToastOverlay xpToast={xpToast} levelUpToast={levelUpToast} />
    </main>
  )
}
