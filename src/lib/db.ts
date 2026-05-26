import { supabase, isSupabaseConfigured } from './supabase'
import { getUserId } from './user'
import {
  DimensionId,
  Quest,
  CheckInData,
  DimensionXPState,
  INITIAL_XP,
} from '@/types'

function todayDate(): string {
  return new Date().toISOString().split('T')[0]
}

// ── CHECK-INS ──────────────────────────────────────────

export async function saveCheckIn(data: CheckInData & { transcript: string }) {
  if (!isSupabaseConfigured()) return

  const userId = getUserId()
  const { error } = await supabase.from('check_ins').insert({
    user_id: userId,
    date: todayDate(),
    transcript: data.transcript,
    energy_level: data.energyLevel,
    mood: data.mood,
    social_battery: data.socialBattery,
    main_concern: data.mainConcern,
    main_desire: data.mainDesire,
    arc_response: data.arcResponse,
  })
  if (error) console.error('saveCheckIn error:', error)
}

export async function getTodayCheckIn(): Promise<CheckInData | null> {
  if (!isSupabaseConfigured()) return null

  const userId = getUserId()
  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .eq('date', todayDate())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return {
    energyLevel: data.energy_level,
    mood: data.mood,
    socialBattery: data.social_battery,
    mainConcern: data.main_concern ?? '',
    mainDesire: data.main_desire ?? '',
    arcResponse: data.arc_response ?? '',
  }
}

// ── QUESTS ─────────────────────────────────────────────

export async function deleteTodayQuests(): Promise<void> {
  if (!isSupabaseConfigured()) return

  const userId = getUserId()
  const { error } = await supabase
    .from('quests')
    .delete()
    .eq('user_id', userId)
    .eq('date', todayDate())

  if (error) console.error('deleteTodayQuests error:', error)
}

export async function saveQuests(quests: Quest[]) {
  if (!isSupabaseConfigured()) return

  const userId = getUserId()
  const today = todayDate()

  const rows = quests.map((q) => ({
    id: q.id,
    user_id: userId,
    date: today,
    dimension_id: q.dimensionId,
    title: q.title,
    description: q.description,
    xp_reward: q.xpReward,
    energy_required: q.energyRequired,
    champion_name: q.championName,
    status: 'pending',
  }))

  const { error } = await supabase.from('quests').upsert(rows, { onConflict: 'id' })
  if (error) console.error('saveQuests error:', error)
}

export async function getTodayQuests(): Promise<Quest[]> {
  if (!isSupabaseConfigured()) return []

  const userId = getUserId()
  const { data, error } = await supabase
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .eq('date', todayDate())
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    dimensionId: row.dimension_id as DimensionId,
    title: row.title,
    description: row.description ?? '',
    xpReward: row.xp_reward ?? 100,
    energyRequired: row.energy_required ?? 5,
    championName: row.champion_name ?? '',
  }))
}

export async function markQuestComplete(
  questId: string,
  xpAwarded: number,
  proofTranscript: string,
  arcResponse: string
) {
  if (!isSupabaseConfigured()) return

  const { error } = await supabase
    .from('quests')
    .update({
      status: 'completed',
      xp_awarded: xpAwarded,
      proof_transcript: proofTranscript,
      arc_proof_response: arcResponse,
      completed_at: new Date().toISOString(),
    })
    .eq('id', questId)

  if (error) console.error('markQuestComplete error:', error)
}

export async function getCompletedQuestIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set()

  const userId = getUserId()
  const { data, error } = await supabase
    .from('quests')
    .select('id')
    .eq('user_id', userId)
    .eq('date', todayDate())
    .eq('status', 'completed')

  if (error || !data) return new Set()
  return new Set(data.map((row) => row.id))
}

// ── DIMENSION XP ───────────────────────────────────────

