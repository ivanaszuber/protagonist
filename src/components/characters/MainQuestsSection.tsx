'use client'

import { useState, useCallback } from 'react'

export interface MainQuestMilestone {
  id: string
  title: string
  target_date: string | null
  completed: boolean
  sort_order: number
  progress_percent: number
  task_total: number
  is_focused: boolean
}

interface MilestoneTask {
  id: string
  title: string
  task_date: string | null
  completed: boolean
  xp_reward: number
  milestone_id: string | null
}

interface MainQuestsSectionProps {
  characterName: string
  dimensionLabel: string
  milestones: MainQuestMilestone[]
  accentColor: string
  questId?: string
  userId?: string
  dimension?: string
  onAdd?: (m: MainQuestMilestone) => void
  onDelete?: (milestoneId: string) => void
  onUpdate?: (milestoneId: string, changes: Partial<MainQuestMilestone>) => void
  onFocus?: (milestoneId: string | null) => void
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const today = new Date()
  const diffDays = Math.ceil((d.getTime() - today.setHours(0,0,0,0)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 0) return `${Math.abs(diffDays)}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Chevron SVG ───────────────────────────────────────────────────────────────

function Chevron({ open, color = '#3D2878' }: { open: boolean; color?: string }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <polyline points="3,5 7,9 11,5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  accentColor,
  userId,
  onToggle,
}: {
  task: MilestoneTask
  accentColor: string
  userId?: string
  onToggle: (taskId: string, completed: boolean) => void
}) {
  const [toggling, setToggling] = useState(false)
  const dueDate = task.task_date ? fmtDate(task.task_date) : null
  const isOverdue = task.task_date && !task.completed && daysUntil(task.task_date) < 0

  async function handleToggle() {
    if (toggling || !userId) return
    setToggling(true)
    try {
      if (!task.completed) {
        await fetch(`/api/quests/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
      } else {
        await fetch(`/api/quests/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, completed: false }),
        })
      }
      onToggle(task.id, !task.completed)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 14px',
      opacity: toggling ? 0.5 : 1,
      transition: 'opacity 0.15s',
    }}>
      {/* Checkbox */}
      <button
        type="button"
        onClick={() => void handleToggle()}
        style={{
          width: 17, height: 17, borderRadius: 4, flexShrink: 0,
          border: task.completed ? 'none' : `1.5px solid rgba(255,255,255,0.2)`,
          background: task.completed ? '#6EE7A4' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0,
        }}
      >
        {task.completed && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <polyline points="2,5 4,7.5 8,3" stroke="#0D0820" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Title */}
      <span style={{
        flex: 1, fontSize: 12,
        color: task.completed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.72)',
        textDecoration: task.completed ? 'line-through' : 'none',
        lineHeight: 1.4,
      }}>
        {task.title}
      </span>

      {/* Due date */}
      {dueDate && (
        <span style={{
          fontSize: 10, flexShrink: 0,
          color: isOverdue ? '#FF7A65' : 'rgba(255,255,255,0.28)',
          fontWeight: isOverdue ? 600 : 400,
        }}>
          {dueDate}
        </span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function MainQuestsSection({
  milestones,
  accentColor,
  questId,
  userId,
  dimension,
  onAdd,
  onDelete,
  onUpdate,
  onFocus,
}: MainQuestsSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Which milestone has its TASK LIST open
  const [taskExpandedId, setTaskExpandedId] = useState<string | null>(null)
  // Which milestone has its ACTION STRIP open (edit/focus/delete)
  const [actionExpandedId, setActionExpandedId] = useState<string | null>(null)
  // Which milestone is in edit mode
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Tasks per milestone: milestoneId → MilestoneTask[]
  const [tasksById, setTasksById] = useState<Record<string, MilestoneTask[]>>({})
  const [loadingTasks, setLoadingTasks] = useState<Record<string, boolean>>({})

  // Inline add-task state per milestone
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDate, setNewTaskDate] = useState('')
  const [addingTask, setAddingTask] = useState(false)

  const incomplete = milestones.filter((m) => !m.completed)

  // ── Milestone CRUD ─────────────────────────────────────────────────────────

  function closeForm() { setShowForm(false); setFormTitle(''); setFormDate('') }

  async function handleSave() {
    const title = formTitle.trim()
    if (!title || !questId || !userId || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/quests/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, questId, title, targetDate: formDate || null }),
      })
      const data = (await res.json()) as { milestone?: MainQuestMilestone }
      if (res.ok && data.milestone) {
        onAdd?.({ ...data.milestone, progress_percent: 0, task_total: 0, is_focused: false })
        closeForm()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleFocus(milestoneId: string, currentlyFocused: boolean) {
    if (!userId) return
    const newFocus = !currentlyFocused
    const res = await fetch('/api/quests/milestones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneId, userId, is_focused: newFocus }),
    })
    if (res.ok) {
      newFocus ? onFocus?.(milestoneId) : onFocus?.(null)
      setActionExpandedId(null)
    }
  }

  function openEdit(m: MainQuestMilestone) {
    setEditId(m.id)
    setEditTitle(m.title)
    setEditDate(m.target_date ?? '')
    setActionExpandedId(null)
  }

  function cancelEdit() { setEditId(null); setEditTitle(''); setEditDate('') }

  async function handleEditSave(milestoneId: string) {
    const title = editTitle.trim()
    if (!title || !userId || editSaving) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/quests/milestones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId, userId, title, targetDate: editDate || null }),
      })
      if (res.ok) { onUpdate?.(milestoneId, { title, target_date: editDate || null }); cancelEdit() }
    } finally {
      setEditSaving(false)
    }
  }

  // ── Task loading + interaction ─────────────────────────────────────────────

  const loadTasks = useCallback(async (milestoneId: string) => {
    if (!userId || tasksById[milestoneId] !== undefined) return
    setLoadingTasks(prev => ({ ...prev, [milestoneId]: true }))
    try {
      const res = await fetch(`/api/quests/tasks?userId=${encodeURIComponent(userId)}&milestoneId=${encodeURIComponent(milestoneId)}`)
      const data = (await res.json()) as { tasks?: MilestoneTask[] }
      setTasksById(prev => ({ ...prev, [milestoneId]: data.tasks ?? [] }))
    } catch {
      setTasksById(prev => ({ ...prev, [milestoneId]: [] }))
    } finally {
      setLoadingTasks(prev => ({ ...prev, [milestoneId]: false }))
    }
  }, [userId, tasksById])

  function toggleTaskExpand(milestoneId: string) {
    if (taskExpandedId === milestoneId) {
      setTaskExpandedId(null)
    } else {
      setTaskExpandedId(milestoneId)
      void loadTasks(milestoneId)
    }
    // Close action strip when toggling tasks
    setActionExpandedId(null)
  }

  function handleTaskToggle(milestoneId: string, taskId: string, completed: boolean) {
    setTasksById(prev => ({
      ...prev,
      [milestoneId]: (prev[milestoneId] ?? []).map(t => t.id === taskId ? { ...t, completed } : t),
    }))
  }

  async function handleAddTask(milestoneId: string) {
    const title = newTaskTitle.trim()
    if (!title || !userId || addingTask) return
    setAddingTask(true)
    const today = new Date().toISOString().split('T')[0]
    const taskDate = newTaskDate || today
    try {
      const res = await fetch('/api/quests/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, dimension: dimension ?? 'career', title, milestoneId, taskDate }),
      })
      const data = (await res.json()) as { task?: MilestoneTask }
      if (res.ok && data.task) {
        setTasksById(prev => ({
          ...prev,
          [milestoneId]: [...(prev[milestoneId] ?? []), data.task!],
        }))
        setNewTaskTitle('')
        setNewTaskDate('')
        setAddingTaskFor(null)
      }
    } finally {
      setAddingTask(false)
    }
  }

  // ── Shared input style ─────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0D0820', border: '0.5px solid #2D1B55',
    borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#E8E0F0',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  const focusedExists = incomplete.some((m) => m.is_focused)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section style={{ marginBottom: 20 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#9B8EC4', letterSpacing: '0.06em' }}>
          Milestones
          {focusedExists && (
            <span style={{
              marginLeft: 8, fontSize: 9, color: '#fbbf24',
              background: 'rgba(251,191,36,0.1)', border: '0.5px solid rgba(251,191,36,0.3)',
              borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em',
            }}>1 focused</span>
          )}
        </span>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} style={{
            background: 'transparent', border: 'none', fontSize: 11,
            color: accentColor, cursor: 'pointer', padding: 0,
          }}>+ Add</button>
        )}
      </div>

      {/* Add milestone form */}
      {showForm && (
        <div style={{
          background: '#140C28', borderRadius: 12,
          border: `0.5px solid ${accentColor}55`, padding: '12px 14px', marginBottom: 10,
        }}>
          <input
            autoFocus type="text" placeholder="e.g. Build £50k portfolio by Aug 2026"
            value={formTitle} onChange={e => setFormTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') closeForm() }}
            style={{ ...inputStyle, fontSize: 13, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
              style={{ ...inputStyle, flex: 1, color: formDate ? '#E8E0F0' : '#5A4A7A', colorScheme: 'dark' as const }}
            />
            <button type="button" onClick={() => void handleSave()} disabled={!formTitle.trim() || saving}
              style={{
                background: accentColor, border: 'none', borderRadius: 8, padding: '7px 18px',
                fontSize: 12, fontWeight: 600, color: '#0D0820', cursor: formTitle.trim() && !saving ? 'pointer' : 'default',
                opacity: formTitle.trim() && !saving ? 1 : 0.4, fontFamily: 'inherit', flexShrink: 0,
              }}
            >{saving ? '…' : 'Save'}</button>
            <button type="button" onClick={closeForm}
              style={{ background: 'transparent', border: 'none', fontSize: 18, color: '#3D2878', cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
            >×</button>
          </div>
        </div>
      )}

      {incomplete.length === 0 && !showForm ? (
        <p style={{ fontSize: 11, color: '#3D3358' }}>No milestones yet.</p>
      ) : (
        incomplete.map((m) => {
          const isFocused = m.is_focused
          const isTaskExpanded = taskExpandedId === m.id
          const isActionExpanded = actionExpandedId === m.id
          const isEditing = editId === m.id
          const days = daysUntil(m.target_date)
          const opacity = focusedExists && !isFocused ? 0.45 : 1
          const tasks = tasksById[m.id] ?? []
          const isLoadingTasks = loadingTasks[m.id] ?? false
          const completedCount = tasks.filter(t => t.completed).length

          return (
            <div key={m.id} style={{
              background: '#140C28', borderRadius: 12,
              border: isTaskExpanded
                ? `0.5px solid ${isFocused ? 'rgba(251,191,36,0.5)' : `${accentColor}55`}`
                : isFocused ? '0.5px solid rgba(251,191,36,0.4)' : '0.5px solid #2D1B55',
              marginBottom: 8, opacity,
              position: 'relative', overflow: 'hidden',
              transition: 'opacity 0.2s ease, border-color 0.2s ease',
            }}>
              {/* Left accent bar */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                background: isFocused ? '#fbbf24' : accentColor,
                transition: 'background 0.2s ease',
              }} />

              {/* ── Edit mode ── */}
              {isEditing ? (
                <div style={{ padding: '12px 12px 12px 15px' }}>
                  <input
                    autoFocus type="text" value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleEditSave(m.id); if (e.key === 'Escape') cancelEdit() }}
                    style={{ ...inputStyle, fontSize: 13, marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                      style={{ ...inputStyle, flex: 1, color: editDate ? '#E8E0F0' : '#5A4A7A', colorScheme: 'dark' as const }}
                    />
                    <button type="button" onClick={() => void handleEditSave(m.id)} disabled={!editTitle.trim() || editSaving}
                      style={{
                        background: accentColor, border: 'none', borderRadius: 8, padding: '6px 16px',
                        fontSize: 12, fontWeight: 600, color: '#0D0820',
                        cursor: editTitle.trim() && !editSaving ? 'pointer' : 'default',
                        opacity: editTitle.trim() && !editSaving ? 1 : 0.4, fontFamily: 'inherit', flexShrink: 0,
                      }}
                    >{editSaving ? '…' : 'Save'}</button>
                    <button type="button" onClick={cancelEdit}
                      style={{ background: 'transparent', border: 'none', fontSize: 18, color: '#3D2878', cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                    >×</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Card header (click to expand tasks) ── */}
                  <button
                    type="button"
                    onClick={() => toggleTaskExpand(m.id)}
                    style={{ width: '100%', background: 'transparent', border: 'none', padding: '12px 12px 12px 15px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                        background: isFocused ? '#fbbf24' : accentColor,
                        transition: 'background 0.2s ease',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#E8E0F0' }}>{m.title}</span>
                          {isFocused ? (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 3 }}>⚡ Focused</span>
                          ) : m.task_total > 0 ? (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>In Progress</span>
                          ) : (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(107,94,140,0.2)', color: '#6B5E8C' }}>Planned</span>
                          )}
                        </div>
                        {m.target_date && (
                          <p style={{ fontSize: 10, color: '#7A5FA0', margin: '4px 0 0' }}>
                            {days > 0 ? `${days}d left` : days === 0 ? 'Due today' : `${Math.abs(days)}d overdue`}
                          </p>
                        )}
                        {m.task_total > 0 && (
                          <>
                            <div style={{ marginTop: 8, height: 4, background: '#1E0D40', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${m.progress_percent}%`, background: isFocused ? '#fbbf24' : accentColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
                            </div>
                            <span style={{ fontSize: 9, color: '#5A4A7A', marginTop: 4, display: 'block' }}>
                              {m.progress_percent}% · {Math.round((m.progress_percent / 100) * m.task_total)}/{m.task_total} tasks done
                            </span>
                          </>
                        )}
                      </div>

