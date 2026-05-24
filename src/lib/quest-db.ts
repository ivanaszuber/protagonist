import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { XP_PER_LEVEL } from '@/lib/xp'

/** Quest-system XP table (career / social / wealth). Named to avoid clashing with legacy dimension_xp. */
export const QUEST_XP_TABLE = 'quest_dimension_xp'

export function isQuestDbConfigured(): boolean {
  return isSupabaseConfigured()
}

export function levelFromXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1
}

export async function getQuestDimensionXp(
  userId: string,
  dimension: string
): Promise<number> {
  const { data } = await supabase
    .from(QUEST_XP_TABLE)
    .select('xp')
    .eq('user_id', userId)
    .eq('dimension', dimension)
    .maybeSingle()

  return data?.xp ?? 0
}

export async function addQuestDimensionXp(
  userId: string,
  dimension: string,
  amount: number
): Promise<{ totalXp: number; leveledUp: boolean; newLevel: number }> {
  const previousXp = await getQuestDimensionXp(userId, dimension)
  const newXp = previousXp + amount
  const oldLevel = levelFromXp(previousXp)
  const newLevel = levelFromXp(newXp)

  const { error } = await supabase.from(QUEST_XP_TABLE).upsert(
    {
      user_id: userId,
      dimension,
      xp: newXp,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,dimension' }
  )

  if (error) throw error

  return {
    totalXp: newXp,
    leveledUp: newLevel > oldLevel,
    newLevel,
  }
}
