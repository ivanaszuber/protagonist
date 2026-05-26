'use client'

import { useState } from 'react'

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

interface MainQuestsSectionProps {
  characterName: string
  dimensionLabel: string
  milestones: MainQuestMilestone[]
  accentColor: string
  questId?: string
  userId?: string
  onAdd?: (m: MainQuestMilestone) => void
  onDelete?: (milestoneId: string) => void
  onUpdate?: (milestoneId: string, changes: Partial<MainQuestMilestone>) => void
  onFocus?: (milestoneId: string | null) => void
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export function MainQuestsSection({
  milestones,
  accentColor,
  questId,
  userId,
  onAdd,
  onDelete,
  onUpdate,
  onFocus,
}: MainQuestsSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Which milestone is expanded (showing action strip)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Which milestone is in edit mode
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const incomplete = milestones.filter((m) => !m.completed)

  function closeForm() {
    setShowForm(false)
    setFormTitle('')
    setFormDate('')
  }

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
      if (newFocus) {
        onFocus?.(milestoneId)
      } else {
        onFocus?.(null)
      }
      setExpandedId(null)
    }
  }

  function openEdit(m: MainQuestMilestone) {
    setEditId(m.id)
    setEditTitle(m.title)
    setEditDate(m.target_date ?? '')
    setExpandedId(null)
  }

  function cancelEdit() {
    setEditId(null)
    setEditTitle('')
    setEditDate('')
  }

  async function handleEditSave(milestoneId: string) {
    const title = editTitle.trim()
    if (!title || !userId || editSaving) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/quests/milestones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestoneId,
          userId,
          title,
          targetDate: editDate || null,
        }),
      })
      if (res.ok) {
        onUpdate?.(milestoneId, { title, target_date: editDate || null })
        cancelEdit()
      }
    } finally {
      setEditSaving(false)
    }
  }

  const focusedExists = incomplete.some((m) => m.is_focused)

  return (
    <section style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#9B8EC4', letterSpacing: '0.06em' }}>
          Milestones
          {focusedExists && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 9,
                color: '#fbbf24',
                background: 'rgba(251,191,36,0.1)',
                border: '0.5px solid rgba(251,191,36,0.3)',
                borderRadius: 4,
                padding: '1px 5px',
                letterSpacing: '0.05em',
              }}
            >
              1 focused
            </span>
          )}
        </span>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 11,
              color: accentColor,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            + Add
          </button>
        )}
      </div>

      {/* Inline add form */}
      {showForm && (
        <div
          style={{
            background: '#140C28',
            borderRadius: 12,
            border: `0.5px solid ${accentColor}55`,
            padding: '12px 14px',
            marginBottom: 10,
          }}
        >
          <input
            autoFocus
            type="text"
            placeholder="e.g. Build £50k portfolio by Aug 2026"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave()
              if (e.key === 'Escape') closeForm()
            }}
            style={{
              width: '100%',
              background: '#0D0820',
              border: '0.5px solid #2D1B55',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 13,
              color: '#E8E0F0',
              outline: 'none',
              marginBottom: 8,
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              style={{
                flex: 1,
                background: '#0D0820',
                border: '0.5px solid #2D1B55',
                borderRadius: 8,
                padding: '7px 10px',
                fontSize: 12,
                color: formDate ? '#E8E0F0' : '#5A4A7A',
                outline: 'none',
                fontFamily: 'inherit',
                colorScheme: 'dark',
              }}
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!formTitle.trim() || saving}
              style={{
                background: accentColor,
                border: 'none',
                borderRadius: 8,
                padding: '7px 18px',
                fontSize: 12,
                fontWeight: 600,
                color: '#0D0820',
                cursor: formTitle.trim() && !saving ? 'pointer' : 'default',
                opacity: formTitle.trim() && !saving ? 1 : 0.4,
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              {saving ? '…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 18,
                color: '#3D2878',
                cursor: 'pointer',
                padding: '0 2px',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {incomplete.length === 0 && !showForm ? (
        <p style={{ fontSize: 11, color: '#3D3358' }}>No milestones yet.</p>
      ) : (
        incomplete.map((m) => {
          const isFocused = m.is_focused
          const isExpanded = expandedId === m.id
          const isEditing = editId === m.id
          const days = daysUntil(m.target_date)
          // Dim non-focused milestones when focus is set
          const opacity = focusedExists && !isFocused ? 0.45 : 1

          return (
            <div
              key={m.id}
              style={{
                background: '#140C28',
                borderRadius: 12,
                border: isFocused
                  ? `0.5px solid rgba(251,191,36,0.4)`
                  : '0.5px solid #2D1B55',
                padding: '12px 12px 12px 15px',
                marginBottom: 8,
                opacity,
                position: 'relative',
                overflow: 'hidden',
                transition: 'opacity 0.2s ease, border-color 0.2s ease',
              }}
            >
              {/* Left accent bar — gold when focused */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: isFocused ? '#fbbf24' : accentColor,
                  transition: 'background 0.2s ease',
                }}
              />

              {/* Edit mode */}
              {isEditing ? (
                <div style={{ paddingLeft: 2 }}>
                  <input
                    autoFocus
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleEditSave(m.id)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    style={{
                      width: '100%',
                      background: '#0D0820',
                      border: '0.5px solid #2D1B55',
                      borderRadius: 8,
                      padding: '7px 10px',
                      fontSize: 13,
                      color: '#E8E0F0',
                      outline: 'none',
                      marginBottom: 8,
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      style={{
                        flex: 1,
                        background: '#0D0820',
                        border: '0.5px solid #2D1B55',
                        borderRadius: 8,
                        padding: '6px 10px',
                        fontSize: 12,
                        color: editDate ? '#E8E0F0' : '#5A4A7A',
                        outline: 'none',
                        fontFamily: 'inherit',
                        colorScheme: 'dark',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleEditSave(m.id)}
                      disabled={!editTitle.trim() || editSaving}
                      style={{
                        background: accentColor,
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 16px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#0D0820',
                        cursor: editTitle.trim() && !editSaving ? 'pointer' : 'default',
                        opacity: editTitle.trim() && !editSaving ? 1 : 0.4,
                        fontFamily: 'inherit',
                        flexShrink: 0,
                      }}
                    >
                      {editSaving ? '…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: 18,
                        color: '#3D2878',
                        cursor: 'pointer',
                        padding: '0 2px',
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal / expanded view */
                <>
                  {/* Clickable header row */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: isFocused ? '#fbbf24' : accentColor,
                          marginTop: 5,
                          flexShrink: 0,
                          transition: 'background 0.2s ease',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#E8E0F0' }}>
                            {m.title}
                          </span>
                          {isFocused ? (
                            <span
                              style={{
                                fontSize: 9,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'rgba(251,191,36,0.15)',
                                color: '#fbbf24',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              ⚡ Focused
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 9,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'rgba(107,94,140,0.2)',
                                color: '#6B5E8C',
                              }}
                            >
                              Planned
                            </span>
                          )}
                        </div>
                        {m.target_date && (
                          <p style={{ fontSize: 10, color: '#7A5FA0', margin: '4px 0 0' }}>
                            {days > 0
                              ? `${days}d left`
                              : days === 0
                              ? 'Due today'
                              : `${Math.abs(days)}d overdue`}
                          </p>
                        )}
                        {m.task_total > 0 && (
                          <>
                            <div
                              style={{
                                marginTop: 8,
                                height: 4,
                                background: '#1E0D40',
                                borderRadius: 2,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${m.progress_percent}%`,
                                  background: isFocused ? '#fbbf24' : accentColor,
                                  borderRadius: 2,
                                  transition: 'width 0.6s ease',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 9, color: '#5A4A7A', marginTop: 4, display: 'block' }}>
                              {m.progress_percent}% of tasks done
                            </span>
                          </>
                        )}
                      </div>

                      {/* Chevron */}
                      <span
                        style={{
                          fontSize: 10,
                          color: '#3D2878',
                          flexShrink: 0,
                          marginTop: 2,
                          transition: 'transform 0.15s ease',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          display: 'block',
                        }}
                      >
                        ▾
                      </span>
                    </div>
                  </button>

                  {/* Action strip */}
                  {isExpanded && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: '0.5px solid #1E0D40',
                      }}
                    >
                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        style={{
                          background: '#1E0D40',
                          border: '0.5px solid #2D1B55',
                          borderRadius: 6,
                          padding: '5px 10px',
                          fontSize: 11,
                          color: '#9B8EC4',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        ✏️ Edit
                      </button>

                      {/* Focus / Unfocus */}
                      <button
                        type="button"
                        onClick={() => void handleFocus(m.id, isFocused)}
                        style={{
                          background: isFocused ? 'rgba(251,191,36,0.12)' : '#1E0D40',
                          border: isFocused
                            ? '0.5px solid rgba(251,191,36,0.4)'
                            : '0.5px solid #2D1B55',
                          borderRadius: 6,
                          padding: '5px 10px',
                          fontSize: 11,
                          color: isFocused ? '#fbbf24' : '#9B8EC4',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {isFocused ? '✕ Unfocus' : '⚡ Focus'}
                      </button>

                      {/* Delete */}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedId(null)
                            onDelete(m.id)
                          }}
                          style={{
                            background: 'transparent',
                            border: '0.5px solid #2D1B55',
                            borderRadius: 6,
                            padding: '5px 10px',
                            fontSize: 11,
                            color: '#4A2878',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            marginLeft: 'auto',
                          }}
                        >
                          Delete
                        </button>
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