                      {/* Chevron */}
                      <div style={{ flexShrink: 0, marginTop: 3 }}>
                        <Chevron open={isTaskExpanded} color={isTaskExpanded ? accentColor : '#3D2878'} />
                      </div>
                    </div>
                  </button>

                  {/* ── Task list (expanded) ── */}
                  {isTaskExpanded && (
                    <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>

                      {/* Tasks */}
                      {isLoadingTasks ? (
                        <div style={{ padding: '10px 14px', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Loading tasks…</div>
                      ) : tasks.length === 0 && addingTaskFor !== m.id ? (
                        <div style={{ padding: '10px 14px', fontSize: 11, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>No tasks yet.</div>
                      ) : (
                        <div style={{ paddingTop: 4, paddingBottom: 2 }}>
                          {/* Open tasks first */}
                          {tasks.filter(t => !t.completed).map(task => (
                            <TaskRow key={task.id} task={task} accentColor={accentColor} userId={userId}
                              onToggle={(taskId, completed) => handleTaskToggle(m.id, taskId, completed)} />
                          ))}
                          {/* Divider before completed */}
                          {tasks.some(t => t.completed) && tasks.some(t => !t.completed) && (
                            <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.04)', margin: '4px 14px' }} />
                          )}
                          {/* Completed tasks */}
                          {tasks.filter(t => t.completed).map(task => (
                            <TaskRow key={task.id} task={task} accentColor={accentColor} userId={userId}
                              onToggle={(taskId, completed) => handleTaskToggle(m.id, taskId, completed)} />
                          ))}
                        </div>
                      )}

                      {/* Add task inline form */}
                      {addingTaskFor === m.id ? (
                        <div style={{ padding: '6px 14px 10px' }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
                            <input
                              autoFocus type="text" placeholder="New task title…"
                              value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') void handleAddTask(m.id)
                                if (e.key === 'Escape') { setAddingTaskFor(null); setNewTaskTitle(''); setNewTaskDate('') }
                              }}
                              style={{ ...inputStyle, flex: 1, padding: '5px 9px' }}
                            />
                            <button type="button" onClick={() => { setAddingTaskFor(null); setNewTaskTitle(''); setNewTaskDate('') }}
                              style={{ background: 'transparent', border: 'none', fontSize: 16, color: '#3D2878', cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}
                            >×</button>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="date" value={newTaskDate}
                              onChange={e => setNewTaskDate(e.target.value)}
                              style={{ ...inputStyle, flex: 1, padding: '4px 8px', fontSize: 11, color: newTaskDate ? '#E8E0F0' : '#5A4A7A', colorScheme: 'dark' as const }}
                            />
                            <button type="button" onClick={() => void handleAddTask(m.id)}
                              disabled={!newTaskTitle.trim() || addingTask}
                              style={{
                                background: accentColor, border: 'none', borderRadius: 6, padding: '5px 14px',
                                fontSize: 11, fontWeight: 600, color: '#0D0820',
                                cursor: newTaskTitle.trim() && !addingTask ? 'pointer' : 'default',
                                opacity: newTaskTitle.trim() && !addingTask ? 1 : 0.4, fontFamily: 'inherit', flexShrink: 0,
                              }}
                            >{addingTask ? '…' : 'Add'}</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button"
                          onClick={() => { setAddingTaskFor(m.id); setNewTaskTitle('') }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px 10px', width: '100%',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            fontSize: 11, color: `${accentColor}80`, fontFamily: 'inherit',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add task
                        </button>
                      )}

                      {/* Action strip — edit / focus / delete */}
                      <div style={{
                        display: 'flex', gap: 6, padding: '8px 12px 10px',
                        borderTop: '0.5px solid rgba(255,255,255,0.04)',
                      }}>
                        <button type="button" onClick={() => openEdit(m)}
                          style={{ background: '#1E0D40', border: '0.5px solid #2D1B55', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#9B8EC4', cursor: 'pointer', fontFamily: 'inherit' }}
                        >✏️ Edit</button>

                        <button type="button" onClick={() => void handleFocus(m.id, isFocused)}
                          style={{
                            background: isFocused ? 'rgba(251,191,36,0.12)' : '#1E0D40',
                            border: isFocused ? '0.5px solid rgba(251,191,36,0.4)' : '0.5px solid #2D1B55',
                            borderRadius: 6, padding: '5px 10px', fontSize: 11,
                            color: isFocused ? '#fbbf24' : '#9B8EC4', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >{isFocused ? '✕ Unfocus' : '⚡ Focus'}</button>

                        {onDelete && (
                          <button type="button"
                            onClick={() => { setTaskExpandedId(null); onDelete(m.id) }}
                            style={{ background: 'transparent', border: '0.5px solid #2D1B55', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#4A2878', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}
                          >Delete</button>
                        )}
                      </div>

                      {/* Task count summary */}
                      {tasks.length > 0 && (
                        <div style={{ padding: '0 14px 8px', fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                          {completedCount}/{tasks.length} tasks completed
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Collapsed action strip (when task list is closed) ── */}
                  {!isTaskExpanded && isActionExpanded && (
                    <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px', borderTop: '0.5px solid #1E0D40' }}>
                      <button type="button" onClick={() => openEdit(m)}
                        style={{ background: '#1E0D40', border: '0.5px solid #2D1B55', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#9B8EC4', cursor: 'pointer', fontFamily: 'inherit' }}
                      >✏️ Edit</button>
                      <button type="button" onClick={() => void handleFocus(m.id, isFocused)}
                        style={{
                          background: isFocused ? 'rgba(251,191,36,0.12)' : '#1E0D40',
                          border: isFocused ? '0.5px solid rgba(251,191,36,0.4)' : '0.5px solid #2D1B55',
                          borderRadius: 6, padding: '5px 10px', fontSize: 11,
                          color: isFocused ? '#fbbf24' : '#9B8EC4', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >{isFocused ? '✕ Unfocus' : '⚡ Focus'}</button>
                      {onDelete && (
                        <button type="button"
                          onClick={() => { setActionExpandedId(null); onDelete(m.id) }}
                          style={{ background: 'transparent', border: '0.5px solid #2D1B55', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#4A2878', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}
                        >Delete</button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })
      )}
    </section>
  )
}
