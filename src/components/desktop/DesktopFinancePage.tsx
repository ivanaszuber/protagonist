'use client'

import React, { useEffect, useState, type CSSProperties } from 'react'
import { getUserId } from '@/lib/user'
import { CHARACTERS, type Dimension } from '@/lib/character'
import { DIMENSION_TO_SLUG, getTierName } from '@/lib/tierName'
import { getLevel, getLevelProgress } from '@/lib/xp'
import { getMedalDefinitions } from '@/lib/medals'
import { computeVaultDerived, computeFireTrajectoryYear, formatGbp, type BudgetCategory, type VaultSettings } from '@/lib/vault'
import { ScoreBlock } from '@/components/characters/ScoreBlock'
import { MainQuestsSection, type MainQuestMilestone } from '@/components/characters/MainQuestsSection'
import { BossCard } from '@/components/characters/BossCard'
import { HallOfKills } from '@/components/characters/HallOfKills'
import { MedalsRow } from '@/components/characters/MedalsRow'
import { LegendCard } from '@/components/characters/LegendCard'
import { VaultNetWorthCard } from '@/components/vault/VaultNetWorthCard'
import { VaultCharacterLarge } from '@/components/characters/CharacterHeroArt'
import { DesktopLeftSidebar, DIM_COLORS } from './DesktopLeftSidebar'
import DesktopTopNav from './DesktopTopNav'
import { DesktopOracleModal } from './DesktopOracleModal'
import { openOracle } from '@/lib/oracle-events'
import { XpToastOverlay, showXpFeedback, type LevelUpToast, type XpToast } from '@/components/XpToastOverlay'
import type { BossBattle, BossKillRow, BossTask } from '@/lib/bosses'

// ── Types ──────────────────────────────────────────────────────────────────────

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

interface VaultApiResponse {
  settings: VaultSettings
  totalNetWorth: number
  monthlySurplus: number
  shadow5yr: number
  fireProgressPct: number
  coinsFilled: number
  coinsPartialPct: number
  coinsToGoal: number
  goalCoinIndex: number
}

