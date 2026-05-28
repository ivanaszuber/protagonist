'use client'

import React, { useEffect, useState, type ComponentType } from 'react'
import type { CSSProperties } from 'react'
import { CHARACTERS, type Dimension } from '@/lib/character'
import { DIMENSION_TO_SLUG, getTierName } from '@/lib/tierName'
import { getLevel, getLevelProgress } from '@/lib/xp'
import { getUserId } from '@/lib/user'
import { getMedalDefinitions } from '@/lib/medals'
import { ScoreBlock } from '@/components/characters/ScoreBlock'
import { MainQuestsSection, type MainQuestMilestone } from '@/components/characters/MainQuestsSection'
import { BossCard } from '@/components/characters/BossCard'
import { HallOfKills } from '@/components/characters/HallOfKills'
import { MedalsRow } from '@/components/characters/MedalsRow'
import { LegendCard } from '@/components/characters/LegendCard'
import { DesktopLeftSidebar, DIM_COLORS } from './DesktopLeftSidebar'
import DesktopTopNav from './DesktopTopNav'
import { DesktopOracleModal } from './DesktopOracleModal'
import {
  ForgeCharacterLarge,
  EchoCharacterLarge,
  VaultCharacterLarge,
  BlazeCharacterLarge,
  SageCharacterLarge,
  SolCharacterLarge,
  RootCharacterLarge,
} from '@/components/characters/CharacterHeroArt'
import type { BossBattle, BossKillRow, BossTask } from '@/lib/bosses'
import {
  XpToastOverlay,
  showXpFeedback,
  type LevelUpToast,
  type XpToast,
} from '@/components/XpToastOverlay'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────
// DIM_COLORS is imported from DesktopLeftSidebar (single source of truth)

const HERO_ART: Record<Dimension, ComponentType<{ color: string }>> = {
  career:   ForgeCharacterLarge,
  social:   EchoCharacterLarge,
  wealth:   VaultCharacterLarge,
  vitality: BlazeCharacterLarge,
  mind:     SageCharacterLarge,
  love:     SolCharacterLarge,
  family:   RootCharacterLarge,
}

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

const PAGE_CSS = `
  @keyframes dcp-float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes dcp-spin     { to{transform:rotate(360deg)} }
  @keyframes dcp-pulse-dot{ 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:0.75} }
  @keyframes dcp-pulse-btn{ 0%,100%{box-shadow:0 0 0 0 rgba(255,122,101,0.4)} 50%{box-shadow:0 0 0 8px rgba(255,122,101,0)} }
  ::-webkit-scrollbar { display: none; }
`

// ── Score ring SVG ────────────────────────────────────────────────────────────

