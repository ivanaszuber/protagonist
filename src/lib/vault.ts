import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export interface BudgetCategory {
  key: string
  label: string
  budget: number
  color: string
}

export interface VaultSettings {
  user_id: string
  invested: number
  cash: number
  monthly_income: number
  monthly_savings_target: number
  fire_number: number
  fire_target_year: number
  fire_annual_spend: number
  nw_goal: number
  nw_goal_deadline: string | null
  coin_denomination: number
  shadow_interest_rate: number
  expected_return_rate: number
  isa_allowance_used: number
  budget_categories: BudgetCategory[]
  shadow_gap: number
  shadow_gap_updated_at: string | null
  last_slip_at: string | null
  last_slip_amount: number | null
  last_slip_category: string | null
  last_slip_note: string | null
  updated_at: string
}

export const DEFAULT_BUDGET_CATEGORIES: BudgetCategory[] = [
  { key: 'housing', label: 'Housing & rent', budget: 1200, color: '#F0997B' },
  { key: 'groceries', label: 'Groceries', budget: 400, color: '#1D9E75' },
  { key: 'restaurants', label: 'Restaurants', budget: 300, color: '#F472B6' },
  { key: 'going_out', label: 'Going out', budget: 250, color: '#818CF8' },
  { key: 'transport', label: 'Transport', budget: 200, color: '#38BDF8' },
  { key: 'beauty', label: 'Beauty & wellness', budget: 200, color: '#F43F5E' },
  { key: 'shopping', label: 'Shopping & clothes', budget: 150, color: '#EF9F27' },
  { key: 'utilities', label: 'Utilities', budget: 130, color: '#4ADE80' },
  { key: 'subscriptions', label: 'Subscriptions', budget: 100, color: '#9B7FCC' },
  { key: 'other', label: 'Other', budget: 70, color: '#6B5E8C' },
]

export function defaultVaultSettings(userId: string): VaultSettings {
  const now = new Date().toISOString()
  return {
    user_id: userId,
    invested: 0,
    cash: 0,
    monthly_income: 0,
    monthly_savings_target: 0,
    fire_number: 1_500_000,
    fire_target_year: 2030,
    fire_annual_spend: 60_000,
    nw_goal: 200_000,
    nw_goal_deadline: null,
    coin_denomination: 10_000,
    shadow_interest_rate: 7,
    expected_return_rate: 7,
    isa_allowance_used: 0,
    budget_categories: DEFAULT_BUDGET_CATEGORIES,
    shadow_gap: 0,
    shadow_gap_updated_at: null,
    last_slip_at: null,
    last_slip_amount: null,
    last_slip_category: null,
    last_slip_note: null,
    updated_at: now,
  }
}