interface SpendingInsight {
  type: 'warning' | 'win' | 'tip'
  text: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ACCENT = DIM_COLORS.wealth // '#4DC4FF'
const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

const PAGE_CSS = `
  @keyframes dfp-float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes dfp-orb-a    { from{transform:rotate(0deg) translateX(30px) rotate(0deg)} to{transform:rotate(360deg) translateX(30px) rotate(-360deg)} }
  @keyframes dfp-orb-b    { from{transform:rotate(130deg) translateX(30px) rotate(-130deg)} to{transform:rotate(490deg) translateX(30px) rotate(-490deg)} }
  @keyframes dfp-orb-c    { from{transform:rotate(250deg) translateX(30px) rotate(-250deg)} to{transform:rotate(610deg) translateX(30px) rotate(-610deg)} }
  ::-webkit-scrollbar { display: none; }
`

// ── Score ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score, color, size = 120 }: { score: number; color: string; size?: number }) {
  const r = 42
  const cx = 56
  const circumference = 2 * Math.PI * r
  const filled = (score / 10) * circumference
  const offset = circumference - filled
  return (
    <svg width={size} height={size} viewBox="0 0 112 112">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${circumference}`} strokeDashoffset={`${offset}`}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        filter={`drop-shadow(0 0 6px ${color}88)`}
      />
      <text x={cx} y={cx + 2} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="28" fontWeight="700" fontFamily="'Space Grotesk', sans-serif">{score}</text>
      <text x={cx} y={cx + 18} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="'Space Grotesk', sans-serif" letterSpacing="1.5">SCORE</text>
    </svg>
  )
}

// ── Goal ring ──────────────────────────────────────────────────────────────────

function GoalRing({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 18
  const cx = 22
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(100, pct) / 100) * circ
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text x={cx} y={cx + 4} textAnchor="middle" fill={color} fontSize="9" fontWeight="700" fontFamily="'Space Grotesk', sans-serif">{label}</text>
    </svg>
  )
}

// ── Edit Vault Drawer ──────────────────────────────────────────────────────────

interface EditVaultDrawerProps {
  open: boolean
  onClose: () => void
  settings: VaultSettings
  userId: string
  onSaved: (s: VaultSettings) => void
}

function EditVaultDrawer({ open, onClose, settings, userId, onSaved }: EditVaultDrawerProps) {
  const [form, setForm] = useState<VaultSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setForm(settings) }, [settings])

  function patch<K extends keyof VaultSettings>(key: K, value: VaultSettings[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function patchCat(index: number, budget: number) {
    setForm(prev => {
      const cats = [...prev.budget_categories]
      cats[index] = { ...cats[index], budget }
      return { ...prev, budget_categories: cats }
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/vault/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, patch: form }),
      })
      const data = (await res.json()) as { settings: VaultSettings }
      onSaved(data.settings ?? form)
      window.dispatchEvent(new CustomEvent('protagonist:vault-updated'))
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 700)
    } finally {
      setSaving(false)
    }
  }

  const derived = computeVaultDerived(form)
  const fireYear = computeFireTrajectoryYear(form)
  const budgetTotal = form.budget_categories.reduce((s, c) => s + c.budget, 0)

  const inputSt: CSSProperties = {
    ...font, background: '#0D0820', border: '0.5px solid #3D2070',
    borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#E8E0F0',
    textAlign: 'right' as const, width: 100,
  }

  const sectionHead: CSSProperties = {
    ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
    letterSpacing: '1.4px', textTransform: 'uppercase' as const,
    padding: '10px 16px 6px', display: 'block',
  }

  const rowSt: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.04)', gap: 10,
  }

  const labelSt: CSSProperties = { ...font, fontSize: 12, color: '#C0B0E0', flex: 1 }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 900, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
        background: '#0F0B1F', borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 901, overflowY: 'auto', scrollbarWidth: 'none',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Drawer header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <span style={{ ...font, fontSize: 15, fontWeight: 600, color: '#E8E0F0' }}>Edit Vault</span>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* Net worth */}
        <span style={sectionHead}>Net worth</span>
        <div style={{ background: '#140C28', borderRadius: 10, margin: '0 12px 8px', border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={rowSt}>
            <span style={labelSt}>Invested (£)</span>
            <input type="number" value={form.invested} onChange={e => patch('invested', Number(e.target.value) || 0)} style={inputSt} />
          </div>
          <div style={rowSt}>
            <span style={labelSt}>Cash & savings (£)</span>
            <input type="number" value={form.cash} onChange={e => patch('cash', Number(e.target.value) || 0)} style={inputSt} />
          </div>
          <div style={{ ...rowSt, borderBottom: 'none' }}>
            <span style={labelSt}>Total net worth</span>
            <span style={{ ...font, fontSize: 13, color: ACCENT, fontWeight: 600 }}>{formatGbp(derived.totalNetWorth)}</span>
          </div>
        </div>

        {/* Income */}
        <span style={sectionHead}>Income</span>
        <div style={{ background: '#140C28', borderRadius: 10, margin: '0 12px 8px', border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={rowSt}>
            <span style={labelSt}>Monthly net income (£)</span>
            <input type="number" value={form.monthly_income} onChange={e => patch('monthly_income', Number(e.target.value) || 0)} style={inputSt} />
          </div>
          <div style={{ ...rowSt, borderBottom: 'none' }}>
            <span style={labelSt}>Savings target / mo (£)</span>
            <input type="number" value={form.monthly_savings_target} onChange={e => patch('monthly_savings_target', Number(e.target.value) || 0)} style={inputSt} />
          </div>
        </div>

        {/* Budget categories */}
        <span style={sectionHead}>Monthly budget</span>
        <div style={{ background: '#140C28', borderRadius: 10, margin: '0 12px 8px', border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          {form.budget_categories.map((cat: BudgetCategory, i: number) => (
            <div key={cat.key} style={{ ...rowSt, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <span style={labelSt}>{cat.label}</span>
              </div>
              <input type="number" value={cat.budget} onChange={e => patchCat(i, Number(e.target.value) || 0)} style={{ ...inputSt, width: 80 }} />
            </div>
          ))}
          <div style={{ ...rowSt }}>
            <span style={labelSt}>Total budget</span>
            <span style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{formatGbp(budgetTotal)}</span>
          </div>
          <div style={{ ...rowSt, borderBottom: 'none' }}>
            <span style={labelSt}>Monthly surplus</span>
            <span style={{ ...font, fontSize: 12, color: derived.monthlySurplus >= 0 ? '#6EE7A4' : '#FF7A65', fontWeight: 600 }}>{formatGbp(derived.monthlySurplus)}</span>
          </div>
        </div>

        {/* FIRE */}
        <span style={sectionHead}>FIRE target</span>
        <div style={{ background: '#140C28', borderRadius: 10, margin: '0 12px 8px', border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={rowSt}>
            <span style={labelSt}>FIRE number (£)</span>
            <input type="number" value={form.fire_number} onChange={e => patch('fire_number', Number(e.target.value) || 0)} style={inputSt} />
          </div>
          <div style={rowSt}>
            <span style={labelSt}>Target year</span>
            <input type="number" value={form.fire_target_year} onChange={e => patch('fire_target_year', Number(e.target.value) || 2030)} style={inputSt} />
          </div>
          <div style={{ ...rowSt, borderBottom: 'none' }}>
            <span style={labelSt}>Trajectory</span>
            <span style={{ ...font, fontSize: 12, color: ACCENT }}>{fireYear ? String(fireYear) : '—'}</span>
          </div>
        </div>

        {/* Goals */}
        <span style={sectionHead}>Short-term goal</span>
        <div style={{ background: '#140C28', borderRadius: 10, margin: '0 12px 16px', border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={rowSt}>
            <span style={labelSt}>Net worth goal (£)</span>
            <input type="number" value={form.nw_goal} onChange={e => patch('nw_goal', Number(e.target.value) || 0)} style={inputSt} />
          </div>
          <div style={{ ...rowSt, borderBottom: 'none' }}>
            <span style={labelSt}>Each coin = (£)</span>
            <input type="number" value={form.coin_denomination} onChange={e => patch('coin_denomination', Number(e.target.value) || 10000)} style={inputSt} />
          </div>
        </div>

        {/* Save button */}
        <div style={{ padding: '0 12px 40px' }}>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              ...font, width: '100%', padding: 12,
              background: saved ? '#1D9E75' : ACCENT,
              color: '#012030', border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.75 : 1, transition: 'background 0.2s',
            }}
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save vault settings'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function DesktopFinancePage() {
  const userId = getUserId()
  const char = CHARACTERS.wealth
  const characterSlug = DIMENSION_TO_SLUG.wealth
  const medalDefs = getMedalDefinitions('wealth')

  // ── State ────────────────────────────────────────────────────────────────────
  const [vault, setVault] = useState<VaultApiResponse | null>(null)
  const [quest, setQuest] = useState<QuestData | null>(null)
  const [dimScores, setDimScores] = useState<Record<string, number>>({})
  const [insights, setInsights] = useState<{ summary: string; insights: SpendingInsight[] } | null>(null)
  const [dimensionInsight, setDimensionInsight] = useState<string | null>(null)
  const [boss, setBoss] = useState<BossBattle | null>(null)
  const [escapedBoss, setEscapedBoss] = useState<BossBattle | null>(null)
  const [bossTasks, setBossTasks] = useState<BossTask[]>([])
  const [bossKills, setBossKills] = useState<BossKillRow[]>([])
  const [killStats, setKillStats] = useState({ slain: 0, escaped: 0 })
  const [earnedMedals, setEarnedMedals] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [xpToast, setXpToast] = useState<XpToast | null>(null)
  const [levelUpToast, setLevelUpToast] = useState<LevelUpToast | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  // ── Data loading ─────────────────────────────────────────────────────────────

  async function loadBossAndMedals(uid: string) {
    const [bossRes, killsRes, medalsRes] = await Promise.allSettled([
      fetch(`/api/bosses/active?userId=${encodeURIComponent(uid)}&dimension=wealth`).then(r => r.json()),
      fetch(`/api/bosses/kills?userId=${encodeURIComponent(uid)}&dimension=wealth`).then(r => r.json()),
      fetch(`/api/medals/check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, dimension: 'wealth' }) }).then(r => r.json()),
    ])
    if (bossRes.status === 'fulfilled') {
      const d = bossRes.value as { boss?: BossBattle | null; tasks?: BossTask[]; escapedBoss?: BossBattle | null }
      setBoss(d.boss ?? null); setBossTasks(d.tasks ?? []); setEscapedBoss(d.escapedBoss ?? null)
    }
    if (killsRes.status === 'fulfilled') {
      const d = killsRes.value as { kills?: BossKillRow[]; stats?: { slain: number; escaped: number } }
      setBossKills(d.kills ?? []); setKillStats(d.stats ?? { slain: 0, escaped: 0 })
    }
    if (medalsRes.status === 'fulfilled') {
      const d = medalsRes.value as { earned?: string[] }
      setEarnedMedals(d.earned ?? [])
    }
  }

  function loadData() {
    const uid = getUserId()
    Promise.allSettled([
      fetch(`/api/quests/character/wealth?userId=${encodeURIComponent(uid)}`).then(r => r.json()),
      fetch(`/api/dimension-score?userId=${encodeURIComponent(uid)}`).then(r => r.json()),
      fetch(`/api/vault/settings?userId=${encodeURIComponent(uid)}`).then(r => r.json()),
      loadBossAndMedals(uid),
    ]).then(([questRes, scoresRes, vaultRes]) => {
      if (questRes.status === 'fulfilled') {
        const v = questRes.value as { quest?: QuestData | null }
        setQuest(v.quest ?? null)
      }
      if (scoresRes.status === 'fulfilled') {
        const v = scoresRes.value as { scores?: Record<string, number> }
        setDimScores(v.scores ?? {})
      }
      if (vaultRes.status === 'fulfilled') {
        setVault(vaultRes.value as VaultApiResponse)
      }
      setLoading(false)
    })
  }

  useEffect(() => {
    loadData()
    const onUpdate = () => loadData()
    window.addEventListener('protagonist:quest-updated', onUpdate)
    window.addEventListener('protagonist:vault-updated', onUpdate)
    return () => {
      window.removeEventListener('protagonist:quest-updated', onUpdate)
      window.removeEventListener('protagonist:vault-updated', onUpdate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Oracle spending insights (cached)
  useEffect(() => {
    if (!userId) return
    const cacheKey = `protagonist-vault-insights-${userId}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data, ts } = JSON.parse(cached) as { data: { summary: string; insights: SpendingInsight[] }; ts: number }
        if (Date.now() - ts < 6 * 60 * 60 * 1000) { // 6-hour cache
          setInsights(data)
        }
      }
    } catch { /* ignore */ }

    fetch(`/api/vault/insights?userId=${encodeURIComponent(userId)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { summary: string; insights: SpendingInsight[] } | null) => {
        if (data) {
          setInsights(data)
          try { localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() })) } catch { /* ignore */ }
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Oracle dimension insight (from identity synthesize)
  useEffect(() => {
    if (!userId) return
    const cacheKey = `protagonist-identity-${userId}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const data = JSON.parse(cached) as { dimensionInsights?: Array<{ dimension: string; insight: string }> }
        const match = data.dimensionInsights?.find(d => d.dimension === 'wealth')
        if (match) setDimensionInsight(match.insight)
      }
    } catch { /* ignore */ }
    fetch(`/api/identity/synthesize?userId=${encodeURIComponent(userId)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { dimensionInsights?: Array<{ dimension: string; insight: string }> } | null) => {
        const match = data?.dimensionInsights?.find(d => d.dimension === 'wealth')
        if (match) setDimensionInsight(match.insight)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleBossTaskComplete(taskId: string, xpReward: number) {
    const uid = getUserId()
    const res = await fetch(`/api/quests/tasks/${taskId}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid }),
    })
    const data = (await res.json()) as {
      xp_earned?: number; leveled_up?: boolean; new_level?: number
      boss?: { slain: boolean; reward_xp?: number; hp_remaining?: number }
    }
    if (res.ok) {
      const earned = data.xp_earned ?? xpReward
      setQuest(prev => prev ? { ...prev, xp: prev.xp + earned } : prev)
      showXpFeedback({ dimension: 'wealth' as Dimension }, data, setXpToast, setLevelUpToast)
      return { slain: data.boss?.slain, reward_xp: data.boss?.reward_xp, hp_remaining: data.boss?.hp_remaining }
    }
    return {}
  }

  async function refreshAfterBossSlain() {
    const uid = getUserId()
    await loadBossAndMedals(uid)
    const questRes = await fetch(`/api/quests/character/wealth?userId=${encodeURIComponent(uid)}`).then(r => r.json())
    const v = questRes as { quest?: QuestData | null }
    setQuest(v.quest ?? null)
  }

  async function deleteMilestone(milestoneId: string) {
    const uid = getUserId()
    const res = await fetch(`/api/quests/milestones?milestoneId=${encodeURIComponent(milestoneId)}&userId=${encodeURIComponent(uid)}`, { method: 'DELETE' })
    if (res.ok) setQuest(prev => prev ? { ...prev, milestones: prev.milestones.filter(m => m.id !== milestoneId) } : prev)
  }

  // ── Derived values ────────────────────────────────────────────────────────────

  const xp = quest?.xp ?? 0
  const level = getLevel(xp)
  const xpInLevel = xp % 500
  const xpProgress = getLevelProgress(xp)
  const tierLabel = getTierName(level, characterSlug)
  const currentScore = dimScores.wealth ?? Math.min(10, Math.max(1, Math.round(level * 1.5 + xpProgress)))
  const activeMilestone = quest?.milestones.find(m => !m.completed && m.is_focused) ?? quest?.milestones.find(m => !m.completed) ?? null

  const vaultSettings = vault?.settings
  const budgetCategories = vaultSettings?.budget_categories ?? []
  const budgetTotal = budgetCategories.reduce((s, c) => s + c.budget, 0)
  const totalNetWorth = vault?.totalNetWorth ?? 0
  const fireProgressPct = vault?.fireProgressPct ?? 0
  const nwGoal = vaultSettings?.nw_goal ?? 0
  const nwGoalPct = nwGoal > 0 ? Math.min(100, (totalNetWorth / nwGoal) * 100) : 0
  const fireNumber = vaultSettings?.fire_number ?? 0

  // Weekly chart: derive daily budget amounts from monthly totals
  const dailyBudget = budgetTotal > 0 ? budgetTotal / 30 : 0
  const dailyShadow = dailyBudget > 0 && vaultSettings
    ? dailyBudget * (1 + (vaultSettings.shadow_gap / Math.max(1, budgetTotal * 3)))
    : dailyBudget
  const today = new Date().getDay() // 0=Sun
  // day indices Mon=1...Sun=0, we want Mon..Sun display
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  // day multiplicators — weekend slightly higher, Fri spike
  const DAY_MULT = [1.0, 0.85, 1.1, 0.9, 1.4, 1.2, 0.95]
  const maxBarH = 80
  const maxDailySpend = dailyBudget * 1.5 || 1

  const chipIcon = (type: string) => {
    if (type === 'warning') return '🟡'
    if (type === 'win') return '🟢'
    return '💡'
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...font, minHeight: '100dvh', background: '#0D0820', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{PAGE_CSS}</style>
        <div style={{ color: '#3D3358', fontSize: 13 }}>Loading vault…</div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ ...font, height: '100dvh', background: '#0D0820', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{PAGE_CSS}</style>
      <DesktopTopNav activePage="character" animPrefix="dfp" />
      <DesktopOracleModal />

      {vaultSettings && (
        <EditVaultDrawer
          open={editOpen}
          onClose={() => setEditOpen(false)}
          settings={vaultSettings}
          userId={userId}
          onSaved={(s) => setVault(prev => prev ? { ...prev, settings: s, ...computeVaultDerived(s) } : prev)}
        />
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Left sidebar ─────────────────────────────────────────────────── */}
        <DesktopLeftSidebar
          scores={dimScores as Partial<Record<Dimension, number>>}
          activeDimension="wealth"
          showBackButton
        />

        {/* ── Center panel ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#0D0820', padding: '28px 28px 320px', minWidth: 0 }}>

          {/* Hero section */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, marginBottom: 24 }}>
            <div style={{ flexShrink: 0 }}>
              <ScoreRing score={currentScore} color={ACCENT} size={112} />
            </div>
            <div style={{ flexShrink: 0, animation: 'dfp-float 3.2s ease-in-out infinite', marginTop: -8 }}>
              <VaultCharacterLarge color={ACCENT} />
            </div>
            <div style={{ flex: 1, paddingTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 600, color: '#E8E0F0' }}>{char.categoryLabel}</span>
                <span style={{ background: `${ACCENT}18`, border: `0.5px solid ${ACCENT}40`, borderRadius: 20, padding: '3px 10px', fontSize: 10, color: ACCENT }}>{char.name}</span>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  style={{ ...font, marginLeft: 'auto', background: `rgba(77,196,255,0.08)`, border: `1px solid rgba(77,196,255,0.28)`, borderRadius: 8, padding: '5px 14px', fontSize: 11, color: ACCENT, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit Vault
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: ACCENT, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tierLabel}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>·</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Lv {level}</span>
                {killStats.slain > 0 && (
                  <>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>·</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}><strong style={{ color: ACCENT }}>{killStats.slain}</strong> challenges won</span>
                  </>
                )}
              </div>
              <div style={{ maxWidth: 320 }}>
                <div style={{ height: 4, background: '#1E0D40', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                  <div style={{ height: '100%', width: `${Math.round((xpInLevel / 500) * 100)}%`, background: ACCENT, borderRadius: 3, transition: 'width 1s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9, color: '#5A4A7A' }}>{xpInLevel} XP</span>
                  <span style={{ fontSize: 9, color: '#5A4A7A' }}>500 to Level {level + 1}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Wealth snapshot 2×2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'Net worth', value: formatGbp(totalNetWorth), sub: nwGoal > 0 ? `${nwGoalPct.toFixed(0)}% of goal` : undefined, color: ACCENT },
              { label: 'Invested', value: formatGbp(vaultSettings?.invested ?? 0), sub: 'ETFs · pension · crypto', color: undefined },
              { label: 'Cash / liquid', value: formatGbp(vaultSettings?.cash ?? 0), sub: budgetTotal > 0 ? `${((vaultSettings?.cash ?? 0) / (budgetTotal / 12)).toFixed(1)} mo buffer` : undefined, color: undefined },
              { label: 'FIRE progress', value: `${fireProgressPct.toFixed(1)}%`, sub: undefined, isBar: true, color: '#FFD47A' },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(255,255,255,0.035)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.4px', textTransform: 'uppercase' as const, marginBottom: 5 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: item.color ?? '#E8E0F0', lineHeight: 1.2 }}>{item.value}</div>
                {item.isBar ? (
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, fireProgressPct)}%`, background: '#FFD47A', borderRadius: 3 }} />
                  </div>
                ) : item.sub ? (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{item.sub}</div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Oracle's Read — spending insights */}
          {(insights || dimensionInsight) && (
            <div style={{ background: `linear-gradient(135deg, ${ACCENT}18 0%, ${ACCENT}07 100%)`, border: `1px solid ${ACCENT}35`, borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill={ACCENT}><path d="M12 2l2.4 7.6H22l-6.4 4.6 2.4 7.6L12 17.2l-6 4.6 2.4-7.6L2 9.6h7.6L12 2z"/></svg>
                <span style={{ fontSize: 9, fontWeight: 700, color: ACCENT, letterSpacing: '1.4px', textTransform: 'uppercase' as const }}>Oracle&apos;s Read · Finances</span>
              </div>
              {(insights?.summary ?? dimensionInsight) && (
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.72, margin: '0 0 12px' }}>
                  {insights?.summary ?? dimensionInsight}
                </p>
              )}
              {insights?.insights.map((chip, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, marginBottom: i < (insights.insights.length - 1) ? 6 : 0 }}>
                  <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>{chipIcon(chip.type)}</span>
                  <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>{chip.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Budget allocations */}
          {budgetCategories.length > 0 && (
            <div style={{ background: '#140C28', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)', padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.4px', textTransform: 'uppercase' as const }}>Budget allocations</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>budget / mo</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {budgetCategories.map(cat => {
                  const pct = budgetTotal > 0 ? (cat.budget / budgetTotal) * 100 : 0
                  const isHigh = pct > 30
                  const barColor = isHigh ? '#FFB347' : cat.color || ACCENT
                  return (
                    <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', width: 130, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.label}</span>
                      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', flex: 1 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.6s ease' }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 64, textAlign: 'right' as const, flexShrink: 0 }}>{formatGbp(cat.budget, true)}/mo</span>
                    </div>
                  )
                })}
              </div>
              {budgetTotal > 0 && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '0.5px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Total budget</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{formatGbp(budgetTotal)}/mo</span>
                </div>
              )}
            </div>
          )}

          {/* Weekly spending chart */}
          {dailyBudget > 0 && (
            <div style={{ background: '#140C28', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)', padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.4px', textTransform: 'uppercase' as const }}>Weekly budget pattern</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: ACCENT }} />
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Budget</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: `rgba(77,196,255,0.2)` }} />
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Shadow</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
                {DAYS.map((day, i) => {
                  const mult = DAY_MULT[i] ?? 1
                  const actualH = Math.round((dailyBudget * mult / maxDailySpend) * maxBarH)
                  const shadowH = Math.round((dailyShadow * mult / maxDailySpend) * maxBarH)
                  const isToday = (i === 0 ? 1 : i) === today || (i === 6 && today === 0)
                  const isFri = i === 4
                  const barCol = isFri ? '#FF9A5C' : ACCENT
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: maxBarH }}>
                        <div style={{ flex: 1, background: isToday ? `${barCol}cc` : barCol, borderRadius: '3px 3px 0 0', height: actualH, opacity: isToday ? 1 : 0.75 }} />
                        <div style={{ flex: 1, background: isFri ? 'rgba(255,154,92,0.22)' : 'rgba(77,196,255,0.18)', borderRadius: '3px 3px 0 0', height: Math.max(actualH - 4, shadowH) }} />
                      </div>
                      <span style={{ fontSize: 9, color: isToday ? ACCENT : 'rgba(255,255,255,0.25)', fontWeight: isToday ? 600 : 400 }}>{day}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.18)', textAlign: 'center' as const }}>
                {vaultSettings && vaultSettings.shadow_gap > 500
                  ? `Shadow gap of ${formatGbp(vaultSettings.shadow_gap, true)} — spending is outpacing budget`
                  : vaultSettings && vaultSettings.shadow_gap < -500
                    ? `Ahead of shadow by ${formatGbp(Math.abs(vaultSettings.shadow_gap), true)}`
                    : 'Based on monthly budget · shadow bars show projected account'}
              </div>
            </div>
          )}

          {/* Vault Net Worth card (existing — keeps coin/shadow mechanics) */}
          <div style={{ marginBottom: 16 }}>
            <VaultNetWorthCard userId={userId} accentColor={ACCENT} />
          </div>

          {/* Quest vision */}
          <LegendCard
            characterName={char.name}
            dimensionLabel={char.categoryLabel}
            dimension="wealth"
            vision={quest?.vision ?? null}
            accentColor={ACCENT}
            userId={userId}
            onQuestSaved={(v) => setQuest(prev => prev ? { ...prev, vision: v } : { id: '', vision: v, character_name: char.name, character_class: 'Adventurer', milestones: [], recent_tasks: [], xp: 0 })}
          />

          {/* Main Quests */}
          {quest && (
            <MainQuestsSection
              characterName={char.name}
              dimensionLabel={char.categoryLabel}
              milestones={quest.milestones}
              accentColor={ACCENT}
              questId={quest.id}
              userId={userId}
              dimension="wealth"
              onAdd={m => setQuest(prev => prev ? { ...prev, milestones: [...prev.milestones, m] } : prev)}
              onDelete={id => void deleteMilestone(id)}
              onUpdate={(id, changes) => setQuest(prev => prev ? { ...prev, milestones: prev.milestones.map(m => m.id === id ? { ...m, ...changes } : m) } : prev)}
              onFocus={focusedId => setQuest(prev => prev ? { ...prev, milestones: prev.milestones.map(m => ({ ...m, is_focused: m.id === focusedId })) } : prev)}
            />
          )}

          {/* Score block */}
          <ScoreBlock dimension="wealth" xp={xp} userId={userId} accentColor={ACCENT} />

          {/* Medals */}
          <MedalsRow definitions={medalDefs} earned={earnedMedals} accentColor={ACCENT} />
        </div>

        {/* ── Right panel ──────────────────────────────────────────────────── */}
        <div style={{ width: 300, flexShrink: 0, background: '#0F0B1F', borderLeft: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', padding: '28px 20px 60px' }}>

          {/* Oracle card */}
          <div style={{ background: 'rgba(255,122,101,0.07)', border: '1px solid rgba(255,122,101,0.18)', borderRadius: 12, padding: '16px 14px', marginBottom: 20 }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 700, letterSpacing: '1.7px', textTransform: 'uppercase' as const, display: 'block', marginBottom: 14 }}>The Oracle</span>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', margin: -3, width: 6, height: 6, borderRadius: '50%', background: ACCENT, animation: 'dfp-orb-a 3.5s linear infinite' }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', margin: -2.5, width: 5, height: 5, borderRadius: '50%', background: '#00D4B8', opacity: 0.7, animation: 'dfp-orb-b 3.5s linear infinite' }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', margin: -2, width: 4, height: 4, borderRadius: '50%', background: '#6EE7A4', animation: 'dfp-orb-c 5s linear infinite' }} />
                <svg width="52" height="60" viewBox="0 0 58 66" style={{ animation: 'dfp-float 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}>
                  <polygon points="16,16 22,6 29,13 36,6 42,16" fill="#FFB347"/>
                  <rect x="14" y="14" width="30" height="3" rx="1.5" fill="#FFB347" opacity="0.7"/>
                  <rect x="1" y="25" width="4" height="8" rx="2" fill="#FF7A65" opacity="0.7"/>
                  <rect x="53" y="25" width="4" height="8" rx="2" fill="#FF7A65" opacity="0.7"/>
                  <rect x="5" y="17" width="48" height="32" rx="9" fill="#FF7A65"/>
                  <rect x="11" y="24" width="14" height="14" rx="4" fill="#130E2A"/>
                  <rect x="33" y="24" width="14" height="14" rx="4" fill="#130E2A"/>
                  <circle cx="15" cy="28" r="3" fill="white" opacity="0.9"/>
                  <circle cx="37" cy="28" r="3" fill="white" opacity="0.9"/>
                  <circle cx="17" cy="30" r="2" fill="#130E2A"/>
                  <circle cx="39" cy="30" r="2" fill="#130E2A"/>
                  <path d="M20 39 Q29 44 38 39" stroke="#130E2A" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                  <rect x="12" y="50" width="12" height="14" rx="5" fill="#FF7A65" opacity="0.85"/>
                  <rect x="34" y="50" width="12" height="14" rx="5" fill="#FF7A65" opacity="0.85"/>
                </svg>
              </div>
            </div>
            <div style={{ fontSize: 11.5, fontStyle: 'italic', lineHeight: 1.55, textAlign: 'center' as const, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
              {insights?.summary
                ? `"${insights.summary.length > 90 ? insights.summary.slice(0, 90) + '…' : insights.summary}"`
                : `"Ask me anything about your financial journey."`}
            </div>
            <button type="button" onClick={() => openOracle()} style={{ ...font, width: '100%', background: 'transparent', color: 'rgba(255,255,255,0.75)', padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 500, border: '1.5px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}>
              Chat with Oracle →
            </button>
          </div>

          {/* Goals section */}
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.7px', textTransform: 'uppercase' as const, display: 'block', marginBottom: 10 }}>Financial Goals</span>

          {/* Net worth goal */}
          {nwGoal > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 13px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <GoalRing pct={nwGoalPct} color={ACCENT} label={`${Math.round(nwGoalPct)}%`} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500, marginBottom: 2 }}>Net worth goal</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{formatGbp(totalNetWorth, true)} / {formatGbp(nwGoal, true)}</div>
                </div>
              </div>
            </div>
          )}

          {/* FIRE goal */}
          {fireNumber > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 13px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <GoalRing pct={fireProgressPct} color="#FFD47A" label={`${Math.round(fireProgressPct)}%`} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500, marginBottom: 2 }}>FIRE number</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{formatGbp(totalNetWorth, true)} / {formatGbp(fireNumber, true)}</div>
                </div>
              </div>
            </div>
          )}

          {/* If no goals set yet */}
          {nwGoal === 0 && fireNumber === 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 13px', marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', margin: 0 }}>Set your net worth goal and FIRE number in Edit Vault to track progress here.</p>
            </div>
          )}

          {/* Edit vault CTA */}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            style={{ ...font, width: '100%', background: `rgba(77,196,255,0.07)`, border: `1px solid rgba(77,196,255,0.22)`, borderRadius: 10, padding: 10, fontSize: 11.5, color: ACCENT, cursor: 'pointer', fontWeight: 500, marginTop: 4 }}
          >
            Edit Vault & goals →
          </button>

          {/* Boss challenge */}
          <div style={{ marginTop: 20 }}>
            <BossCard
              characterName={char.name}
              dimensionLabel={char.categoryLabel}
              dimension="wealth"
              mainQuestTitle={activeMilestone?.title ?? null}
              boss={boss}
              escapedBoss={escapedBoss}
              tasks={bossTasks}
              onTaskComplete={handleBossTaskComplete}
              onBossSlain={refreshAfterBossSlain}
            />
          </div>

          {/* Hall of Victories */}
          <HallOfKills kills={bossKills} stats={killStats} />
        </div>
      </div>

      <XpToastOverlay xpToast={xpToast} levelUpToast={levelUpToast} />
    </div>
  )
}
