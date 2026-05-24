'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import ForgeCharacter from '@/components/characters/ForgeCharacter'
import EchoCharacter from '@/components/characters/EchoCharacter'
import VaultCharacter from '@/components/characters/VaultCharacter'
import { getLevel, getLevelProgress, getXpToNextLevel, getTier } from '@/lib/xp'
import { CHARACTERS, type Dimension } from '@/lib/character'
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

const CHARACTER_COMPONENTS = {
  career: ForgeCharacter,
  social: EchoCharacter,
  wealth: VaultCharacter,
} as const

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface CharacterPageProps {
  dimension: Dimension
}

export function CharacterPage({ dimension }: CharacterPageProps) {
  const char = CHARACTERS[dimension]
  const CharSVG = CHARACTER_COMPONENTS[dimension]
  const [quest, setQuest] = useState<QuestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskXp, setNewTaskXp] = useState(50)
  const [completingId, setCompletingId] = useState<string | null>(null)

  useEffect(() => {
    const uid = getUserId()
    fetch(`/api/quests/character/${dimension}?userId=${encodeURIComponent(uid)}`)
      .then((r) => r.json())
      .then((data) => {
        setQuest(data.quest ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [dimension])

  async function completeTask(taskId: string, xpReward: number) {
    setCompletingId(taskId)
    const uid = getUserId()
    try {
      const res = await fetch(`/api/quests/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      })
      if (res.ok) {
        setQuest((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            xp: prev.xp + xpReward,
            recent_tasks: prev.recent_tasks.map((t) =>
              t.id === taskId ? { ...t, completed: true } : t
            ),
          }
        })
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

  if (loading) {
    return (
      <main
        style={{
          background: '#0D0820',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 100,
        }}
      >
        <span style={{ color: '#3D3358', fontSize: 13 }}>Loading...</span>
      </main>
    )
  }

  if (!quest) {
    return (
      <main style={{ background: '#0D0820', minHeight: '100vh', padding: '80px 16px 100px' }}>
        <div style={{ textAlign: 'center', color: '#3D3358' }}>
          <p>No quest for {char.name} yet.</p>
          <Link href="/quests" style={{ color: char.color, fontSize: 13 }}>
            Set up your quest →
          </Link>
        </div>
      </main>
    )
  }

  const level = getLevel(quest.xp)
  const tier = getTier(quest.xp)
  const progress = getLevelProgress(quest.xp)
  const progressPct = Math.round(progress * 100)
  const xpToNext = getXpToNextLevel(quest.xp)
  const tierLabel = char.tierLabels[tier - 1]
  const activeMilestone = quest.milestones.find((m) => !m.completed)
  const todayStr = new Date().toISOString().split('T')[0]
  const todayTasks = quest.recent_tasks.filter((t) => t.task_date === todayStr)
  const pastTasks = quest.recent_tasks.filter((t) => t.task_date < todayStr).slice(0, 10)

  return (
    <main
      style={{
        background: '#0D0820',
        minHeight: '100vh',
        paddingBottom: 100,
        fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '0 16px' }}>
        <div
          style={{
            background: '#140C28',
            borderBottom: `2px solid ${char.color}22`,
            padding: '32px 20px 24px',
            margin: '0 -16px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <CharSVG tier={tier} size={100} delay={0} />

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                justifyContent: 'center',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 24, fontWeight: 500, color: '#E8E0F0' }}>
                {char.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: char.color,
                  background: char.badgeBg,
                  border: `0.5px solid ${char.badgeBorder}`,
                  padding: '3px 10px',
                  borderRadius: 4,
                }}
              >
                Lv.{level}
              </span>
            </div>
            <span style={{ fontSize: 13, color: char.color, opacity: 0.8 }}>{tierLabel}</span>
          </div>

          <div style={{ width: '100%', maxWidth: 260 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#5A5070' }}>{quest.xp % 500} / 500 XP</span>
              <span style={{ fontSize: 11, color: '#5A5070' }}>
                {xpToNext} XP to Lv.{level + 1}
              </span>
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.07)',
                height: 6,
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                style={{ height: '100%', background: char.color, borderRadius: 3 }}
              />
            </div>
          </div>

          <p
            style={{
              fontSize: 13,
              color: '#9B8FB0',
              fontStyle: 'italic',
              textAlign: 'center',
              margin: 0,
              lineHeight: 1.5,
              maxWidth: 280,
            }}
          >
            &ldquo;{quest.vision}&rdquo;
          </p>

          {tier < 3 && (
            <span style={{ fontSize: 10, color: '#3D3358' }}>
              {tier === 1
                ? `Reach Lv.4 to unlock ${char.tierLabels[1]}`
                : `Reach Lv.8 to unlock ${char.tierLabels[2]}`}
            </span>
          )}
        </div>

        {activeMilestone && (
          <div
            style={{
              background: '#140C28',
              border: `0.5px solid ${char.color}44`,
              borderRadius: 14,
              padding: '12px 14px',
              marginBottom: 12,
            }}
          >
            <p
              style={{
                fontSize: 10,
                color: char.color,
                margin: '0 0 6px',
                letterSpacing: '0.06em',
                opacity: 0.7,
              }}
            >
              CURRENT CHAPTER
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: '#E8E0F0' }}>
                {activeMilestone.title}
              </span>
              {activeMilestone.target_date && (
                <span
                  style={{
                    fontSize: 11,
                    color: '#5A5070',
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  {daysUntil(activeMilestone.target_date)}d left
                </span>
              )}
            </div>
            <span style={{ fontSize: 11, color: '#4A4060' }}>
              {formatDate(activeMilestone.target_date)}
            </span>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.06em',
                color: '#3D3358',
              }}
            >
              Today&apos;s quests
            </span>
            <button
              type="button"
              onClick={() => setAddingTask(!addingTask)}
              style={{
                background: `${char.color}22`,
                border: `0.5px solid ${char.color}44`,
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 11,
                color: char.color,
                cursor: 'pointer',
              }}
            >
              + Add
            </button>
          </div>

          {addingTask && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{
                background: '#140C28',
                border: '0.5px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addTask()}
                placeholder="What's the quest?"
                autoFocus
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  color: '#E8E0F0',
                  fontSize: 13,
                  outline: 'none',
                  marginBottom: 8,
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {[25, 50, 100, 200].map((xp) => (
                  <button
                    key={xp}
                    type="button"
                    onClick={() => setNewTaskXp(xp)}
                    style={{
                      flex: 1,
                      background: newTaskXp === xp ? char.color : 'rgba(255,255,255,0.05)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 0',
                      fontSize: 11,
                      color: newTaskXp === xp ? '#0D0820' : '#5A5070',
                      cursor: 'pointer',
                      fontWeight: newTaskXp === xp ? 500 : 400,
                    }}
                  >
                    {xp} XP
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void addTask()}
                  style={{
                    flex: 1,
                    background: char.color,
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 0',
                    fontSize: 13,
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
                    background: 'rgba(255,255,255,0.05)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13,
                    color: '#5A5070',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          {todayTasks.length === 0 && !addingTask && (
            <div
              style={{
                background: '#140C28',
                borderRadius: 12,
                border: '0.5px solid rgba(255,255,255,0.05)',
                padding: '14px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 13, color: '#3D3358', fontStyle: 'italic' }}>
                No quests today yet
              </span>
            </div>
          )}

          {todayTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              accentColor={char.color}
              onComplete={() => void completeTask(task.id, task.xp_reward)}
              isCompleting={completingId === task.id}
            />
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.06em',
              color: '#3D3358',
              display: 'block',
              marginBottom: 8,
            }}
          >
            Chapters
          </span>
          {quest.milestones.map((ms) => (
            <div
              key={ms.id}
              style={{
                background: '#140C28',
                border: `0.5px solid ${ms.completed ? `${char.color}44` : 'rgba(255,255,255,0.05)'}`,
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                opacity: ms.completed ? 0.6 : 1,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: `1.5px solid ${ms.completed ? char.color : '#3D3358'}`,
                  background: ms.completed ? char.color : 'transparent',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {ms.completed && (
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path
                      d="M2 5 L4 7.5 L8 2.5"
                      stroke="#0D0820"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    color: ms.completed ? '#4A4060' : '#E8E0F0',
                    display: 'block',
                  }}
                >
                  {ms.title}
                </span>
                <span style={{ fontSize: 11, color: '#3D3358' }}>
                  {ms.completed ? 'Completed' : formatDate(ms.target_date)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {pastTasks.length > 0 && (
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.06em',
                color: '#3D3358',
                display: 'block',
                marginBottom: 8,
              }}
            >
              Quest log
            </span>
            {pastTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                  opacity: 0.5,
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: task.completed ? char.color : 'rgba(255,255,255,0.1)',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: '#5A5070',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {task.title}
                </span>
                <span style={{ fontSize: 10, color: '#3D3358', flexShrink: 0 }}>
                  +{task.xp_reward} XP
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function TaskRow({
  task,
  accentColor,
  onComplete,
  isCompleting,
}: {
  task: Task
  accentColor: string
  onComplete: () => void
  isCompleting: boolean
}) {
  return (
    <motion.div
      layout
      style={{
        background: '#140C28',
        border: '0.5px solid rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: '10px 12px',
        marginBottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={() => !task.completed && onComplete()}
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: `1.5px solid ${accentColor}`,
          background: task.completed ? accentColor : 'transparent',
          cursor: task.completed ? 'default' : 'pointer',
          flexShrink: 0,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {task.completed && !isCompleting && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M2 5 L4 7.5 L8 2.5"
              stroke="#0D0820"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        )}
        {isCompleting && (
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
      </button>

      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: task.completed ? '#3D3358' : '#C8C0D8',
          textDecoration: task.completed ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.title}
      </span>

      {!task.completed && (
        <span style={{ fontSize: 11, color: '#3D3358', flexShrink: 0 }}>
          +{task.xp_reward} XP
        </span>
      )}
    </motion.div>
  )
}