function toNumber(value: unknown, fallback = 0): number {
  if (value == null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function normalizeVaultRow(row: Record<string, unknown>, userId: string): VaultSettings {
  const defaults = defaultVaultSettings(userId)
  let categories = defaults.budget_categories
  const rawCategories = row.budget_categories
  if (Array.isArray(rawCategories) && rawCategories.length > 0) {
    categories = rawCategories.map((c) => {
      const cat = c as Record<string, unknown>
      return {
        key: String(cat.key ?? ''),
        label: String(cat.label ?? ''),
        budget: toNumber(cat.budget),
        color: String(cat.color ?? '#6B5E8C'),
      }
    })
  }

  return {
    user_id: userId,
    invested: toNumber(row.invested),
    cash: toNumber(row.cash),
    monthly_income: toNumber(row.monthly_income),
    monthly_savings_target: toNumber(row.monthly_savings_target),
    fire_number: toNumber(row.fire_number, defaults.fire_number),
    fire_target_year: toNumber(row.fire_target_year, defaults.fire_target_year),
    fire_annual_spend: toNumber(row.fire_annual_spend, defaults.fire_annual_spend),
    nw_goal: toNumber(row.nw_goal, defaults.nw_goal),
    nw_goal_deadline: (row.nw_goal_deadline as string | null) ?? null,
    coin_denomination: toNumber(row.coin_denomination, defaults.coin_denomination),
    shadow_interest_rate: toNumber(row.shadow_interest_rate, defaults.shadow_interest_rate),
    expected_return_rate: toNumber(row.expected_return_rate, defaults.expected_return_rate),
    isa_allowance_used: toNumber(row.isa_allowance_used),
    budget_categories: categories,
    shadow_gap: toNumber(row.shadow_gap),
    shadow_gap_updated_at: (row.shadow_gap_updated_at as string | null) ?? null,
    last_slip_at: (row.last_slip_at as string | null) ?? null,
    last_slip_amount: row.last_slip_amount != null ? toNumber(row.last_slip_amount) : null,
    last_slip_category: (row.last_slip_category as string | null) ?? null,
    last_slip_note: (row.last_slip_note as string | null) ?? null,
    updated_at: (row.updated_at as string) ?? defaults.updated_at,
  }
}

export function sumBudgetCategories(categories: BudgetCategory[]): number {
  return categories.reduce((sum, c) => sum + c.budget, 0)
}

export function computeVaultDerived(settings: VaultSettings) {
  const totalNetWorth = settings.invested + settings.cash
  const monthlySurplus = settings.monthly_income - sumBudgetCategories(settings.budget_categories)
  const denom = Math.max(settings.coin_denomination, 1)
  const coinsFilled = Math.floor(totalNetWorth / denom)
  const remainder = totalNetWorth % denom
  const coinsPartialPct = Math.round((remainder / denom) * 100)
  const goalCoins = Math.ceil(settings.nw_goal / denom)
  const coinsToGoal = Math.max(0, goalCoins - coinsFilled)
  const fireProgressPct =
    settings.fire_number > 0 ? (totalNetWorth / settings.fire_number) * 100 : 0
  const rate = settings.shadow_interest_rate / 100
  const shadow5yr = settings.shadow_gap * Math.pow(1 + rate, 5)

  return {
    totalNetWorth,
    monthlySurplus,
    shadow5yr,
    fireProgressPct,
    coinsFilled,
    coinsPartialPct,
    coinsToGoal,
    goalCoinIndex: goalCoins,
  }
}

export function applyBalanceShadowGap(
  current: VaultSettings,
  patch: Partial<VaultSettings>
): Partial<VaultSettings> {
  const nextInvested = patch.invested ?? current.invested
  const nextCash = patch.cash ?? current.cash
  const balanceChanged =
    (patch.invested !== undefined && patch.invested !== current.invested) ||
    (patch.cash !== undefined && patch.cash !== current.cash)

  if (!balanceChanged) return patch

  const oldTotal = current.invested + current.cash
  const newTotal = nextInvested + nextCash
  const actualDelta = newTotal - oldTotal
  const budgetSurplus = current.monthly_income - sumBudgetCategories(current.budget_categories)

  return {
    ...patch,
    shadow_gap: current.shadow_gap + (budgetSurplus - actualDelta),
    shadow_gap_updated_at: new Date().toISOString(),
  }
}

export function computeFireTrajectoryYear(settings: VaultSettings): number | null {
  const { totalNetWorth, monthlySurplus } = computeVaultDerived(settings)
  if (monthlySurplus <= 0 && totalNetWorth < settings.fire_number) return null

  let nw = totalNetWorth
  const annualReturn = settings.expected_return_rate / 100
  const year = new Date().getFullYear()

  for (let i = 0; i < 80; i++) {
    if (nw >= settings.fire_number) return year + i
    nw = nw * (1 + annualReturn) + monthlySurplus * 12
  }
  return null
}

export async function getVaultSettings(userId: string): Promise<VaultSettings> {
  if (!isSupabaseConfigured()) {
    return defaultVaultSettings(userId)
  }

  const { data, error } = await supabase
    .from('vault_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    return defaultVaultSettings(userId)
  }

  return normalizeVaultRow(data as Record<string, unknown>, userId)
}

export async function upsertVaultSettings(
  userId: string,
  patch: Partial<VaultSettings>
): Promise<VaultSettings> {
  const current = await getVaultSettings(userId)
  const withShadow = applyBalanceShadowGap(current, patch)
  const merged: VaultSettings = {
    ...current,
    ...withShadow,
    user_id: userId,
    updated_at: new Date().toISOString(),
  }

  if (!isSupabaseConfigured()) {
    return merged
  }

  const row = {
    user_id: userId,
    invested: merged.invested,
    cash: merged.cash,
    monthly_income: merged.monthly_income,
    monthly_savings_target: merged.monthly_savings_target,
    fire_number: merged.fire_number,
    fire_target_year: merged.fire_target_year,
    fire_annual_spend: merged.fire_annual_spend,
    nw_goal: merged.nw_goal,
    nw_goal_deadline: merged.nw_goal_deadline,
    coin_denomination: merged.coin_denomination,
    shadow_interest_rate: merged.shadow_interest_rate,
    expected_return_rate: merged.expected_return_rate,
    isa_allowance_used: merged.isa_allowance_used,
    budget_categories: merged.budget_categories,
    shadow_gap: merged.shadow_gap,
    shadow_gap_updated_at: merged.shadow_gap_updated_at,
    last_slip_at: merged.last_slip_at,
    last_slip_amount: merged.last_slip_amount,
    last_slip_category: merged.last_slip_category,
    last_slip_note: merged.last_slip_note,
    updated_at: merged.updated_at,
  }

  const { data, error } = await supabase
    .from('vault_settings')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save vault settings')
  }

  return normalizeVaultRow(data as Record<string, unknown>, userId)
}

export function formatGbp(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 1000) {
    const k = amount / 1000
    const rounded = k >= 100 ? Math.round(k) : Math.round(k * 10) / 10
    return `£${rounded}k`
  }
  return `£${Math.round(amount).toLocaleString('en-GB')}`
}

export function coinFillColor(coinIndex: number): string {
  if (coinIndex <= 5) return '#085041'
  if (coinIndex <= 10) return '#0F6E56'
  if (coinIndex <= 15) return '#1D9E75'
  return '#1D9E75'
}
