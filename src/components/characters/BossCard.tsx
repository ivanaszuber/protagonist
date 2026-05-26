'use client'

import { useEffect, useRef, useState } from 'react'
import { BossSvg } from '@/components/characters/BossSvg'
import { getUserId } from '@/lib/user'
import { CHARACTERS } from '@/lib/character'
import type { BossBattle, BossTask } from '@/lib/bosses'

interface BossCardProps {
  characterName: string
  dimensionLabel: string
  dimension: string
  mainQuestTitle: string | null
  boss: BossBattle | null
  escapedBoss: BossBattle | null
  tasks: BossTask[]
  onTaskComplete: (taskId: string, xpReward: number) => Promise<{
    slain?: boolean
    reward_xp?: number
    hp_remaining?: number
  } | void>
  onBossSlain: () => Promise<void>
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function formatDeadline(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
  })
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function progressFillColor(completed: number, total: number): string {
  const pct = total > 0 ? completed / total : 0
  if (pct >= 0.8) return '#34d399'
  if (pct >= 0.5) return '#818cf8'
  return '#9B8EC4'
}

export function BossCard({
  characterName,
  dimensionLabel,
  dimension,
  mainQuestTitle,
  boss,
  escapedBoss,
  tasks,
  onTaskComplete,
  onBossSlain,
}: BossCardProps) {
  const accentColor = (CHARACTERS[dimension as keyof typeof CHARACTERS]?.color) ?? '#9B8EC4'

  const [localBoss, setLocalBoss] = useState(boss)
  const [localTasks, setLocalTasks] = useState(tasks)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set())
  const [victory, setVictory] = useState<{ name: string; rewardXp: number } | null>(null)
  const [xpDisplay, setXpDisplay] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const xpAnimRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setLocalBoss(boss)
    setLocalTasks(tasks)
    // If page reloaded with an active boss where all tasks are already done,
    // show victory state instead of a frozen 10/10 task list.
    if (boss && tasks.length > 0 && tasks.every((t) => t.completed)) {
      setVictory({ name: boss.name, rewardXp: boss.reward_xp })
    } else {
      setVictory(null)
    }
  }, [boss, tasks])

  // XP count-up when victory triggers
  useEffect(() => {
    if (!victory) { setXpDisplay(0); return }
    const target = victory.rewardXp
    const steps = 30
    let step = 0
    xpAnimRef.current = setInterval(() => {
      step++
      setXpDisplay(Math.round((step / steps) * target))
      if (step >= steps) clearInterval(xpAnimRef.current!)
    }, 30)
    return () => { if (xpAnimRef.current) clearInterval(xpAnimRef.current) }
  }, [victory])

  async function handleTaskClick(task: BossTask) {
    if (task.completed || !localBoss || completingId) return
    setCompletingId(task.id)

    // Check before optimistic update: is this the last uncompleted task?
    const remainingBeforeClick = localTasks.filter((t) => !t.completed).length
    const isLastTask = remainingBeforeClick === 1

    // Optimistic UI
    const damage = task.hp_damage ?? 1
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: true } : t))
    )
    setLocalBoss((prev) =>
      prev ? { ...prev, hp_remaining: Math.max(0, prev.hp_remaining - damage) } : prev
    )

    // Glow animation
    setJustCompleted((prev) => new Set(prev).add(task.id))
    setTimeout(() => {
      setJustCompleted((prev) => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
    }, 600)

    // Fire victory immediately (optimistic) — don't wait for the API response.
    // This ensures the animation always plays even if the network call fails
    // or the task had no boss_battle_id (old data).
    if (isLastTask) {
      setVictory({ name: localBoss.name, rewardXp: localBoss.reward_xp })
    }

    let apiResult: { slain?: boolean; reward_xp?: number; hp_remaining?: number } = {}
    try {
      apiResult = (await onTaskComplete(task.id, task.xp_reward)) ?? {}
    } catch {
      // non-critical — victory already shown optimistically above
    }

    try {
      // Sync hp_remaining from server response
      if (apiResult.hp_remaining !== undefined) {
        setLocalBoss((prev) =>
          prev ? { ...prev, hp_remaining: apiResult.hp_remaining! } : prev
        )
      }
      // If this wasn't the last task but the server confirms the boss was slain, show victory
      if (!isLastTask && apiResult.slain && localBoss) {
        setVictory({
          name: localBoss.name,
          rewardXp: apiResult.reward_xp ?? localBoss.reward_xp,
        })
      }
      // Update XP reward if server returns a different value than the optimistic one
      if (isLastTask && apiResult.reward_xp) {
        setVictory({ name: localBoss.name, rewardXp: apiResult.reward_xp })
      }
    } finally {
      setCompletingId(null)
    }
  }

  async function handleStartBoss() {
    if (generating) return
    setGenerating(true)
    setGenerateError(null)
    const uid = getUserId()
    try {
      const res = await fetch('/api/bosses/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          dimension,
          userMessage: `Generate a challenge for ${characterName}. Main quest: ${mainQuestTitle ?? 'not set yet'}.`,
        }),
      })
      const data = await res.json() as { boss?: { name: string }; error?: string }
      if (!res.ok) {
        setGenerateError(data.error ?? 'Generation failed — try again.')
      } else {
        await onBossSlain()
      }
    } catch {
      setGenerateError('Network error — try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleHuntEscaped(name: string) {
    if (generating) return
    setGenerating(true)
    setGenerateError(null)
    const uid = getUserId()
    try {
      const res = await fetch('/api/bosses/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          dimension,
          userMessage: `Retry the challenge "${name}". Same challenge name, new 30-day deadline, fresh tasks.`,
        }),
      })
      const data = await res.json() as { boss?: { name: string }; error?: string }
      if (!res.ok) {
        setGenerateError(data.error ?? 'Generation failed — try again.')
      } else {
        await onBossSlain()
      }
    } catch {
      setGenerateError('Network error — try again.')
    } finally {
      setGenerating(false)
    }
  }

  const sectionLabel = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#9B8EC4', letterSpacing: '0.06em' }}>
        Challenge
      </span>
    </div>
  )

  // ── Escaped state ──────────────────────────────────────────
  if (escapedBoss && !localBoss) {
    return (
      <section style={{ marginBottom: 20 }}>
        {sectionLabel}
        <div style={{ background: '#1A0A08', border: '0.5px solid #6B1A1A', borderRadius: 14, padding: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#ef4444', margin: '0 0 6px' }}>
            {escapedBoss.name} — ABANDONED
          </p>
          <p style={{ fontSize: 11, color: '#9B8EC4', margin: '0 0 12px', lineHeight: 1.5 }}>
            Challenge expired. -50 XP penalty applied. Ready to take it on again?
          </p>
          <button
            type="button"
            onClick={() => handleHuntEscaped(escapedBoss.name)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#2A0808', border: '0.5px solid #6B1A1A', borderRadius: 8,
              padding: '8px 12px', fontSize: 11, color: '#ef4444', cursor: 'pointer',
            }}
          >
            Retry this challenge ↗
          </button>
        </div>
      </section>
    )
  }

  // ── No active challenge ────────────────────────────────────
  if (!localBoss) {
    return (
      <section style={{ marginBottom: 20 }}>
        {sectionLabel}
        <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 14, padding: 16 }}>
          {generating ? (
            <p style={{ fontSize: 12, color: '#7A5FA0', margin: 0, fontStyle: 'italic' }}>
              Creating your challenge...
            </p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: '#7A5FA0', margin: '0 0 10px' }}>
                No active challenge. Start your next one.
              </p>
              {generateError && (
                <p style={{ fontSize: 11, color: '#ef4444', margin: '0 0 8px' }}>{generateError}</p>
              )}
              <button
                type="button"
                onClick={() => void handleStartBoss()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#1E0D40', border: '0.5px solid #4A2080', borderRadius: 8,
                  padding: '8px 12px', fontSize: 11, color: '#A78BFA', cursor: 'pointer',
                }}
              >
                Start a new Challenge
              </button>
            </>
          )}
        </div>
      </section>
    )
  }

  // ── Active challenge card ──────────────────────────────────
  const completedTasks = localTasks.filter((t) => t.completed)
  const tasksDone = completedTasks.length
  const totalTasks = localTasks.length
  const progressPct = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0
  const tasksLeft = totalTasks - tasksDone
  const days = daysUntil(localBoss.deadline)
  const fill = progressFillColor(tasksDone, totalTasks)

  return (
    <section style={{ marginBottom: 20 }}>
      {sectionLabel}
      <div style={{ background: '#0E0E1A', border: '0.5px solid #2D1B55', borderRadius: 14, padding: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <BossSvg size={52} color={accentColor} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#F0ECFF', margin: '0 0 4px' }}>
              {localBoss.name}
            </p>
            <p style={{ fontSize: 10, color: '#9B8EC4', margin: 0 }}>
              Complete by {formatDeadline(localBoss.deadline)} · {days}d left
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#7A5FA0', marginBottom: 4 }}>
            <span>Progress</span>
            <span>{tasksDone} / {totalTasks} tasks done</span>
          </div>
          <div style={{ height: 8, background: '#1E1040', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                background: fill,
                borderRadius: 4,
                transition: 'width 0.5s ease, background 0.3s ease',
              }}
            />
          </div>
        </div>
        <p style={{ fontSize: 10, color: '#6B5E8C', margin: '0 0 14px' }}>
          {tasksLeft} task{tasksLeft === 1 ? '' : 's'} remaining · reward: +{localBoss.reward_xp} XP
        </p>

        {/* Victory block (Option 1 — in-place) */}
        {victory ? (
          <div style={{ animation: 'victory-appear 0.35s ease-out both' }}>
            <div style={{ textAlign: 'center', padding: '16px 8px 8px', position: 'relative' }}>
              {/* Sparkle particles */}
              {[
                { rise: '-48px', drift: '-22px', delay: '0.1s', color: accentColor },
                { rise: '-52px', drift: '18px',  delay: '0.2s', color: '#34d399' },
                { rise: '-38px', drift: '-38px', delay: '0.35s', color: accentColor },
                { rise: '-44px', drift: '34px',  delay: '0.15s', color: '#a78bfa' },
                { rise: '-56px', drift: '0px',   delay: '0.25s', color: '#34d399' },
                { rise: '-36px', drift: '-10px', delay: '0.4s',  color: accentColor },
              ].map((p, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: 28,
                    left: '50%',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: p.color,
                    '--rise': p.rise,
                    '--drift': p.drift,
                    animation: `sparkle-rise 0.9s ${p.delay} ease-out both`,
                  } as React.CSSProperties}
                />
              ))}
              <div
                style={{
                  fontSize: 30,
                  color: '#34d399',
                  fontWeight: 500,
                  marginBottom: 6,
                  display: 'inline-block',
                  animation: 'xp-pop 0.4s 0.1s ease-out both, victory-star-pulse 1.5s 0.5s ease-in-out 3',
                }}
              >
                ★
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#34d399', margin: '0 0 4px' }}>
                Challenge Conquered
              </p>
              <p style={{ fontSize: 12, color: '#9B8EC4', margin: '0 0 10px' }}>
                {victory.name}
              </p>
              <p
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  color: accentColor,
                  margin: '0 0 4px',
                  animation: 'xp-pop 0.4s 0.25s ease-out both',
                }}
              >
                +{xpDisplay} XP
              </p>
              <p style={{ fontSize: 10, color: '#5A4A7A', margin: '0 0 14px' }}>
                Added to Hall of Victories
              </p>
              <button
                type="button"
                onClick={async () => {
                  // Finalize the boss server-side (idempotent — safe to call even if already slain)
                  if (localBoss) {
                    const uid = getUserId()
                    await fetch(`/api/bosses/${localBoss.id}/slay`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: uid }),
                    }).catch(() => {})
                  }
                  await onBossSlain()
                }}
                style={{
                  padding: '8px 18px',
                  background: '#1E0D40',
                  border: '0.5px solid #4A2080',
                  borderRadius: 20,
                  color: '#A78BFA',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  animation: 'victory-appear 0.3s 0.6s ease-out both',
                  opacity: 0,
                }}
              >
                Ready for your next challenge? ↗
              </button>
            </div>
          </div>
        ) : (
          /* Task list */
          <>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: '#4A2878', margin: '0 0 8px' }}>
              CHALLENGE TASKS
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {localTasks.map((task) => {
                const isGlowing = justCompleted.has(task.id)
                const glowColor = hexToRgba(accentColor, 0.65)
                const glowFade = hexToRgba(accentColor, 0)
                return (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleTaskClick(task)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') void handleTaskClick(task)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: '#120D28',
                      borderRadius: 8,
                      border: '0.5px solid #1E1040',
                      cursor: task.completed ? 'default' : 'pointer',
                      opacity: task.completed ? 0.45 : 1,
                      animation: task.completed && isGlowing ? 'task-row-settle 0.4s 0.3s ease-out both' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        flexShrink: 0,
                        border: `1.5px solid ${task.completed ? accentColor : '#4A2878'}`,
                        background: task.completed ? accentColor : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        // CSS custom properties for glow keyframe
                        '--glow-color': glowColor,
                        '--glow-color-fade': glowFade,
                        animation: isGlowing ? 'task-check-glow 0.55s ease-out' : 'none',
                      } as React.CSSProperties}
                    >
                      {task.completed && (
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2.5L8 3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {completingId === task.id && !task.completed && (
                        <div
                          style={{
                            width: 7,
                            height: 7,
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
                        flex: 1,
                        fontSize: 11,
                        color: task.completed ? '#5A4A7A' : '#E8E0F0',
                        textDecoration: task.completed ? 'line-through' : 'none',
                      }}
                    >
                      {task.title}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      {task.task_date && (
                        <span style={{ fontSize: 10, color: task.completed ? '#3D2878' : '#5A4A7A' }}>
                          {new Date(task.task_date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {!task.completed && (
                        <span style={{ fontSize: 10, color: '#6B5E8C' }}>
                          +{task.xp_reward} XP
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