export async function loadDimensionXP(): Promise<DimensionXPState> {
  if (!isSupabaseConfigured()) return { ...INITIAL_XP }

  const userId = getUserId()
  const { data, error } = await supabase
    .from('dimension_xp')
    .select('dimension_id, total_xp')
    .eq('user_id', userId)

  if (error || !data) return { ...INITIAL_XP }

  const xp = { ...INITIAL_XP }
  data.forEach((row) => {
    xp[row.dimension_id as DimensionId] = row.total_xp
  })
  return xp
}

export async function addDimensionXP(
  dimensionId: DimensionId,
  amount: number
): Promise<void> {
  if (!isSupabaseConfigured()) return

  const userId = getUserId()

  const { error } = await supabase.rpc('increment_xp', {
    p_user_id: userId,
    p_dimension_id: dimensionId,
    p_amount: amount,
  })

  if (error) {
    const current = await supabase
      .from('dimension_xp')
      .select('total_xp')
      .eq('user_id', userId)
      .eq('dimension_id', dimensionId)
      .maybeSingle()

    const currentXP = current.data?.total_xp ?? 0
    const { error: upsertError } = await supabase.from('dimension_xp').upsert(
      {
        user_id: userId,
        dimension_id: dimensionId,
        total_xp: currentXP + amount,
      },
      { onConflict: 'user_id,dimension_id' }
    )
    if (upsertError) console.error('addDimensionXP fallback error:', upsertError)
  }
}

// ── MEMORIES (for specialist agents) ──────────────────

export async function saveDimensionMemory(
  dimensionId: string,
  content: string,
  source: string = 'checkin',
  importance: number = 5,
  userIdOverride?: string
) {
  if (!isSupabaseConfigured()) return

  const userId =
    userIdOverride && userIdOverride !== 'server' && userIdOverride !== 'default'
      ? userIdOverride
      : getUserId()
  if (userId === 'server') return
  const { error } = await supabase.from('dimension_memories').insert({
    user_id: userId,
    dimension_id: dimensionId,
    content,
    source,
    importance,
  })
  if (error) console.error('saveDimensionMemory error:', error)
}

export async function getDimensionMemories(
  dimensionId: string,
  limit = 10,
  userIdOverride?: string
): Promise<string[]> {
  if (!isSupabaseConfigured()) return []

  const userId =
    userIdOverride && userIdOverride !== 'server' && userIdOverride !== 'default'
      ? userIdOverride
      : getUserId()
  if (userId === 'server') return []
  const { data, error } = await supabase
    .from('dimension_memories')
    .select('content, created_at')
    .eq('user_id', userId)
    .eq('dimension_id', dimensionId)
    .order('importance', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => `[${row.created_at.split('T')[0]}] ${row.content}`)
}

// ── OURA ───────────────────────────────────────────────

export async function saveOuraTokens(
  userId: string,
  tokens: { access_token: string; refresh_token: string; expires_at: Date }
) {
  if (!isSupabaseConfigured()) return

  const { error } = await supabase.from('oura_tokens').upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) throw error
}

export async function getOuraTokens(userId: string) {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('oura_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('getOuraTokens error:', error)
    return null
  }
  return data
}

export async function deleteOuraTokens(userId: string) {
  if (!isSupabaseConfigured()) return
  await supabase.from('oura_tokens').delete().eq('user_id', userId)
}

export async function saveOuraDaily(
  userId: string,
  data: Record<string, unknown>
) {
  if (!isSupabaseConfigured()) return

  const { error } = await supabase
    .from('oura_daily')
    .upsert({ user_id: userId, ...data }, { onConflict: 'user_id,date' })
  if (error) throw error
}

export async function getOuraDaily(userId: string, date: string) {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('oura_daily')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (error) {
    console.error('getOuraDaily error:', error)
    return null
  }
  return data
}

export async function getOuraRecentDays(userId: string, days = 7) {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('oura_daily')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(days)

  if (error) return []
  return data ?? []
}

// ── GOOGLE CALENDAR ────────────────────────────────────

