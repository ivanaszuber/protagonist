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
}: MainQuestsSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [saving, setSaving] = useState(false)

  const incomplete = milestones.filter((m) => !m.completed)
  const activeId = incomplete[0]?.id

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
        onAdd?.({ ...data.milestone, progress_percent: 0, task_total: 0 })
        closeForm()
      }
    } finally {
      setSaving(false)
    }
  }

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
          const isActive = m.id === activeId
          const status = isActive ? 'Active' : 'Planned'
          const days = daysUntil(m.target_date)
          return (
            <div
              key={m.id}
              style={{
                background: '#140C28',
                borderRadius: 12,
                border: '0.5px solid #2D1B55',
                padding: '12px 12px 12px 15px',
                marginBottom: 8,
                opacity: isActive ? 1 : 0.6,
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
                  background: accentColor,
                }}
              />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: accentColor,
                    marginTop: 5,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#E8E0F0' }}>{m.title}</span>
                    <span
                      style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isActive ? 'rgba(251,191,36,0.15)' : 'rgba(107,94,140,0.2)',
                        color: isActive ? '#fbbf24' : '#6B5E8C',
                      }}
                    >
                      {status}
                    </span>
                  </div>
                  {m.target_date && (
                    <p style={{ fontSize: 10, color: '#7A5FA0', margin: '4px 0 0' }}>
                      {days > 0 ? `${days}d left` : days === 0 ? 'Due today' : `${Math.abs(days)}d overdue`}
                    </p>
                  )}
                  {isActive && (m.task_total > 0 || m.progress_percent > 0) && (
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
                            background: accentColor,
                            borderRadius: 2,
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 9, color: '#5A4A7A', marginTop: 4, display: 'block' }}>
                        {m.task_total > 0
                          ? `${m.progress_percent}% complete`
                          : `${m.progress_percent}% · based on challenges conquered`}
                      </span>
                    </>
                  )}
                </div>

                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(m.id)}
                    aria-label="Delete milestone"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2D1B55',
                      fontSize: 16,
                      lineHeight: 1,
                      cursor: 'pointer',
                      padding: '0 2px',
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )
        })
      )}
    </section>
  )
}
