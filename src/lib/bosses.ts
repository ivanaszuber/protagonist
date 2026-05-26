import { addQuestDimensionXp, getQuestDimensionXp, isQuestDbConfigured } from '@/lib/quest-db'
import { supabase } from '@/lib/supabase'
import { saveDimensionMemory } from '@/lib/db'

export const XP_ESCAPE_PENALTY = 50

export interface BossBattle {
  id: string
  user_id: string
  dimension: string
  quest_id: string | null
  name: string
  hp_total: number
  hp_remaining: number
  deadline: string
  status: 'active' | 'slain' | 'escaped'
  reward_xp: number
  slain_at: string | null
  escaped_at: string | null
  created_at: string
}

export interface BossTask {
  id: string
  title: string
  task_date: string | null
  completed: boolean
  hp_damage: number
  xp_reward: number
}

export interface BossKillRow {
  id: string
  boss_name: string
  quest_name: string | null
  outcome: 'slain' | 'escaped'
  hp_total: number | null
  tasks_completed: number | null
  days_taken: number | null
  xp_awarded: number
  killed_at: string
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export async function processEscapedBosses(
  userId: string,
  dimension: string
): Promise<BossBattle[]> {
  if (!isQuestDbConfigured()) return []

  const today = todayDate()
  const { data: expired } = await supabase
    .from('boss_battles')
    .select('*')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('status', 'active')
    .lt('deadline', today)

  const escaped: BossBattle[] = []

  for (const row of expired ?? []) {
    const boss = row as BossBattle
    await supabase
      .from('boss_battles')
      .update({
        status: 'escaped',
        escaped_at: new Date().toISOString(),
      })
      .eq('id', boss.id)

    const currentXp = await getQuestDimensionXp(userId, dimension)
    const newXp = Math.max(0, currentXp - XP_ESCAPE_PENALTY)
    await supabase.from('quest_dimension_xp').upsert(
      {
        user_id: userId,
        dimension,
        xp: newXp,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,dimension' }
    )

    const { data: quest } = boss.quest_id
      ? await supabase.from('main_quests').select('vision').eq('id', boss.quest_id).maybeSingle()
      : { data: null }

    await supabase.from('boss_kills').insert({
      user_id: userId,
      dimension,
      boss_battle_id: boss.id,
      boss_name: boss.name,
      quest_name: quest?.vision ?? null,
      outcome: 'escaped',
      hp_total: boss.hp_total,
      tasks_completed: boss.hp_total - boss.hp_remaining,
      days_taken: null,
      xp_awarded: -XP_ESCAPE_PENALTY,
    })

    escaped.push({ ...boss, status: 'escaped' })
  }

  return escaped
}

export async function getActiveBoss(
  userId: string,
  dimension: string
): Promise<BossBattle | null> {
  if (!isQuestDbConfigured()) return null

  await processEscapedBosses(userId, dimension)

  const { data } = await supabase
    .from('boss_battles')
    .select('*')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .eq('status', 'active')
    .maybeSingle()

  return data as BossBattle | null
}

export async function getBossTasks(
  userId: string,
  bossId: string
): Promise<BossTask[]> {
  if (!isQuestDbConfigured()) return []

  const { data } = await supabase
    .from('tasks')
    .select('id, title, task_date, completed, hp_damage, xp_reward')
    .eq('user_id', userId)
    .eq('boss_battle_id', bossId)
    .order('task_date', { ascending: true })
    .order('created_at', { ascending: true })

  return (data ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    task_date: t.task_date as string | null,
    completed: Boolean(t.completed),
    hp_damage: (t.hp_damage as number) ?? 1,
    xp_reward: (t.xp_reward as number) ?? 50,
  }))
}

export async function getBossKillStats(
  userId: string,
  dimension: string
): Promise<{ slain: number; escaped: number }> {
  if (!isQuestDbConfigured()) return { slain: 0, escaped: 0 }

  const [killsRes, battlesRes] = await Promise.all([
    supabase
      .from('boss_kills')
      .select('outcome, boss_battle_id')
      .eq('user_id', userId)
      .eq('dimension', dimension),
    // Fallback: count slain boss_battles not yet in boss_kills
    supabase
      .from('boss_battles')
      .select('id, status')
      .eq('user_id', userId)
      .eq('dimension', dimension)
      .eq('status', 'slain'),
  ])

  const killRows = (killsRes.data ?? []) as { outcome: string; boss_battle_id?: string | null }[]
  let slain = 0
  let escaped = 0
  const killBossIds = new Set<string>()
  for (const row of killRows) {
    if (row.outcome === 'slain') slain++
    if (row.outcome === 'escaped') escaped++
    if (row.boss_battle_id) killBossIds.add(row.boss_battle_id)
  }

  // Add slain battles that have no boss_kills record
  for (const b of battlesRes.data ?? []) {
    if (!killBossIds.has(b.id as string)) slain++
  }

  return { slain, escaped }
}

