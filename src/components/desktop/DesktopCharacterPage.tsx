'use client'

import React, { useEffect, useState, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
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

/** New color palette matching the dashboard */
const DIM_COLORS: Record<Dimension, string> = {
  family:   '#C4A8FF',
  career:   '#FFD47A',
  wealth:   '#4DC4FF',
  vitality: '#FF9A5C',
  mind:     '#7B3FE4',
  love:     '#FF6B9D',
  social:   '#1EEFB8',
}

const AREA_LABELS: Record<Dimension, string> = {
  family:   'Family',
  career:   'Career',
  wealth:   'Finances',
  vitality: 'Body',
  mind:     'Mind',
  love:     'Relationship',
  social:   'Friends',
}

const AREA_ORDER: Dimension[] = ['family', 'career', 'wealth', 'love', 'social', 'vitality', 'mind']

const HERO_ART: Record<Dimension, ComponentType> = {
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
  @keyframes dcp-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes dcp-spin   { to{transform:rotate(360deg)} }
  ::-webkit-scrollbar { display: none; }
`

// ── Mini robot SVG for sidebar nav ────────────────────────────────────────────

function SidebarRobot({ dim, color, size = 28 }: { dim: Dimension; color: string; size?: number }) {
  const accessory = (() => {
    switch (dim) {
      case 'family':
        return <>
          <line x1="12" y1="7" x2="12" y2="2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
          <line x1="12" y1="4" x2="9"  y2="1" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="12" y1="4" x2="15" y2="1" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
        </>
      case 'career':
        return <>
          <line x1="12" y1="7" x2="12" y2="2" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="12" cy="1.5" r="1.5" fill={color}/>
        </>
      case 'wealth':
        return <>
          <circle cx="12" cy="2.5" r="2.5" fill={color} opacity="0.9"/>
          <text x="12" y="4" textAnchor="middle" fill="#130E2A" fontSize="3" fontWeight="700" fontFamily="sans-serif">$</text>
        </>
      case 'love':
        return <path d="M10 5 C10 3.5 8 2 8 3.5 C8 5 10 6.5 12 8 C14 6.5 16 5 16 3.5 C16 2 14 3.5 14 5 C13 4 12 3 12 3 C12 3 11 4 10 5Z" fill={color} transform="scale(0.7) translate(5,-2)"/>
      case 'social':
        return <path d="M8 4 Q10 2 12 4 Q14 6 16 4" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      case 'vitality':
        return <path d="M12 7 C11 5 9 4 10 2 C10.5 3 11.5 3.5 12 2 C12.5 3.5 13.5 3 14 2 C15 4 13 5 12 7Z" fill={color} opacity="0.9"/>
      case 'mind':
        return <>
          <polygon points="8,7 16,7 14,3 10,3" fill={color} opacity="0.9"/>
          <rect x="7" y="6.5" width="10" height="1.5" rx="0.75" fill={color}/>
        </>
      default:
        return null
    }
  })()

  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 24 32" style={{ flexShrink: 0 }}>
      {accessory}
      {/* Ears */}
      <rect x="1"  y="9" width="3" height="7" rx="1.5" fill={color} opacity="0.65"/>
      <rect x="20" y="9" width="3" height="7" rx="1.5" fill={color} opacity="0.65"/>
      {/* Head */}
      <rect x="4" y="7" width="16" height="14" rx="5" fill={color}/>
      {/* Eyes */}
      <rect x="7"  y="11" width="4" height="4" rx="1.5" fill="#130E2A"/>
      <rect x="13" y="11" width="4" height="4" rx="1.5" fill="#130E2A"/>
      <circle cx="8"  cy="12" r="1.2" fill="white" opacity="0.8"/>
      <circle cx="14" cy="12" r="1.2" fill="white" opacity="0.8"/>
      {/* Smile */}
      <path d="M9 18 Q12 20 15 18" stroke="#130E2A" strokeWidth="1" fill="none" strokeLinecap="round"/>
      {/* Body */}
      <rect x="6" y="22" width="12" height="9" rx="4" fill={color} opacity="0.8"/>
    </svg>
  )
}

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
  const router = useRouter()
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
    <div style={{ ...font, minHeight: '100dvh', background: '#0D0820', display: 'flex', overflow: 'hidden' }}>
      <style>{PAGE_CSS}</style>

      {/* ── Left sidebar: dimension switcher ──────────────────────────────── */}
      <div style={{
        width: 220, flexShrink: 0,
        background: '#1A1335',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', padding: '20px 0',
      }}>
        {/* Logo/home link */}
        <div
          role="button" tabIndex={0}
          onClick={() => router.push('/dashboard')}
          onKeyDown={e => e.key === 'Enter' && router.push('/dashboard')}
          style={{ padding: '0 20px 20px', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em' }}>
            ← Dashboard
          </div>
        </div>

        <div style={{ padding: '0 12px 8px', fontSize: 9, fontWeight: 600, letterSpacing: '1.6px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
          Life Areas
        </div>

        {AREA_ORDER.map(dim => {
          const dimColor = DIM_COLORS[dim]
          const dimScore = dimScores[dim] ?? null
          const slug = DIMENSION_TO_SLUG[dim]
          const isActive = dim === dimension

          return (
            <button
              key={dim}
              type="button"
              onClick={() => router.push(`/${slug}`)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                background: isActive ? `${dimColor}14` : 'transparent',
                border: 'none',
                borderLeft: isActive ? `3px solid ${dimColor}` : '3px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}
            >
              <SidebarRobot dim={dim} color={dimColor} size={24} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? dimColor : 'rgba(255,255,255,0.65)' }}>
                  {AREA_LABELS[dim]}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                  {CHARACTERS[dim].name}
                </div>
              </div>
              {dimScore != null && (
                <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? dimColor : 'rgba(255,255,255,0.35)' }}>
                  {dimScore}
                </span>
              )}
            </button>
          )
        })}
      </div>

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
            <HeroArt />
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

        {/* Score block */}
        <ScoreBlock
          dimension={dimension}
          xp={xp}
          userId={userId}
          accentColor={accentColor}
        />

        {/* Quest vision */}
        <LegendCard
          characterName={char.name}
          dimensionLabel={char.categoryLabel}
          dimension={dimension}
          vision={quest?.vision ?? null}
          accentColor={accentColor}
        />

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

      {/* XP toasts */}
      <XpToastOverlay xpToast={xpToast} levelUpToast={levelUpToast} />
    </div>
  )
}