function ScoreRing({ score, color, size = 120 }: { score: number; color: string; size?: number }) {
  const r = 42
  const cx = 56
  const circumference = 2 * Math.PI * r
  const filled = (score / 10) * circumference
  const offset = circumference - filled

  return (
    <svg width={size} height={size} viewBox="0 0 112 112">
      {/* Track */}
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
      {/* Arc */}
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={`${offset}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s' }}
        filter={`drop-shadow(0 0 6px ${color}88)`}
      />
      {/* Score text */}
      <text x={cx} y={cx + 2} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="28" fontWeight="700" fontFamily="'Space Grotesk', sans-serif">
        {score}
      </text>
      <text x={cx} y={cx + 18} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="'Space Grotesk', sans-serif" letterSpacing="1.5">
        SCORE
      </text>
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DesktopCharacterPageProps {
  dimension: Dimension
}

export function DesktopCharacterPage({ dimension }: DesktopCharacterPageProps) {
  const userId = getUserId()
  const char = CHARACTERS[dimension]
  const accentColor = DIM_COLORS[dimension]
  const characterSlug = DIMENSION_TO_SLUG[dimension]
  const HeroArt = HERO_ART[dimension]
  const medalDefs = getMedalDefinitions(dimension)

  const [quest, setQuest] = useState<QuestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [xpToast, setXpToast] = useState<XpToast | null>(null)
  const [levelUpToast, setLevelUpToast] = useState<LevelUpToast | null>(null)
  const [boss, setBoss] = useState<BossBattle | null>(null)
  const [escapedBoss, setEscapedBoss] = useState<BossBattle | null>(null)
  const [bossTasks, setBossTasks] = useState<BossTask[]>([])
  const [bossKills, setBossKills] = useState<BossKillRow[]>([])
  const [killStats, setKillStats] = useState({ slain: 0, escaped: 0 })
  const [earnedMedals, setEarnedMedals] = useState<string[]>([])
  const [dimScores, setDimScores] = useState<Record<string, number>>({})
  const [dimensionInsight, setDimensionInsight] = useState<string | null>(null)
  const [recentNotes, setRecentNotes] = useState<Array<{ id: string; content: string; brief: string | null; createdAt: string }>>([])

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadBossAndMedals(uid: string) {
    const [bossRes, killsRes, medalsRes] = await Promise.allSettled([
      fetch(`/api/bosses/active?userId=${encodeURIComponent(uid)}&dimension=${encodeURIComponent(dimension)}`).then(r => r.json()),
      fetch(`/api/bosses/kills?userId=${encodeURIComponent(uid)}&dimension=${encodeURIComponent(dimension)}`).then(r => r.json()),
      fetch(`/api/medals/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, dimension }),
      }).then(r => r.json()),
    ])
    if (bossRes.status === 'fulfilled') {
      const d = bossRes.value as { boss?: BossBattle | null; tasks?: BossTask[]; escapedBoss?: BossBattle | null }
      setBoss(d.boss ?? null)
      setBossTasks(d.tasks ?? [])
      setEscapedBoss(d.escapedBoss ?? null)
    }
    if (killsRes.status === 'fulfilled') {
      const d = killsRes.value as { kills?: BossKillRow[]; stats?: { slain: number; escaped: number } }
      setBossKills(d.kills ?? [])
      setKillStats(d.stats ?? { slain: 0, escaped: 0 })
    }
    if (medalsRes.status === 'fulfilled') {
      const d = medalsRes.value as { earned?: string[] }
      setEarnedMedals(d.earned ?? [])
    }
  }

  function loadData() {
    const uid = getUserId()
    Promise.allSettled([
      fetch(`/api/quests/character/${dimension}?userId=${encodeURIComponent(uid)}`).then(r => r.json()),
      fetch(`/api/dimension-score?userId=${encodeURIComponent(uid)}`).then(r => r.json()),
      loadBossAndMedals(uid),
    ]).then(([questRes, scoresRes]) => {
      if (questRes.status === 'fulfilled') {
        const v = questRes.value as { quest?: QuestData | null }
        setQuest(v.quest ?? null)
      }
      if (scoresRes.status === 'fulfilled') {
        const v = scoresRes.value as { scores?: Record<string, number> }
        setDimScores(v.scores ?? {})
      }
      setLoading(false)
    })
  }

  useEffect(() => {
    loadData()
    const onUpdate = () => loadData()
    window.addEventListener('protagonist:quest-updated', onUpdate)
    return () => window.removeEventListener('protagonist:quest-updated', onUpdate)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension])

  // ── Oracle insights for this dimension ────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    const cacheKey = `protagonist-identity-${userId}`

    // Try cache first
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const data = JSON.parse(cached) as { dimensionInsights?: Array<{ dimension: string; insight: string }> }
        const match = data.dimensionInsights?.find(d => d.dimension === dimension)
        if (match) setDimensionInsight(match.insight)
      }
    } catch { /* ignore */ }

    // Fetch fresh
    fetch(`/api/identity/synthesize?userId=${encodeURIComponent(userId)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { dimensionInsights?: Array<{ dimension: string; insight: string }> } | null) => {
        const match = data?.dimensionInsights?.find(d => d.dimension === dimension)
        if (match) setDimensionInsight(match.insight)
      })
      .catch(() => {})

    // Fetch recent conversation notes for this dimension
    fetch(`/api/journal/entries?userId=${encodeURIComponent(userId)}&dimension=${encodeURIComponent(dimension)}&limit=4`)
      .then(r => r.json())
      .then((d: { entries?: Array<{ id: string; content: string; brief: string | null; createdAt: string }> }) => {
        setRecentNotes(d.entries?.slice(0, 3) ?? [])
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dimension])

  // ── Handlers ──────────────────────────────────────────────────────────────

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
      setQuest(prev => prev ? { ...prev, xp: prev.xp + earned } : prev)
      showXpFeedback({ dimension }, data, setXpToast, setLevelUpToast)
      return { slain: data.boss?.slain, reward_xp: data.boss?.reward_xp, hp_remaining: data.boss?.hp_remaining }
    }
    return {}
  }

  async function refreshAfterBossSlain() {
    const uid = getUserId()
    await loadBossAndMedals(uid)
    const questRes = await fetch(`/api/quests/character/${dimension}?userId=${encodeURIComponent(uid)}`).then(r => r.json())
    const v = questRes as { quest?: QuestData | null }
    setQuest(v.quest ?? null)
  }

  async function deleteMilestone(milestoneId: string) {
    const uid = getUserId()
    const res = await fetch(
      `/api/quests/milestones?milestoneId=${encodeURIComponent(milestoneId)}&userId=${encodeURIComponent(uid)}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      setQuest(prev => prev ? { ...prev, milestones: prev.milestones.filter(m => m.id !== milestoneId) } : prev)
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const xp = quest?.xp ?? 0
  const level = getLevel(xp)
  const xpInLevel = xp % 500
  const xpProgress = getLevelProgress(xp)
  const tierLabel = getTierName(level, characterSlug)

  function getScore(dim: Dimension): number {
    const baseline = dimScores[dim]
    if (baseline != null) return baseline
    const lvl = getLevel(0)
    return Math.min(10, Math.max(1, Math.round(lvl * 1.5 + getLevelProgress(0))))
  }

  const currentScore = dimScores[dimension] ?? Math.min(10, Math.max(1, Math.round(level * 1.5 + xpProgress)))

  const activeMilestone =
    quest?.milestones.find(m => !m.completed && m.is_focused) ??
    quest?.milestones.find(m => !m.completed) ??
    null

  function fmtRelTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs = Math.floor(mins / 60)
    const days = Math.floor(hrs / 24)
    if (mins < 2)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    if (hrs < 24)  return `${hrs}h ago`
    if (days === 1) return 'yesterday'
    if (days < 7)  return `${days}d ago`
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...font, minHeight: '100dvh', background: '#0D0820', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{PAGE_CSS}</style>
        <div style={{ color: '#3D3358', fontSize: 13 }}>Loading...</div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ ...font, minHeight: '100dvh', background: '#0D0820', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{PAGE_CSS}</style>

      {/* ── Top nav (shared component) ───────────────────────────────────── */}
      <DesktopTopNav activePage="character" animPrefix="dcp" />

      {/* ── Oracle modal — needed for quest/challenge buttons on this page ── */}
      <DesktopOracleModal />

      {/* ── Three columns ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Left sidebar (shared component) ──────────────────────────────── */}
      <DesktopLeftSidebar
        scores={dimScores as Partial<Record<Dimension, number>>}
        activeDimension={dimension}
        showBackButton
      />

      {/* ── Center panel ─────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflowY: 'auto', background: '#0D0820',
        padding: '28px 28px 60px',
        minWidth: 0,
      }}>

        {/* Hero section */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, marginBottom: 24 }}>

          {/* Score ring */}
          <div style={{ flexShrink: 0 }}>
            <ScoreRing score={currentScore} color={accentColor} size={112} />
          </div>

          {/* Character art */}
          <div style={{ flexShrink: 0, animation: 'dcp-float 3.2s ease-in-out infinite', marginTop: -8 }}>
            <HeroArt color={accentColor} />
          </div>

          {/* Info */}
          <div style={{ flex: 1, paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: '#E8E0F0' }}>{char.name}</span>
              <span style={{ background: `${accentColor}18`, border: `0.5px solid ${accentColor}40`, borderRadius: 20, padding: '3px 10px', fontSize: 10, color: accentColor }}>
                {char.categoryLabel}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: accentColor, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {tierLabel}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>·</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                Lv {level}
              </span>
              {killStats.slain > 0 && (
                <>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>·</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    <strong style={{ color: accentColor }}>{killStats.slain}</strong> challenges won
                  </span>
                </>
              )}
            </div>
            {/* XP bar */}
            <div style={{ maxWidth: 320 }}>
              <div style={{ height: 4, background: '#1E0D40', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                <div style={{ height: '100%', width: `${Math.round((xpInLevel / 500) * 100)}%`, background: accentColor, borderRadius: 3, transition: 'width 1s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, color: '#5A4A7A' }}>{xpInLevel} XP</span>
                <span style={{ fontSize: 9, color: '#5A4A7A' }}>500 to Level {level + 1}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quest vision */}
        <LegendCard
          characterName={char.name}
          dimensionLabel={char.categoryLabel}
          dimension={dimension}
          vision={quest?.vision ?? null}
          accentColor={accentColor}
          userId={userId}
          onQuestSaved={(v) => setQuest(prev => prev ? { ...prev, vision: v } : { id: '', vision: v, character_name: char.name, character_class: 'Adventurer', milestones: [], recent_tasks: [], xp: 0 })}
        />

        {/* ── Oracle's Read — dimension insight + conversation notes ── */}
        {(dimensionInsight || recentNotes.length > 0) && (
          <div style={{ marginBottom: 20 }}>

            {/* Oracle's Read card */}
            {dimensionInsight && (
              <div style={{
                background: `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}08 100%)`,
                border: `1px solid ${accentColor}38`,
                borderRadius: 14, padding: '16px 18px', marginBottom: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={accentColor}>
                    <path d="M12 2l2.4 7.6H22l-6.4 4.6 2.4 7.6L12 17.2l-6 4.6 2.4-7.6L2 9.6h7.6L12 2z"/>
                  </svg>
                  <span style={{ ...font, fontSize: 9, fontWeight: 700, color: accentColor, letterSpacing: '1.4px', textTransform: 'uppercase' as const }}>
                    Oracle&apos;s Read · {char.categoryLabel}
                  </span>
                </div>
                <p style={{ ...font, fontSize: 13.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.72, margin: 0 }}>
                  {dimensionInsight}
                </p>
              </div>
            )}

            {/* From your conversations */}
            {recentNotes.length > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.022)',
                border: '0.5px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <span style={{ ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.4px', textTransform: 'uppercase' as const, display: 'block', marginBottom: 11 }}>
                  From your conversations
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {recentNotes.map(note => {
                    const excerpt = note.brief ?? (note.content.length > 130 ? note.content.slice(0, 130) + '…' : note.content)
                    return (
                      <div key={note.id} style={{ borderLeft: `2px solid ${accentColor}35`, paddingLeft: 11 }}>
                        <p style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, fontStyle: 'italic', margin: '0 0 3px' }}>
                          &ldquo;{excerpt}&rdquo;
                        </p>
                        <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>
                          {fmtRelTime(note.createdAt)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Quests / Milestones */}
        {quest && (
          <MainQuestsSection
            characterName={char.name}
            dimensionLabel={char.categoryLabel}
            milestones={quest.milestones}
            accentColor={accentColor}
            questId={quest.id}
            userId={userId}
            onAdd={m => setQuest(prev => prev ? { ...prev, milestones: [...prev.milestones, m] } : prev)}
            onDelete={id => void deleteMilestone(id)}
            onUpdate={(id, changes) =>
              setQuest(prev => prev ? {
                ...prev,
                milestones: prev.milestones.map(m => m.id === id ? { ...m, ...changes } : m),
              } : prev)
            }
            onFocus={focusedId =>
              setQuest(prev => prev ? {
                ...prev,
                milestones: prev.milestones.map(m => ({ ...m, is_focused: m.id === focusedId })),
              } : prev)
            }
          />
        )}

        {/* Medals — reuse MedalsRow with existing SVG icons */}
        <MedalsRow
          definitions={medalDefs}
          earned={earnedMedals}
          accentColor={accentColor}
        />

        {/* Score block — at the bottom since it changes rarely */}
        <ScoreBlock
          dimension={dimension}
          xp={xp}
          userId={userId}
          accentColor={accentColor}
        />
      </div>

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      <div style={{
        width: 340, flexShrink: 0,
        background: '#0F0B1F',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        overflowY: 'auto', padding: '28px 20px 60px',
      }}>

        {/* Active challenge */}
        <BossCard
          characterName={char.name}
          dimensionLabel={char.categoryLabel}
          dimension={dimension}
          mainQuestTitle={activeMilestone?.title ?? null}
          boss={boss}
          escapedBoss={escapedBoss}
          tasks={bossTasks}
          onTaskComplete={handleBossTaskComplete}
          onBossSlain={refreshAfterBossSlain}
        />

        {/* Hall of Victories */}
        <HallOfKills
          kills={bossKills}
          stats={killStats}
        />
      </div>

      </div>{/* end three-columns */}

      {/* XP toasts */}
      <XpToastOverlay xpToast={xpToast} levelUpToast={levelUpToast} />
    </div>
  )
}