export async function getBossKills(
  userId: string,
  dimension: string
): Promise<BossKillRow[]> {
  if (!isQuestDbConfigured()) return []

  const [killsRes, battlesRes] = await Promise.all([
    supabase
      .from('boss_kills')
      .select('*')
      .eq('user_id', userId)
      .eq('dimension', dimension)
      .order('killed_at', { ascending: false }),
    // Fallback: include slain boss_battles that have no boss_kills entry
    supabase
      .from('boss_battles')
      .select('*')
      .eq('user_id', userId)
      .eq('dimension', dimension)
      .eq('status', 'slain')
      .order('slain_at', { ascending: false }),
  ])

  const kills = (killsRes.data ?? []) as (BossKillRow & { boss_battle_id?: string })[]
  const killBossIds = new Set(kills.map((k) => k.boss_battle_id).filter(Boolean))

  // Synthesize BossKillRow entries for slain battles that aren't in boss_kills yet
  for (const b of battlesRes.data ?? []) {
    if (killBossIds.has(b.id as string)) continue
    const battle = b as BossBattle
    const slainAt = battle.slain_at ?? battle.created_at
    const daysTaken = battle.slain_at
      ? Math.max(1, Math.ceil((new Date(battle.slain_at).getTime() - new Date(battle.created_at).getTime()) / 86400000))
      : null
    kills.push({
      id: battle.id,
      boss_name: battle.name,
      quest_name: null,
      outcome: 'slain',
      hp_total: battle.hp_total,
      tasks_completed: battle.hp_total - battle.hp_remaining,
      days_taken: daysTaken,
      xp_awarded: battle.reward_xp,
      killed_at: slainAt,
    } as BossKillRow)
  }

  // Sort by killed_at descending
  kills.sort(
    (a, b) => new Date(b.killed_at).getTime() - new Date(a.killed_at).getTime()
  )

  return kills as BossKillRow[]
}

export async function decrementBossHp(
  bossId: string,
  damage: number
): Promise<{ boss: BossBattle | null; slain: boolean }> {
  const { data: boss } = await supabase
    .from('boss_battles')
    .select('*')
    .eq('id', bossId)
    .single()

  if (!boss) return { boss: null, slain: false }

  const remaining = Math.max(0, (boss.hp_remaining as number) - damage)
  const slain = remaining === 0

  await supabase.from('boss_battles').update({ hp_remaining: remaining }).eq('id', bossId)

  return {
    boss: { ...(boss as BossBattle), hp_remaining: remaining },
    slain,
  }
}

export async function slayBoss(
  userId: string,
  bossId: string
): Promise<{
  rewardXp: number
  dimension: string
  bossName: string
}> {
  const { data: boss } = await supabase
    .from('boss_battles')
    .select('*')
    .eq('id', bossId)
    .eq('user_id', userId)
    .single()

  if (!boss) throw new Error('Boss not found')

  const b = boss as BossBattle
  if (b.status === 'slain') {
    return {
      rewardXp: b.reward_xp,
      dimension: b.dimension,
      bossName: b.name,
    }
  }
  const tasksCompleted = b.hp_total - b.hp_remaining

  await supabase
    .from('boss_battles')
    .update({
      status: 'slain',
      hp_remaining: 0,
      slain_at: new Date().toISOString(),
    })
    .eq('id', bossId)

  const { totalXp } = await addQuestDimensionXp(userId, b.dimension, b.reward_xp)

  const { data: quest } = b.quest_id
    ? await supabase.from('main_quests').select('vision').eq('id', b.quest_id).maybeSingle()
    : { data: null }

  const created = new Date(b.created_at)
  const slain = new Date()
  const daysTaken = Math.max(
    1,
    Math.ceil((slain.getTime() - created.getTime()) / 86400000)
  )

  await supabase.from('boss_kills').insert({
    user_id: userId,
    dimension: b.dimension,
    boss_battle_id: bossId,
    boss_name: b.name,
    quest_name: quest?.vision ?? null,
    outcome: 'slain',
    hp_total: b.hp_total,
    tasks_completed: tasksCompleted,
    days_taken: daysTaken,
    xp_awarded: b.reward_xp,
  })

  void totalXp

  // Passive memory: Oracle and Witness learn about challenge conquest
  const today = new Date().toISOString().split('T')[0]
  const questContext = quest?.vision ? ` (quest: ${quest.vision})` : ''
  const memory = `[${today}] Conquered challenge "${b.name}"${questContext} — completed all ${b.hp_total} tasks in ${daysTaken} day${daysTaken === 1 ? '' : 's'}, earning ${b.reward_xp} XP.`
  void saveDimensionMemory(b.dimension, memory, 'challenge_conquest', 8, userId)

  return {
    rewardXp: b.reward_xp,
    dimension: b.dimension,
    bossName: b.name,
  }
}

export interface CreateBossPayload {
  name: string
  deadline: string
  hp_total: number
  reward_xp?: number
  quest_id?: string | null
  tasks: Array<{
    title: string
    due_date: string
    hp_damage: number
    xp_reward?: number
    milestone_id?: string | null
  }>
}

export async function createBoss(
  userId: string,
  dimension: string,
  payload: CreateBossPayload
): Promise<BossBattle> {
  const { data: boss, error } = await supabase
    .from('boss_battles')
    .insert({
      user_id: userId,
      dimension,
      quest_id: payload.quest_id ?? null,
      name: payload.name,
      hp_total: payload.hp_total,
      hp_remaining: payload.hp_total,
      deadline: payload.deadline,
      status: 'active',
      reward_xp: payload.reward_xp ?? 150,
    })
    .select()
    .single()

  if (error || !boss) throw new Error(error?.message ?? 'Failed to create boss')

  for (const task of payload.tasks) {
    await supabase.from('tasks').insert({
      user_id: userId,
      dimension,
      title: task.title,
      task_date: task.due_date,
      hp_damage: task.hp_damage,
      xp_reward: task.xp_reward ?? 50,
      boss_battle_id: boss.id,
      milestone_id: task.milestone_id ?? null,
    })
  }

  return boss as BossBattle
}
