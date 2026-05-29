'use client'

import Link from 'next/link'
import { useEffect, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { useIsDesktop } from '@/lib/useIsDesktop'
import { DesktopCharacterPage } from '@/components/desktop/DesktopCharacterPage'
import { DesktopFinancePage } from '@/components/desktop/DesktopFinancePage'
import {
  BlazeCharacterLarge,
  EchoCharacterLarge,
  ForgeCharacterLarge,
  RootCharacterLarge,
  SageCharacterLarge,
  SolCharacterLarge,
  VaultCharacterLarge,
} from '@/components/characters/CharacterHeroArt'
import { getLevel } from '@/lib/xp'
import { CHARACTERS, type Dimension } from '@/lib/character'
import { DIMENSION_TO_SLUG, getTierName } from '@/lib/tierName'
import {
  XpToastOverlay,
  showXpFeedback,
  type LevelUpToast,
  type XpToast,
} from '@/components/XpToastOverlay'
import { getUserId } from '@/lib/user'
import { TopNav } from '@/components/TopNav'
import { LegendCard } from '@/components/characters/LegendCard'
import {
  MainQuestsSection,
  type MainQuestMilestone,
} from '@/components/characters/MainQuestsSection'
import { BossCard } from '@/components/characters/BossCard'
import { HallOfKills } from '@/components/characters/HallOfKills'
import { MedalsRow } from '@/components/characters/MedalsRow'
import { VaultNetWorthCard } from '@/components/vault/VaultNetWorthCard'
import type { BossBattle, BossKillRow, BossTask } from '@/lib/bosses'
import { getMedalDefinitions } from '@/lib/medals'
import { ScoreBlock } from '@/components/characters/ScoreBlock'

interface Milestone extends MainQuestMilestone {}

interface Task {
  id: string
  title: string
  task_date: string | null
  completed: boolean
  xp_reward: number
  boss_battle_id: string | null
}

interface QuestData {
  id: string
  vision: string
  character_name: string
  character_class: string
  milestones: Milestone[]
  recent_tasks: Task[]
  xp: number
  bosses_slain?: number
  streak_days?: number
}

const HERO_ART: Record<Dimension, ComponentType> = {
  career: ForgeCharacterLarge,
  social: EchoCharacterLarge,
  wealth: VaultCharacterLarge,
  vitality: BlazeCharacterLarge,
  mind: SageCharacterLarge,
  love: SolCharacterLarge,
  family: RootCharacterLarge,
}

const FLOAT_DELAYS: Record<Dimension, string> = {
  career: '0s',
  social: '0.5s',
  wealth: '1s',
  vitality: '0.25s',
  mind: '0.75s',
  love: '1.25s',
  family: '1.5s',
}


function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function LeftBorderCard({
  accentColor,
  children,
  style,
}: {
  accentColor: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        background: '#140C28',
        borderRadius: 14,
        border: '0.5px solid #2D1B55',
        padding: '14px 14px 14px 17px',
        marginBottom: 8,
        position: 'relative',
        overflow: 'hidden',
        ...style,
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
      {children}
    </div>
  )
}

interface CharacterPageProps {
  dimension: Dimension
}

export function CharacterPage({ dimension }: CharacterPageProps) {
  const isDesktop = useIsDesktop()
  const char = CHARACTERS[dimension]
  const characterSlug = DIMENSION_TO_SLUG[dimension]
  const accentColor = char.color
  const HeroArt = HERO_ART[dimension]
  const floatDelay = FLOAT_DELAYS[dimension]

  const [quest, setQuest] = useState<QuestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [xpToast, setXpToast] = useState<XpToast | null>(null)
  const [levelUpToast, setLevelUpToast] = useState<LevelUpToast | null>(null)
  const [oracleMemories, setOracleMemories] = useState<string[]>([])
  const [boss, setBoss] = useState<BossBattle | null>(null)
  const [escapedBoss, setEscapedBoss] = useState<BossBattle | null>(null)
  const [bossTasks, setBossTasks] = useState<BossTask[]>([])
  const [bossKills, setBossKills] = useState<BossKillRow[]>([])
  const [killStats, setKillStats] = useState({ slain: 0, escaped: 0 })
  const [earnedMedals, setEarnedMedals] = useState<string[]>([])
  const [vaultSlipInfo, setVaultSlipInfo] = useState<{ isSlipDay: boolean; amount: number | null }>({
    isSlipDay: false,
    amount: null,
  })

  async function loadBossAndMedals(uid: string) {
    const [bossRes, killsRes, medalsRes] = await Promise.allSettled([
      fetch(
        `/api/bosses/active?userId=${encodeURIComponent(uid)}&dimension=${encodeURIComponent(dimension)}`
      ).then((r) => r.json()),
      fetch(
        `/api/bosses/kills?userId=${encodeURIComponent(uid)}&dimension=${encodeURIComponent(dimension)}`
      ).then((r) => r.json()),
      fetch(`/api/medals/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, dimension }),
      }).then((r) => r.json()),
    ])
    if (bossRes.status === 'fulfilled') {
      const bossData = bossRes.value as {
        boss?: BossBattle | null
        tasks?: BossTask[]
        escapedBoss?: BossBattle | null
      }
      setBoss(bossData.boss ?? null)
      setBossTasks(bossData.tasks ?? [])
      setEscapedBoss(bossData.escapedBoss ?? null)
    }
    if (killsRes.status === 'fulfilled') {
      const killsData = killsRes.value as {
        kills?: BossKillRow[]
        stats?: { slain: number; escaped: number }
      }
      setBossKills(killsData.kills ?? [])
      setKillStats(killsData.stats ?? { slain: 0, escaped: 0 })
    }
    if (medalsRes.status === 'fulfilled') {
      const medalsData = medalsRes.value as { earned?: string[] }
      setEarnedMedals(medalsData.earned ?? [])
    }
  }

  function loadQuestData() {
    const uid = getUserId()
    const memoryDim = CHARACTERS[dimension].memoryId
    const fetches: Promise<unknown>[] = [
      fetch(`/api/quests/character/${dimension}?userId=${encodeURIComponent(uid)}`).then(
        (r) => r.json()
      ),
      fetch(
        `/api/memories?userId=${encodeURIComponent(uid)}&dimension=${encodeURIComponent(memoryDim)}&limit=3`
      ).then((r) => r.json()),
      loadBossAndMedals(uid),
    ]
    if (dimension === 'wealth') {
      fetches.push(fetch(`/api/vault/settings?userId=${encodeURIComponent(uid)}`).then((r) => r.json()))
    }
    Promise.allSettled(fetches).then((results) => {
      const questRes = results[0]
      const memoriesRes = results[1]
      const vaultRes = dimension === 'wealth' ? results[3] : null
      if (questRes.status === 'fulfilled') {
        const val = questRes.value as { quest?: QuestData | null }
        setQuest(val.quest ?? null)
      }
      if (memoriesRes.status === 'fulfilled') {
        const val = memoriesRes.value as { memories?: string[] }
        setOracleMemories(val.memories ?? [])
      }
      if (vaultRes?.status === 'fulfilled') {
        const val = vaultRes.value as {
          settings?: { last_slip_at?: string | null; last_slip_amount?: number | null }
        }
        const slipAt = val.settings?.last_slip_at
        const isSlipDay = slipAt
          ? new Date(slipAt).toDateString() === new Date().toDateString()
          : false
        setVaultSlipInfo({ isSlipDay, amount: val.settings?.last_slip_amount ?? null })
      }
      setLoading(false)
    })
  }

  useEffect(() => {
    loadQuestData()
    const onQuestUpdated = () => loadQuestData()
    window.addEventListener('protagonist:quest-updated', onQuestUpdated)
    return () => window.removeEventListener('protagonist:quest-updated', onQuestUpdated)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension])

  async function handleBossTaskComplete(taskId: string, xpReward: number) {
    const uid = getUserId()
    const res = await fetch(`/api/quests/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid }),
    })
    const data = (await res.json()) as {
      xp_earned?: number
      leveled_up?: boolean
      new_level?: number
      boss?: { slain: boolean; reward_xp?: number; hp_remaining?: number }
    }
    if (res.ok) {
      const earned = data.xp_earned ?? xpReward
      setQuest((prev) =>
        prev ? { ...prev, xp: prev.xp + earned } : prev
      )
      showXpFeedback({ dimension }, data, setXpToast, setLevelUpToast)
      return {
        slain: data.boss?.slain,
        reward_xp: data.boss?.reward_xp,
        hp_remaining: data.boss?.hp_remaining,
      }
    }
    return {}
  }

  async function refreshAfterBossSlain() {
    const uid = getUserId()
    await loadBossAndMedals(uid)
    const questRes = await fetch(
      `/api/quests/character/${dimension}?userId=${encodeURIComponent(uid)}`
    ).then((r) => r.json())
    const val = questRes as { quest?: QuestData | null }
    setQuest(val.quest ?? null)
  }

  async function deleteMilestone(milestoneId: string) {
    const uid = getUserId()
    const res = await fetch(
      `/api/quests/milestones?milestoneId=${encodeURIComponent(milestoneId)}&userId=${encodeURIComponent(uid)}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      setQuest((prev) =>
        prev
          ? { ...prev, milestones: prev.milestones.filter((m) => m.id !== milestoneId) }
          : prev
      )
    }
  }

  async function completeLooseTask(taskId: string, xpReward: number) {
    const uid = getUserId()
    setQuest((prev) =>
      prev
        ? {
            ...prev,
            recent_tasks: prev.recent_tasks.map((t) =>
              t.id === taskId ? { ...t, completed: true } : t
            ),
          }
        : prev
    )
    const res = await fetch(`/api/quests/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid }),
    })
    const data = (await res.json()) as {
      xp_earned?: number
      leveled_up?: boolean
      new_level?: number
    }
    if (res.ok) {
      const earned = data.xp_earned ?? xpReward
      setQuest((prev) => (prev ? { ...prev, xp: prev.xp + earned } : prev))
      showXpFeedback({ dimension }, data, setXpToast, setLevelUpToast)
    }
  }

  const xp = quest?.xp ?? 0
  const level = getLevel(xp)
  const xpInLevel = xp % 500
  const tierLabel = getTierName(level, characterSlug)
  // Prefer focused milestone for BossCard context; fall back to first incomplete
  const activeMilestone =
    quest?.milestones.find((m) => !m.completed && m.is_focused) ??
    quest?.milestones.find((m) => !m.completed) ??
    null

  if (isDesktop && dimension === 'wealth') return <DesktopFinancePage />
  if (isDesktop) return <DesktopCharacterPage dimension={dimension} />

  const pageShellStyle: CSSProperties = {
    minHeight: '100dvh',
    background: '#0D0820',
    overflowY: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    paddingBottom: 100,
    fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
  }

  if (loading) {
    return (
      <main className="dashboard-scroll" style={pageShellStyle}>
        <TopNav streakDays={0} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
          }}
        >
          <span style={{ color: '#3D3358', fontSize: 13 }}>Loading...</span>
        </div>
      </main>
    )
  }

  return (
    <main className="dashboard-scroll" style={pageShellStyle}>
      <TopNav streakDays={quest?.streak_days ?? 0} />
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '44px 16px 0' }}>
        {/* Hero — Option D: robot left, info right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingTop: 16,
            paddingBottom: 20,
          }}
        >
          {/* Character art */}
          <div
            style={{
              flexShrink: 0,
              animation: vaultSlipInfo.isSlipDay
                ? 'vault-slip-wobble 1.8s ease-in-out infinite'
                : 'protagonist-float 3.2s ease-in-out infinite',
              animationDelay: vaultSlipInfo.isSlipDay ? '0s' : floatDelay,
              transformOrigin: 'center bottom',
              position: 'relative',
            }}
          >
            <HeroArt />
            {vaultSlipInfo.isSlipDay && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: 20,
                    top: 58,
                    width: 5,
                    height: 9,
                    background: '#9FE1CB',
                    borderRadius: '0 0 5px 5px',
                    animation: 'vault-tear-fall 1.1s ease-in infinite',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 40,
                    top: 58,
                    width: 5,
                    height: 9,
                    background: '#9FE1CB',
                    borderRadius: '0 0 5px 5px',
                    animation: 'vault-tear-fall 1.1s ease-in 0.45s infinite',
                  }}
                />
              </>
            )}
          </div>

          {/* Info column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Row 1: name + category badge + optional slip badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22, fontWeight: 500, color: '#E8E0F0' }}>{char.name}</span>
              <span
                style={{
                  background: '#2A1800',
                  border: `0.5px solid ${accentColor}`,
                  borderRadius: 20,
                  padding: '2px 8px',
                  fontSize: 10,
                  color: accentColor,
                  flexShrink: 0,
                }}
              >
                {char.categoryLabel}
              </span>
              {vaultSlipInfo.isSlipDay && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#2A0808',
                    border: '0.5px solid #7A2020',
                    borderRadius: 20,
                    padding: '2px 10px',
                    fontSize: 10,
                    color: '#E05050',
                    flexShrink: 0,
                  }}
                >
                  😢 Vault is hurt
                  {vaultSlipInfo.amount != null && ` · −£${Math.round(vaultSlipInfo.amount).toLocaleString('en-GB')}`}
                </span>
              )}
            </div>

            {/* Row 2: tier · level pill · challenges — all inline */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: accentColor,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {tierLabel}
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#1E0D40',
                  borderRadius: 20,
                  padding: '3px 10px',
                  border: '0.5px solid #3D2070',
                }}
              >
                <span style={{ fontSize: 10, color: '#7A5FA0' }}>Lv</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: accentColor }}>{level}</span>
              </div>
              <span style={{ fontSize: 10, color: '#6B5E8C' }}>
                <strong style={{ color: accentColor }}>{quest?.bosses_slain ?? killStats.slain}</strong> won
              </span>
            </div>

            {/* Row 3: XP bar full width */}
            <div>
              <div
                style={{
                  height: 5,
                  background: '#1E0D40',
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginBottom: 3,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round((xpInLevel / 500) * 100)}%`,
                    background: accentColor,
                    borderRadius: 3,
                    transition: 'width 1s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, color: '#5A4A7A' }}>{xpInLevel} XP</span>
                <span style={{ fontSize: 9, color: '#5A4A7A' }}>500 to Level {level + 1}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Score block — baseline setter */}
        <ScoreBlock
          dimension={dimension}
          xp={xp}
          userId={getUserId()}
          accentColor={accentColor}
        />

        {dimension === 'wealth' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <Link
                href="/vault/settings"
                style={{
                  fontSize: 10,
                  color: '#4A2878',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  textDecoration: 'none',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                Vault settings
              </Link>
            </div>
            <VaultNetWorthCard userId={getUserId()} accentColor={accentColor} />
          </>
        )}


        <LegendCard
          characterName={char.name}
          dimensionLabel={char.categoryLabel}
          dimension={dimension}
          vision={quest?.vision ?? null}
          accentColor={accentColor}
          userId={getUserId()}
          onQuestSaved={(v) => setQuest(prev => prev ? { ...prev, vision: v } : { id: '', vision: v, character_name: char.name, character_class: 'Adventurer', milestones: [], recent_tasks: [], xp: 0 })}
        />

        {quest && (
          <MainQuestsSection
            characterName={char.name}
            dimensionLabel={char.categoryLabel}
            milestones={quest.milestones}
            accentColor={accentColor}
            questId={quest.id}
            userId={getUserId()}
            onAdd={(m) =>
              setQuest((prev) =>
                prev ? { ...prev, milestones: [...prev.milestones, m] } : prev
              )
            }
            onDelete={(id) => void deleteMilestone(id)}
            onUpdate={(id, changes) =>
              setQuest((prev) =>
                prev
                  ? {
                      ...prev,
                      milestones: prev.milestones.map((m) =>
                        m.id === id ? { ...m, ...changes } : m
                      ),
                    }
                  : prev
              )
            }
            onFocus={(focusedId) =>
              setQuest((prev) =>
                prev
                  ? {
                      ...prev,
                      milestones: prev.milestones.map((m) => ({
                        ...m,
                        is_focused: m.id === focusedId,
                      })),
                    }
                  : prev
              )
            }
          />
        )}

        {/* Loose tasks — not linked to any challenge */}
        {(() => {
          const looseTasks = (quest?.recent_tasks ?? []).filter(
            (t) => t.boss_battle_id == null
          )
          const incomplete = looseTasks.filter((t) => !t.completed)
          const recentDone = looseTasks
            .filter((t) => t.completed)
            .slice(0, 3)
          if (looseTasks.length === 0) return null
          return (
            <section style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#9B8EC4', letterSpacing: '0.06em' }}>
                  Tasks
                </span>
                <span style={{ fontSize: 10, color: '#3D3358' }}>
                  {incomplete.length} remaining
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...incomplete, ...recentDone].map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: '#140C28',
                      borderRadius: 8,
                      border: '0.5px solid #2D1B55',
                      opacity: task.completed ? 0.45 : 1,
                      cursor: task.completed ? 'default' : 'pointer',
                    }}
                    onClick={() => {
                      if (!task.completed) void completeLooseTask(task.id, task.xp_reward)
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
                      }}
                    >
                      {task.completed && (
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2.5L8 3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
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
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                      {task.task_date && (
                        <span style={{ fontSize: 9, color: task.completed ? '#3D2878' : '#5A4A7A' }}>
                          {new Date(task.task_date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {!task.completed && (
                        <span style={{ fontSize: 9, color: '#6B5E8C' }}>+{task.xp_reward} XP</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )
        })()}

        <BossCard
          characterName={char.name}
          dimensionLabel={char.categoryLabel}
          dimension={dimension}
          mainQuestTitle={activeMilestone?.title ?? quest?.vision ?? null}
          boss={boss}
          escapedBoss={escapedBoss}
          tasks={bossTasks}
          onTaskComplete={handleBossTaskComplete}
          onBossSlain={refreshAfterBossSlain}
        />

        <HallOfKills kills={bossKills} stats={killStats} />

        <MedalsRow
          definitions={getMedalDefinitions(dimension)}
          earned={earnedMedals}
          accentColor={accentColor}
        />

        {oracleMemories.length > 0 && (
          <div
            style={{
              background: '#0D0820',
              border: '0.5px solid #1E1040',
              borderLeft: '2px solid #9333EA',
              borderRadius: '0 10px 10px 0',
              padding: '12px 14px',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: '#4A2878',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: oracleMemories.length < 3 ? 4 : 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke="#6B3FA0" strokeWidth="1.2" />
                <circle cx="8" cy="8" r="2" fill="#6B3FA0" />
              </svg>
              Oracle remembers
            </div>
            {oracleMemories.length < 3 && (
              <div style={{ fontSize: 11, color: '#5A4A7A', marginBottom: 8, fontStyle: 'italic' }}>
                Oracle is just starting to know you
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {oracleMemories.map((memory, i) => {
                const dateMatch = memory.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.+)$/)
                const date = dateMatch?.[1]
                const text = dateMatch?.[2] ?? memory
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    {date && (
                      <span
                        style={{
                          fontSize: 9,
                          color: '#3D2060',
                          flexShrink: 0,
                          marginTop: 2,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#7A5FA0', lineHeight: 1.5 }}>{text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      <XpToastOverlay xpToast={xpToast} levelUpToast={levelUpToast} />
    </main>
  )
}
