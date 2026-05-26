import { NextResponse } from 'next/server'
import { fetchVaultMedalQuestStats, runVaultMedalCheck } from '@/lib/medals'
import { computeVaultDerived, getVaultSettings, upsertVaultSettings, type VaultSettings } from '@/lib/vault'

function buildResponse(settings: VaultSettings) {
  const derived = computeVaultDerived(settings)
  return {
    settings,
    totalNetWorth: derived.totalNetWorth,
    monthlySurplus: derived.monthlySurplus,
    shadow5yr: derived.shadow5yr,
    fireProgressPct: derived.fireProgressPct,
    coinsFilled: derived.coinsFilled,
    coinsPartialPct: derived.coinsPartialPct,
    coinsToGoal: derived.coinsToGoal,
    goalCoinIndex: derived.goalCoinIndex,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const settings = await getVaultSettings(userId)
  return NextResponse.json(buildResponse(settings))
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    userId?: string
    patch?: Partial<VaultSettings>
  }

  const { userId, patch } = body
  if (!userId || !patch) {
    return NextResponse.json({ error: 'userId and patch required' }, { status: 400 })
  }

  try {
    const prevSettings = await getVaultSettings(userId)
    const prevGap = prevSettings.shadow_gap
    const settings = await upsertVaultSettings(userId, patch)

    const questStats = await fetchVaultMedalQuestStats(userId)
    const newMedals = await runVaultMedalCheck(userId, settings, prevGap, questStats)

    return NextResponse.json({
      ...buildResponse(settings),
      new_medals: newMedals,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
