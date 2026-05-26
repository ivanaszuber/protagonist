'use client'

import { useEffect, useState } from 'react'
import { BossSvg } from '@/components/characters/BossSvg'
import { getUserId } from '@/lib/user'
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
  } | void>
  onBossSlain: () => void
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function hpFillColor(remaining: number, total: number): string {
  const pct = total > 0 ? remaining / total : 0
  if (pct <= 0.2) return '#fbbf24'
  if (pct <= 0.4) return '#fb923c'
  return '#ef4444'
}

function formatDeadline(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
  })
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
  const [localBoss, setLocalBoss] = useState(boss)
  const [localTasks, setLocalTasks] = useState(tasks)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [victory, setVictory] = useState<{ name: string; rewardXp: number } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  useEffect(() => {
    setLocalBoss(boss)
    setLocalTasks(tasks)
    setVictory(null)
  }, [boss, tasks])

  async function handleTaskClick(task: BossTask) {
    if (task.completed || !localBoss || completingId) return
    setCompletingId(task.id)

    const damage = task.hp_damage
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: true } : t))
    )
    setLocalBoss((prev) =>
      prev
        ? {
            ...prev,
            hp_remaining: Math.max(0, prev.hp_remaining - damage),
          }
        : prev
    )

    try {
      const result = await onTaskComplete(task.id, task.xp_reward)
      if (result?.slain && localBoss) {
        setVictory({
          name: localBoss.name,
          rewardXp: result.reward_xp ?? localBoss.reward_xp,
        })
        setTimeout(() => {
          setVictory(null)
          onBossSlain()
        }, 2000)
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
          userMessage: `Generate a boss battle for ${characterName}. Main quest: ${mainQuestTitle ?? 'not set yet'}.`,
        }),
      })
      const data = await res.json() as { boss?: { name: string }; error?: string }
      if (!res.ok) {
        setGenerateError(data.error ?? 'Generation failed — try again.')
      } else {
        onBossSlain() // reuses the refresh callback
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
          userMessage: `Hunt the escaped boss "${name}". Same boss name, new 30-day deadline, fresh attack tasks.`,
        }),
      })
      const data = await res.json() as { boss?: { name: string }; error?: string }
      if (!res.ok) {
        setGenerateError(data.error ?? 'Generation failed — try again.')
      } else {
        onBossSlain()
      }
    } catch {
      setGenerateError('Network error — try again.')
    } finally {
      setGenerating(false)
    }
  }

  const sectionLabel = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <span style={{ fontSize: 12 }}>⚔</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#9B8EC4', letterSpacing: '0.06em' }}>
        Boss Battle
      </span>
    </div>
  )

  if (victory) {
    return (
      <section style={{ marginBottom: 20 }}>
        {sectionLabel}
        <div
          style={{
            background: '#1A0A12',
            border: '0.5px solid #ef4444',
            borderRadius: 14,
            padding: 20,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', margin: '0 0 8px' }}>
            ⚔ Boss Slain!
          </p>
          <p style={{ fontSize: 12, color: '#E8E0F0', margin: '0 0 12px' }}>
            {victory.name} has been defeated.
          </p>
          <p style={{ fontSize: 11, color: '#fbbf24', margin: 0 }}>
            +{victory.rewardXp} XP · Added to Hall of Kills
          </p>
        </div>
      </section>
    )
  }

  if (escapedBoss && !localBoss) {
    return (
      <section style={{ marginBottom: 20 }}>
        {sectionLabel}
        <div
          style={{
            background: '#1A0A08',
            border: '0.5px solid #6B1A1A',
            borderRadius: 14,
            padding: 16,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 500, color: '#ef4444', margin: '0 0 6px' }}>
            {escapedBoss.name} — ESCAPED
          </p>
          <p style={{ fontSize: 11, color: '#9B8EC4', margin: '0 0 12px', lineHeight: 1.5 }}>
            It dealt -50 XP before fleeing. The threat level resets but the boss is still out
            there.
          </p>
          <button
            type="button"
            onClick={() => handleHuntEscaped(escapedBoss.name)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#2A0808',
              border: '0.5px solid #6B1A1A',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 11,
              color: '#ef4444',
              cursor: 'pointer',
            }}
          >
            🔮 Hunt it down again ↗
          </button>
        </div>
      </section>
    )
  }

  if (!localBoss) {
    return (
      <section style={{ marginBottom: 20 }}>
        {sectionLabel}
        <div
          style={{
            background: '#140C28',
            border: '0.5px solid #2D1B55',
            borderRadius: 14,
            padding: 16,
          }}
        >
          {generating ? (
            <p style={{ fontSize: 12, color: '#7A5FA0', margin: 0, fontStyle: 'italic' }}>
              Summoning your nemesis...
            </p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: '#7A5FA0', margin: '0 0 10px' }}>
                No active boss. Generate your next challenge.
              </p>
              {generateError && (
                <p style={{ fontSize: 11, color: '#ef4444', margin: '0 0 8px' }}>
                  {generateError}
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleStartBoss()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#1E0D40',
                  border: '0.5px solid #6B1A1A',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 11,
                  color: '#ef4444',
                  cursor: 'pointer',
                }}
              >
                ⚔ Start a new Boss Battle
              </button>
            </>
          )}
        </div>
      </section>
    )
  }

  const hpPct =
    localBoss.hp_total > 0
      ? Math.round((localBoss.hp_remaining / localBoss.hp_total) * 100)
      : 0
  const hitsLeft = localBoss.hp_remaining
  const days = daysUntil(localBoss.deadline)
  const fill = hpFillColor(localBoss.hp_remaining, localBoss.hp_total)

  return (
    <section style={{ marginBottom: 20 }}>
      {sectionLabel}
      <div
        style={{
          background: '#1A0808',
          border: '0.5px solid #6B1A1A',
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <BossSvg size={52} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#F0ECFF', margin: '0 0 4px' }}>
              {localBoss.name}
            </p>
            <p style={{ fontSize: 10, color: '#9B8EC4', margin: 0 }}>
              Slay before {formatDeadline(localBoss.deadline)} · {days}d left
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9,
              color: '#7A5FA0',
              marginBottom: 4,
            }}
          >
            <span>HP</span>
            <span>
              {localBoss.hp_remaining}/{localBoss.hp_total}
            </span>
          </div>
          <div
            style={{
              height: 8,
              background: '#2A0808',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${hpPct}%`,
                background: fill,
                borderRadius: 4,
                transition: 'width 0.5s ease, background 0.3s ease',
              }}
            />
          </div>
        </div>
        <p style={{ fontSize: 10, color: '#6B5E8C', margin: '0 0 14px' }}>
          {hitsLeft} hit{hitsLeft === 1 ? '' : 's'} to defeat · reward: +{localBoss.reward_xp} XP
        </p>

        <p
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: '#6B1A1A',
            margin: '0 0 8px',
          }}
        >
          ATTACK MOVES
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {localTasks.map((task) => (
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
                background: '#140808',
                borderRadius: 8,
                border: '0.5px solid #2A1010',
                cursor: task.completed ? 'default' : 'pointer',
                opacity: task.completed ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  flexShrink: 0,
                  border: `1.5px solid ${task.completed ? '#34d399' : '#ef4444'}`,
                  background: task.completed ? '#34d399' : 'transparent',
                }}
              />
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
              <span style={{ fontSize: 10, color: '#ef4444', flexShrink: 0 }}>
                -{task.hp_damage}HP
              </span>
              {completingId === task.id && (
                <span style={{ fontSize: 9, color: '#7A5FA0' }}>...</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
