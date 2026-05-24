'use client'

import { useEffect, useState, useRef } from 'react'
import { getUserId } from '@/lib/user'
import {
  getLevel,
  getLevelProgress,
  getXpToNextLevel,
  getTier,
  getTierLabel,
} from '@/lib/xp'

interface MainQuest {
  id: string
  dimension: string
  character_name: string
  character_class: string
  vision: string
  active_milestone: Milestone | null
  todays_tasks: Task[]
  xp: number
}

interface Milestone {
  id: string
  title: string
  target_date: string | null
  completed: boolean
}

interface Task {
  id: string
  dimension: string
  title: string
  xp_reward: number
  task_date: string
  completed: boolean
}

interface XPToast {
  id: string
  xp: number
  leveledUp: boolean
  newLevel: number
  dimension: string
}

const DIM_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  career: { accent: '#fbbf24', bg: 'rgba(232,148,26,0.09)', border: 'rgba(232,148,26,0.28)' },
  social: { accent: '#6ee7a4', bg: 'rgba(46,204,113,0.09)', border: 'rgba(46,204,113,0.28)' },
  wealth: { accent: '#FFB347', bg: 'rgba(255,179,71,0.09)', border: 'rgba(255,179,71,0.30)' },
}

export default function QuestsPage() {
  const [quests, setQuests] = useState<MainQuest[]>([])
  const [loading, setLoading] = useState(true)
  const [xpToast, setXpToast] = useState<XPToast | null>(null)
  const [addingTask, setAddingTask] = useState<{ dimension: string } | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskXp, setNewTaskXp] = useState(50)
  const [savingTask, setSavingTask] = useState(false)
  const userId = useRef(getUserId())

  useEffect(() => {
    void loadQuests()
  }, [])

  async function loadQuests() {
    const uid = userId.current
    setLoading(true)
    try {
      const res = await fetch(`/api/quests/main?userId=${encodeURIComponent(uid)}`)
      const data = await res.json()
      if (data.quests) setQuests(data.quests)
    } finally {
      setLoading(false)
    }
  }

  async function completeTask(taskId: string, dimension: string) {
    const uid = userId.current
    const res = await fetch(`/api/quests/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid }),
    })
    const data = await res.json()

    if (res.ok) {
      setQuests((prev) =>
        prev.map((q) => ({
          ...q,
          xp: q.dimension === dimension ? q.xp + data.xp_earned : q.xp,
          todays_tasks: q.todays_tasks.map((t) =>
            t.id === taskId ? { ...t, completed: true } : t
          ),
        }))
      )

      setXpToast({
        id: taskId,
        xp: data.xp_earned,
        leveledUp: data.leveled_up,
        newLevel: data.new_level,
        dimension,
      })
      setTimeout(() => setXpToast(null), 3000)
    }
  }

  async function addTask(dimension: string) {
    if (!newTaskTitle.trim()) return
    setSavingTask(true)
    const uid = userId.current

    const quest = quests.find((q) => q.dimension === dimension)
    const milestoneId = quest?.active_milestone?.id ?? null

    const res = await fetch('/api/quests/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: uid,
        dimension,
        title: newTaskTitle.trim(),
        xpReward: newTaskXp,
        milestoneId,
      }),
    })
    const data = await res.json()

    if (res.ok && data.task) {
      setQuests((prev) =>
        prev.map((q) =>
          q.dimension === dimension
            ? { ...q, todays_tasks: [...q.todays_tasks, data.task] }
            : q
        )
      )
    }

    setNewTaskTitle('')
    setNewTaskXp(50)
    setAddingTask(null)
    setSavingTask(false)
  }

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  function daysLabel(date: string | null) {
    if (!date) return null
    const diff = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return 'overdue'
    if (diff === 0) return 'due today'
    return `${diff} days left`
  }

  return (
    <div className="min-h-screen pb-28 overflow-x-hidden" style={{ background: '#0D0820' }}>
      <div className="px-4 pt-10 pb-4">
        <p className="text-[10px] text-white/[0.28] mb-[2px] tracking-[0.14em] uppercase">
          {today}
        </p>
        <h1 className="text-[26px] font-bold text-white m-0">Quests</h1>
      </div>

      {xpToast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-center"
          style={{
            background: DIM_COLORS[xpToast.dimension]?.bg ?? 'rgba(255,255,255,0.1)',
            border: `1px solid ${DIM_COLORS[xpToast.dimension]?.border ?? 'rgba(255,255,255,0.2)'}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <p className="text-xl font-black text-white m-0">+{xpToast.xp} XP</p>
          {xpToast.leveledUp && (
            <p
              className="text-xs font-bold mt-1"
              style={{ color: DIM_COLORS[xpToast.dimension]?.accent }}
            >
              LEVEL UP → Lv.{xpToast.newLevel}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="mx-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl h-48 animate-pulse"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            />
          ))}
        </div>
      ) : (
        <div className="px-4 space-y-4">
          {quests.map((quest) => {
            const col = DIM_COLORS[quest.dimension] ?? DIM_COLORS.career
            const level = getLevel(quest.xp)
            const progress = getLevelProgress(quest.xp)
            const toNext = getXpToNextLevel(quest.xp)
            const tier = getTier(quest.xp)
            const tierLabel = getTierLabel(quest.dimension, tier)
            const milestone = quest.active_milestone
            const completedToday = quest.todays_tasks.filter((t) => t.completed).length
            const totalToday = quest.todays_tasks.length

            return (
              <div
                key={quest.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: col.bg, border: `1px solid ${col.border}` }}
              >
                <div className="h-[3px]" style={{ background: col.accent }} />

                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base font-bold text-white">
                          {quest.character_name}
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: col.accent, background: `${col.accent}20` }}
                        >
                          Lv.{level}
                        </span>
                        <span className="text-[9px] text-white/30">{quest.character_class}</span>
                      </div>
                      <p className="text-[11px] text-white/50 m-0 italic leading-snug">
                        &ldquo;{quest.vision}&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-semibold" style={{ color: col.accent }}>
                        {tierLabel}
                      </span>
                      <span className="text-[9px] text-white/30">
                        {toNext} XP to Lv.{level + 1}
                      </span>
                    </div>
                    <div
                      className="h-[3px] rounded-full"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        className="h-[3px] rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.round(progress * 100)}%`,
                          background: col.accent,
                        }}
                      />
                    </div>
                  </div>

                  {milestone ? (
                    <div
                      className="rounded-xl px-3 py-2.5 mb-3"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: col.accent }}
                          />
                          <span className="text-[11px] font-semibold text-white/80">
                            {milestone.title}
                          </span>
                        </div>
                        {milestone.target_date && (
                          <span className="text-[9px] text-white/30">
                            {daysLabel(milestone.target_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="rounded-xl px-3 py-2.5 mb-3"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px dashed rgba(255,255,255,0.1)',
                      }}
                    >
                      <p className="text-[11px] text-white/30 m-0 text-center">
                        No active milestone — tap + to add one
                      </p>
                    </div>
                  )}

                  {quest.todays_tasks.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] mb-1">
                        Today&apos;s quests — {completedToday}/{totalToday} done
                      </p>
                      {quest.todays_tasks.map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${task.completed ? 'opacity-40' : ''}`}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.07)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => !task.completed && void completeTask(task.id, quest.dimension)}
                            disabled={task.completed}
                            className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                            style={{
                              borderColor: task.completed ? col.accent : 'rgba(255,255,255,0.25)',
                              background: task.completed ? col.accent : 'transparent',
                            }}
                            aria-label={task.completed ? 'Completed' : 'Mark complete'}
                          >
                            {task.completed && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path
                                  d="M1 4L4 7L9 1"
                                  stroke="#0D0820"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                          <span
                            className={`flex-1 text-[12px] ${task.completed ? 'line-through text-white/30' : 'text-white/80'}`}
                          >
                            {task.title}
                          </span>
                          <span
                            className="text-[10px] font-bold flex-shrink-0"
                            style={{
                              color: task.completed ? 'rgba(255,255,255,0.2)' : col.accent,
                            }}
                          >
                            +{task.xp_reward} XP
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingTask?.dimension === quest.dimension ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="What's the quest?"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void addTask(quest.dimension)}
                        autoFocus
                        className="w-full rounded-xl px-3 py-2.5 text-sm text-white bg-white/5 border border-white/10 outline-none focus:border-white/20 placeholder-white/20"
                        style={{ fontFamily: 'inherit' }}
                      />
                      <div className="flex gap-2">
                        <select
                          value={newTaskXp}
                          onChange={(e) => setNewTaskXp(Number(e.target.value))}
                          className="flex-1 rounded-xl px-3 py-2 text-xs bg-white/5 border border-white/10 text-white/60 outline-none"
                          style={{ fontFamily: 'inherit' }}
                        >
                          <option value={25}>+25 XP — quick task</option>
                          <option value={50}>+50 XP — daily quest</option>
                          <option value={100}>+100 XP — hard challenge</option>
                          <option value={200}>+200 XP — epic quest</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void addTask(quest.dimension)}
                          disabled={savingTask || !newTaskTitle.trim()}
                          className="px-4 py-2 rounded-xl text-xs font-bold transition-opacity disabled:opacity-40"
                          style={{ background: col.accent, color: '#0D0820' }}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingTask(null)
                            setNewTaskTitle('')
                          }}
                          className="px-3 py-2 rounded-xl text-xs text-white/40 bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingTask({ dimension: quest.dimension })}
                      className="w-full rounded-xl py-2 text-[11px] text-center transition-all"
                      style={{ color: col.accent, border: `1px dashed ${col.border}` }}
                    >
                      + Add today&apos;s quest
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {quests.length === 0 && !loading && (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">⚔️</p>
              <p className="text-white/40 text-sm">
                No quests yet. Run <code className="text-white/50">quest-system-seed.sql</code>{' '}
                in Supabase to get started.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