export async function saveGoogleTokens(
  userId: string,
  tokens: {
    access_token: string
    refresh_token: string | null
    expires_at: Date
    scope: string
  }
) {
  if (!isSupabaseConfigured()) return

  const { error } = await supabase.from('google_tokens').upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at.toISOString(),
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) throw error
}

export async function getGoogleTokens(userId: string) {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('getGoogleTokens error:', error)
    return null
  }
  return data
}

export async function deleteGoogleTokens(userId: string) {
  if (!isSupabaseConfigured()) return
  await supabase.from('google_tokens').delete().eq('user_id', userId)
}

export async function saveCalendarEvents(
  userId: string,
  events: Array<Record<string, unknown>>
) {
  if (!isSupabaseConfigured() || events.length === 0) return

  const rows = events.map((e) => ({ user_id: userId, ...e }))
  const { error } = await supabase
    .from('calendar_events')
    .upsert(rows, { onConflict: 'user_id,google_event_id' })
  if (error) throw error
}

function offsetDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function eventOnLocalDate(startTime: string | null, eventDate: string, date: string): boolean {
  if (startTime) {
    const d = new Date(startTime)
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return local === date
  }
  return eventDate === date
}

export async function getCalendarEvents(userId: string, date: string) {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .gte('event_date', offsetDate(date, -1))
    .lte('event_date', offsetDate(date, 1))
    .order('start_time', { ascending: true })

  if (error) return []
  return (data ?? []).filter((row) =>
    eventOnLocalDate(
      row.start_time as string | null,
      row.event_date as string,
      date
    )
  )
}

export async function deleteCalendarEventsForDate(userId: string, date: string) {
  if (!isSupabaseConfigured()) return
  await supabase
    .from('calendar_events')
    .delete()
    .eq('user_id', userId)
    .eq('event_date', date)
}

// ── Gmail digest ───────────────────────────────────────

export async function saveGmailDigest(userId: string, digest: Record<string, unknown>) {
  if (!isSupabaseConfigured()) return

  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase.from('gmail_digest').upsert(
    {
      user_id: userId,
      date: today,
      ...digest,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,date' }
  )
  if (error) throw error
}

export async function getGmailDigest(userId: string) {
  if (!isSupabaseConfigured()) return null

  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('gmail_digest')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  if (error) {
    console.error('getGmailDigest error:', error)
    return null
  }
  return data
}

// ── Daily briefings ────────────────────────────────────

export async function getDailyBriefing(userId: string, date?: string) {
  if (!isSupabaseConfigured()) return null

  const day = date ?? todayDate()
  const { data, error } = await supabase
    .from('daily_briefings')
    .select('briefing')
    .eq('user_id', userId)
    .eq('date', day)
    .maybeSingle()

  if (error) {
    console.error('getDailyBriefing error:', error)
    return null
  }
  return data?.briefing ?? null
}

export async function saveDailyBriefing(
  userId: string,
  briefing: string,
  dataSnapshot: unknown
) {
  if (!isSupabaseConfigured()) return

  const day = todayDate()
  const { error } = await supabase.from('daily_briefings').upsert(
    {
      user_id: userId,
      date: day,
      briefing,
      data_snapshot: dataSnapshot,
    },
    { onConflict: 'user_id,date' }
  )
  if (error) throw error
}

export async function getDimensionXP(userId: string): Promise<Record<string, number> | null> {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('dimension_xp')
    .select('dimension_id, total_xp')
    .eq('user_id', userId)

  if (error) {
    console.error('getDimensionXP error:', error)
    return null
  }

  const xpMap: Record<string, number> = {}
  for (const row of data ?? []) {
    xpMap[row.dimension_id] = row.total_xp ?? 0
  }
  return xpMap
}

export async function getTodayQuestsForUser(userId: string): Promise<
  Array<{
    id: string
    title: string
    description: string
    dimension: string
    xp_reward: number
    completed: boolean
  }>
> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .eq('date', todayDate())
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    dimension: row.dimension_id,
    xp_reward: row.xp_reward ?? 100,
    completed: row.status === 'completed',
  }))
}
