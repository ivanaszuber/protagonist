'use client'

import { useEffect, useState, useCallback } from 'react'
import { getUserId } from '@/lib/user'
import { CHARACTERS, type Dimension } from '@/lib/character'
import { openOracle } from '@/lib/oracle-events'

interface FocusItem {
  text: string
  dimension: string | null
  done: boolean
}

interface SuggestionItem {
  text: string
  dimension: string
}

interface TaskItem {
  id: string
  title: string
  dimension: string
  xp_reward: number
  completed: boolean
}

interface TodayBrief {
  id: string
  oracle_reply: string
  mood_signal: string | null
  focus_list: FocusItem[] | null
  suggestions: SuggestionItem[] | null
  calendar_matches: string[] | null
  created_at: string
  tasks: TaskItem[]
}

interface HistoryBrief {
  id: string
  oracle_message: string | null
  focus_list: FocusItem[] | null
  created_at: string
  tasks_done: number
  total_focus: number
}

interface MorningContext {
  readiness: number | null
  sleep: number | null
  activity: number | null
}

function OuraBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 9, color: '#5A4A7A' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div
          style={{
            width: 36,
            height: 3,
            background: '#2D1B55',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(value, 100)}%`,
              height: '100%',
              background: color,
              borderRadius: 2,
            }}
          />
        </div>
        <span style={{ fontSize: 9, color }}>{value}</span>
      </div>
    </div>
  )
}

function OuraCard({ context }: { context: MorningContext }) {
  const hasAny =
    context.readiness !== null || context.sleep !== null || context.activity !== null
  if (!hasAny) return null
  return (
    <div
      style={{
        background: '#140C28',
        border: '0.5px solid #2D1B55',
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        minWidth: 110,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 9, color: '#5A4A7A' }}>OURA</div>
      {context.readiness !== null && (
        <OuraBar label="Readiness" value={context.readiness} color="#4ADE80" />
      )}
      {context.sleep !== null && (
        <OuraBar label="Sleep" value={context.sleep} color="#818CF8" />
      )}
      {context.activity !== null && (
        <OuraBar label="Activity" value={context.activity} color="#F43F5E" />
      )}
    </div>
  )
}

function HistoryRow({ brief }: { brief: HistoryBrief }) {
  const date = new Date(brief.created_at)
  const dayLabel = date.toLocaleDateString('en-GB', { weekday: 'short' })
  const focusList = brief.focus_list ?? []
  const done = brief.tasks_done
  const total = brief.total_focus
  const dimColors = [
    ...new Set(
      focusList
        .map((f) => f.dimension)
        .filter((d): d is string => Boolean(d))
    ),
  ]
    .slice(0, 3)
    .map((d) => CHARACTERS[d as Dimension]?.color ?? '#3D2878')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 14,
      }}
    >
      <div style={{ width: 34, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 8, color: '#3D2878' }}>{dayLabel}</div>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#2D1B55',
            margin: '4px auto',
            border: '0.5px solid #9333EA',
          }}
        />
      </div>
      <div style={{ paddingTop: 2, flex: 1 }}>
        {brief.oracle_message && (
          <div
            style={{
              fontSize: 10,
              color: '#7A6A9A',
              lineHeight: 1.5,
              fontStyle: 'italic',
              marginBottom: 5,
            }}
          >
            &ldquo;
            {brief.oracle_message.length > 85
              ? brief.oracle_message.slice(0, 82) + '…'
              : brief.oracle_message}
            &rdquo;
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {dimColors.map((c, i) => (
            <div
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: c,
              }}
            />
          ))}
          {total > 0 && (
            <div style={{ fontSize: 8, color: '#3D2878', marginLeft: 2 }}>
              {done}/{total} focus done
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BriefPage() {
  const userId = getUserId()

  const [today, setToday] = useState<TodayBrief | null>(null)
  const [history, setHistory] = useState<HistoryBrief[]>([])
  const [context, setContext] = useState<MorningContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)

  const loadBrief = useCallback(async () => {
    setLoading(true)
    try {
      const [briefRes, ctxRes] = await Promise.all([
        fetch(`/api/brief?userId=${encodeURIComponent(userId)}`),
        fetch(`/api/oracle/morning-context?userId=${encodeURIComponent(userId)}`),
      ])
      if (briefRes.ok) {
        const data = (await briefRes.json()) as {
          today: TodayBrief | null
          history: HistoryBrief[]
        }
        setToday(data.today ?? null)
        setHistory(data.history ?? [])
      }
      if (ctxRes.ok) {
        const ctx = (await ctxRes.json()) as MorningContext
        setContext(ctx)
      }
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void loadBrief()
  }, [loadBrief])

  // Refresh after Oracle completes a morning check-in
  useEffect(() => {
    const handler = () => void loadBrief()
    window.addEventListener('protagonist:task-added', handler)
    return () => window.removeEventListener('protagonist:task-added', handler)
  }, [loadBrief])

  const toggleFocus = useCallback(
    async (index: number, done: boolean) => {
      if (!today) return
      // Optimistic update
      setToday((prev) => {
        if (!prev?.focus_list) return prev
        const newList = [...prev.focus_list]
        newList[index] = { ...newList[index], done }
        return { ...prev, focus_list: newList }
      })
      await fetch('/api/brief/focus', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, noteId: today.id, index, done }),
      })
    },
    [today, userId]
  )

  const checkinTime = today
    ? new Date(today.created_at).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <main
      style={{
        background: '#0D0820',
        minHeight: '100vh',
        paddingBottom: 90,
      }}
    >
      {/* Top nav */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px 10px',
          borderBottom: '0.5px solid #1A0F35',
          position: 'sticky',
          top: 0,
          background: 'rgba(13,8,32,0.96)',
          backdropFilter: 'blur(12px)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#200D45',
              border: '0.5px solid rgba(147,51,234,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              color: '#9333EA',
            }}
          >
            ✦
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#E8E0F0' }}>Day Brief</div>
            {checkinTime && (
              <div style={{ fontSize: 9, color: '#5A4A7A' }}>Checked in {checkinTime}</div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 9, color: '#3D2878' }}>{todayLabel}</div>
      </div>

      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 200,
          }}
        >
          <div style={{ fontSize: 22, color: '#3D2878' }}>✦</div>
        </div>
      ) : !today ? (
        /* ─── EMPTY STATE ─── */
        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Cinematic hero */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '44px 24px 36px',
              position: 'relative',
            }}
          >
            {/* Concentric rings */}
            {[220, 162, 108].map((size, i) => (
              <div
                key={size}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -54%)',
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  border: `0.5px solid rgba(147,51,234,${0.07 + i * 0.08})`,
                  pointerEvents: 'none',
                }}
              />
            ))}

            {/* Oracle orb */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#150838',
                border: '0.5px solid rgba(147,51,234,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                color: '#6B3FA0',
                marginBottom: 22,
                position: 'relative',
                zIndex: 1,
              }}
            >
              ✦
            </div>

            <div
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: '#E8E0F0',
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Good morning.
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#5A4A7A',
                lineHeight: 1.75,
                textAlign: 'center',
                marginBottom: 28,
              }}
            >
              Oracle is ready when you are.
              <br />
              Speak your mind — the brief builds itself.
            </div>

            <button
              onClick={() => openOracle('Good morning', 'morning_checkin')}
              style={{
                background: 'rgba(147,51,234,0.14)',
                border: '0.5px solid rgba(147,51,234,0.5)',
                borderRadius: 100,
                color: '#C084FC',
                fontSize: 13,
                padding: '12px 30px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>✦</span> Start your day
            </button>
          </div>

          {/* Past briefs timeline */}
          {history.length > 0 && (
            <div style={{ paddingBottom: 12 }}>
              <div
                style={{
                  fontSize: 9,
                  color: '#3D2878',
                  letterSpacing: '0.1em',
                  marginBottom: 10,
                }}
              >
                RECENT BRIEFS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 17,
                    top: 8,
                    bottom: 8,
                    width: 0.5,
                    background: '#1E1040',
                  }}
                />
                {history.map((brief) => (
                  <HistoryRow key={brief.id} brief={brief} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ─── FILLED STATE ─── */
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Oracle message */}
          <div
            style={{
              background: '#140C28',
              border: '0.5px solid #2D1B55',
              borderLeft: '3px solid #9333EA',
              borderRadius: '0 10px 10px 10px',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: '#9333EA',
                letterSpacing: '0.08em',
                marginBottom: 6,
              }}
            >
              ORACLE
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#E8E0F0',
                fontStyle: 'italic',
                lineHeight: 1.6,
              }}
            >
              &ldquo;{today.oracle_reply}&rdquo;
            </div>
          </div>

          {/* Mood + Oura row */}
          {(today.mood_signal || (context && (context.readiness !== null || context.sleep !== null || context.activity !== null))) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {today.mood_signal && (
                <div
                  style={{
                    background: '#140C28',
                    border: '0.5px solid #2D1B55',
                    borderRadius: 10,
                    padding: '10px 12px',
                    flex: 1,
                  }}
                >
                  <div style={{ fontSize: 9, color: '#5A4A7A', marginBottom: 5 }}>FEELING</div>
                  <div style={{ fontSize: 11, color: '#C0B0E0', lineHeight: 1.5 }}>
                    {today.mood_signal}
                  </div>
                </div>
              )}
              {context && <OuraCard context={context} />}
            </div>
          )}

          {/* Today's Focus — checkable */}
          {today.focus_list && today.focus_list.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 9,
                  color: '#5A4A7A',
                  letterSpacing: '0.1em',
                  marginBottom: 7,
                }}
              >
                TODAY&apos;S FOCUS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {today.focus_list.map((item, i) => {
                  const char = item.dimension
                    ? CHARACTERS[item.dimension as Dimension]
                    : null
                  const color = char?.color ?? '#9333EA'
                  return (
                    <div
                      key={i}
                      style={{
                        background: '#140C28',
                        border: `0.5px solid ${item.done ? '#1A0F35' : '#2D1B55'}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        position: 'relative',
                        overflow: 'hidden',
                        opacity: item.done ? 0.45 : 1,
                        transition: 'opacity 0.25s',
                      }}
                    >
                      {/* Accent bar */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 3,
                          background: item.done ? '#2D1B55' : color,
                          transition: 'background 0.25s',
                        }}
                      />
                      {/* Checkbox / number */}
                      <button
                        onClick={() => void toggleFocus(i, !item.done)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: item.done
                            ? 'rgba(147,51,234,0.2)'
                            : `${color}1A`,
                          border: `0.5px solid ${item.done ? '#9333EA' : `${color}55`}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          color: item.done ? '#9333EA' : color,
                          fontWeight: 500,
                          flexShrink: 0,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {item.done ? '✓' : i + 1}
                      </button>
                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            color: item.done ? '#5A4A7A' : '#E8E0F0',
                            lineHeight: 1.4,
                            textDecoration: item.done ? 'line-through' : 'none',
                          }}
                        >
                          {item.text}
                        </div>
                        {!item.done && char && (
                          <div style={{ fontSize: 9, color, marginTop: 2 }}>{char.name}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Calendar matches */}
          {today.calendar_matches && today.calendar_matches.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 9,
                  color: '#5A4A7A',
                  letterSpacing: '0.1em',
                  marginBottom: 7,
                }}
              >
                ON YOUR CALENDAR
              </div>
              <div
                style={{
                  background: '#140C28',
                  border: '0.5px solid #2D1B55',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                {today.calendar_matches.map((match, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      borderBottom:
                        i < today.calendar_matches!.length - 1
                          ? '0.5px solid #1E1040'
                          : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: '#5A4A7A',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ fontSize: 12, color: '#C0B0E0' }}>{match}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's tasks */}
          {today.tasks && today.tasks.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 9,
                  color: '#5A4A7A',
                  letterSpacing: '0.1em',
                  marginBottom: 7,
                }}
              >
                TODAY&apos;S TASKS
              </div>
              <div
                style={{
                  background: '#140C28',
                  border: '0.5px solid #2D1B55',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                {today.tasks.map((task, i) => {
                  const char = CHARACTERS[task.dimension as Dimension]
                  const color = char?.color ?? '#9333EA'
                  return (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        borderBottom:
                          i < today.tasks.length - 1 ? '0.5px solid #1E1040' : 'none',
                        opacity: task.completed ? 0.4 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                          fontSize: 12,
                          color: task.completed ? '#5A4A7A' : '#C0B0E0',
                          textDecoration: task.completed ? 'line-through' : 'none',
                        }}
                      >
                        {task.title}
                      </div>
                      <span
                        style={{
                          fontSize: 8,
                          color,
                          background: `${color}15`,
                          border: `0.5px solid ${color}55`,
                          borderRadius: 20,
                          padding: '1px 6px',
                          flexShrink: 0,
                        }}
                      >
                        {char?.name ?? task.dimension}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {today.suggestions && today.suggestions.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 9,
                  color: '#5A4A7A',
                  letterSpacing: '0.1em',
                  marginBottom: 7,
                }}
              >
                ALSO WORTH CONSIDERING
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {today.suggestions.map((s, i) => {
                  const char = CHARACTERS[s.dimension as Dimension]
                  const color = char?.color ?? '#9333EA'
                  return (
                    <div
                      key={i}
                      style={{
                        background: '#100830',
                        border: '0.5px solid #1E1040',
                        borderRadius: 10,
                        padding: '9px 12px',
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          width: 3,
                          borderRadius: 2,
                          background: color,
                          alignSelf: 'stretch',
                          flexShrink: 0,
                          minHeight: 16,
                        }}
                      />
                      <div
                        style={{ fontSize: 11, color: '#7A6A9A', lineHeight: 1.5 }}
                      >
                        {s.text}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Past briefs — collapsible */}
          {history.length > 0 && (
            <div style={{ paddingTop: 4 }}>
              <button
                onClick={() => setHistoryOpen((o) => !o)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3D2878',
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: '4px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span>{historyOpen ? '▾' : '▸'}</span> PAST BRIEFS
              </button>
              {historyOpen && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    marginTop: 10,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 17,
                      top: 8,
                      bottom: 8,
                      width: 0.5,
                      background: '#1E1040',
                    }}
                  />
                  {history.map((brief) => (
                    <HistoryRow key={brief.id} brief={brief} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
