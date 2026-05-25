'use client'

import { useEffect, useState, useCallback } from 'react'
import { getUserId } from '@/lib/user'

type TabView = 'today' | 'upcoming' | 'someday'

interface Task {
  id: string
  title: string
  dimension: string
  task_date: string | null
  completed: boolean
  xp_reward: number
}

const DIMENSION_ORDER = ['career', 'social', 'wealth'] as const

const DIMENSION_META = {
  career: { label: 'Forge · Career', color: '#EF9F27', dot: '#EF9F27' },
  social: { label: 'Echo · Social', color: '#F0997B', dot: '#F0997B' },
  wealth: { label: 'Vault · Finances', color: '#1D9E75', dot: '#1D9E75' },
} as const

function getDaysFromNow(date: string): number {
  const d = new Date(date + 'T12:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
  const days = getDaysFromNow(dateStr)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 1 && days <= 7) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
  }
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export default function TasksPage() {
  const userId = getUserId()
  const [tab, setTab] = useState<TabView>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [completingId, setCompletingId] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    if (tab === 'today') {
      const res = await fetch(
        `/api/quests/tasks?userId=${encodeURIComponent(userId)}&date=${today}`
      )
      const data = await res.json()
      setTasks(data.tasks ?? [])
    } else if (tab === 'upcoming') {
      const upcoming: Task[] = []
      for (let i = 1; i <= 14; i++) {
        const d = new Date()
        d.setDate(d.getDate() + i)
        const ds = d.toISOString().split('T')[0]
        const res = await fetch(
          `/api/quests/tasks?userId=${encodeURIComponent(userId)}&date=${ds}`
        )
        const data = await res.json()
        upcoming.push(...(data.tasks ?? []))
      }
      setTasks(upcoming)
    } else {
      const res = await fetch(
        `/api/quests/tasks?userId=${encodeURIComponent(userId)}&someday=true`
      )
      const data = await res.json()
      setTasks(data.tasks ?? [])
    }
    setLoading(false)
  }, [userId, tab])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  async function handleComplete(taskId: string) {
    setCompletingId(taskId)
    await fetch(`/api/quests/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed: true } : t)))
    setCompletingId(null)
  }

  const byDimension = DIMENSION_ORDER.reduce<Record<string, Task[]>>((acc, dim) => {
    acc[dim] = tasks.filter((t) => t.dimension === dim)
    return acc
  }, {})

  const byDate =
    tab === 'upcoming'
      ? Array.from(new Set(tasks.map((t) => t.task_date).filter(Boolean) as string[])).sort()
      : []

  const hasTodayTasks = DIMENSION_ORDER.some((dim) => (byDimension[dim] ?? []).length > 0)

  return (
    <main
      className="dashboard-scroll"
      style={{
        background: '#0D0820',
        minHeight: '100dvh',
        paddingBottom: 100,
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '0 16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 4px 16px',
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 500, color: '#E8E0F0' }}>Tasks</span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('protagonist:open-oracle'))}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#200A45',
                border: '1.5px solid #9333EA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 2v10M2 7h10"
                  stroke="#9333EA"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: 16,
            background: '#140C28',
            borderRadius: 12,
            padding: 4,
            border: '0.5px solid #2D1B55',
          }}
        >
          {(['today', 'upcoming', 'someday'] as TabView[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px 4px',
                borderRadius: 9,
                border: 'none',
                background: tab === t ? '#2D1B55' : 'transparent',
                color: tab === t ? '#E8E0F0' : '#5A4A7A',
                fontSize: 12,
                fontWeight: tab === t ? 500 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#3D3358', fontSize: 13 }}>
            Loading...
          </div>
        ) : tab === 'upcoming' ? (
          byDate.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            byDate.map((date) => {
              const dateTasks = tasks.filter((t) => t.task_date === date)
              return (
                <div key={date} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: '#5A4A7A',
                      fontWeight: 500,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    {formatDate(date)}
                  </div>
                  {dateTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onComplete={handleComplete}
                      completingId={completingId}
                    />
                  ))}
                </div>
              )
            })
          )
        ) : tab === 'today' && !hasTodayTasks ? (
          <EmptyState tab={tab} />
        ) : (
          DIMENSION_ORDER.map((dim) => {
            const dimTasks = byDimension[dim] ?? []
            const meta = DIMENSION_META[dim]
            return (
              <div key={dim} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <svg width="8" height="8" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" fill={meta.dot} opacity={0.8} />
                  </svg>
                  <span
                    style={{
                      fontSize: 10,
                      color: '#3D3358',
                      fontWeight: 500,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                {dimTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    completingId={completingId}
                  />
                ))}
                <AddTaskRow dimension={dim} color={meta.color} />
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}

function TaskRow({
  task,
  onComplete,
  completingId,
}: {
  task: Task
  onComplete: (id: string) => void
  completingId: string | null
}) {
  const color =
    DIMENSION_META[task.dimension as keyof typeof DIMENSION_META]?.color ?? '#9333EA'
  const isCompleting = completingId === task.id

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#140C28',
        borderRadius: 12,
        border: '0.5px solid #2D1B55',
        padding: '10px 12px 10px 14px',
        marginBottom: 6,
        position: 'relative',
        overflow: 'hidden',
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
      <button
        type="button"
        onClick={() => !task.completed && onComplete(task.id)}
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `1.5px solid ${task.completed ? '#34d399' : color}`,
          background: task.completed ? '#34d399' : 'transparent',
          flexShrink: 0,
          cursor: task.completed ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={task.completed ? 'Completed' : 'Mark complete'}
      >
        {isCompleting && (
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
        {task.completed && !isCompleting && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2.5 5l2 2 3-3.5"
              stroke="white"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: task.completed ? '#3D3358' : '#C0B0E0',
          textDecoration: task.completed ? 'line-through' : 'none',
          lineHeight: 1.4,
        }}
      >
        {task.title}
      </span>
      {task.task_date && (
        <span style={{ fontSize: 10, color: '#5A4A7A', flexShrink: 0 }}>
          {formatDate(task.task_date)}
        </span>
      )}
    </div>
  )
}

function AddTaskRow({ dimension, color }: { dimension: string; color: string }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent('protagonist:open-oracle', {
            detail: { prefill: `add task for ${dimension} — ` },
          })
        )
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          window.dispatchEvent(
            new CustomEvent('protagonist:open-oracle', {
              detail: { prefill: `add task for ${dimension} — ` },
            })
          )
        }
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px', cursor: 'pointer' }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `1.5px dashed ${color}`,
          opacity: 0.4,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, color: '#3D3358' }}>+ Add task</span>
    </div>
  )
}

function EmptyState({ tab }: { tab: TabView }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#3D3358', fontSize: 13 }}>
      {tab === 'today'
        ? 'No tasks for today yet.'
        : tab === 'upcoming'
          ? 'Nothing scheduled yet.'
          : 'No someday tasks yet.'}
    </div>
  )
}
