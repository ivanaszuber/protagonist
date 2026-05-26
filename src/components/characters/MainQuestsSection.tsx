'use client'

import { openOracle } from '@/lib/oracle-events'

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
  onDelete?: (milestoneId: string) => void
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export function MainQuestsSection({
  characterName,
  dimensionLabel,
  milestones,
  accentColor,
  onDelete,
}: MainQuestsSectionProps) {
  const incomplete = milestones.filter((m) => !m.completed)
  const activeId = incomplete[0]?.id

  function handleAdd() {
    openOracle(
      `I want to add a new main quest for ${characterName} — ${dimensionLabel}. Help me define it with a clear goal, milestone, and target date.`
    )
  }

  function handleEdit(m: MainQuestMilestone) {
    openOracle(
      `I want to edit my main quest for ${characterName} — ${dimensionLabel}. The current quest is: "${m.title}"${m.target_date ? ` (target: ${m.target_date})` : ''}. Help me update the title or target date.`
    )
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
          Main Quests
        </span>
        <button
          type="button"
          onClick={handleAdd}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 11,
            color: accentColor,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          + Add ↗
        </button>
      </div>

      {incomplete.length === 0 ? (
        <p style={{ fontSize: 11, color: '#3D3358' }}>No main quests yet.</p>
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
                  {isActive && m.task_total > 0 && (
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
                        {m.progress_percent}% complete
                      </span>
                    </>
                  )}
                </div>

                {/* Edit + Delete actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleEdit(m)}
                    aria-label="Edit quest"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: 10,
                      color: '#3D2878',
                      cursor: 'pointer',
                      padding: '2px 4px',
                    }}
                  >
                    Edit ↗
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(m.id)}
                      aria-label="Delete quest"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#2D1B55',
                        fontSize: 16,
                        lineHeight: 1,
                        cursor: 'pointer',
                        padding: '0 2px',
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </section>
  )
}
