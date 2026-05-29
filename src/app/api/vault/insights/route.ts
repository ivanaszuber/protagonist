import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { computeVaultDerived, getVaultSettings } from '@/lib/vault'

const client = new Anthropic()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const settings = await getVaultSettings(userId)
  const derived = computeVaultDerived(settings)
  const { totalNetWorth, monthlySurplus, fireProgressPct } = derived
  const budgetTotal = settings.budget_categories.reduce((s, c) => s + c.budget, 0)

  const topCategories = [...settings.budget_categories]
    .sort((a, b) => b.budget - a.budget)
    .slice(0, 6)
    .map((c) => `${c.label}: £${c.budget}/mo`)
    .join(', ')

  const shadowStatus =
    settings.shadow_gap > 500
      ? `behind shadow by £${Math.round(settings.shadow_gap).toLocaleString()}`
      : settings.shadow_gap < -500
        ? `ahead of shadow by £${Math.round(Math.abs(settings.shadow_gap)).toLocaleString()}`
        : 'on track with shadow'

  const slipLine =
    settings.last_slip_at && settings.last_slip_amount
      ? `Last slip: £${settings.last_slip_amount} on ${settings.last_slip_category ?? 'unknown'} (${new Date(settings.last_slip_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`
      : null

  const prompt = `You are Oracle, a sharp and encouraging financial advisor in a gamified life-optimization app called Protagonist.

User's financial snapshot:
- Net worth: £${Math.round(totalNetWorth).toLocaleString()}
- Monthly income: £${Math.round(settings.monthly_income).toLocaleString()}
- Monthly budget total: £${Math.round(budgetTotal).toLocaleString()}
- Monthly surplus: £${Math.round(monthlySurplus).toLocaleString()}
- FIRE progress: ${fireProgressPct.toFixed(1)}% toward £${Math.round(settings.fire_number / 1000)}k
- Savings tracking: ${shadowStatus}
- Top budget categories: ${topCategories || 'not set yet'}
${slipLine ? `- ${slipLine}` : ''}

Generate exactly 3 short spending insights and a brief summary. Return JSON only, no markdown:
{
  "summary": "2-3 sentence honest and encouraging financial read based on the data above",
  "insights": [
    {"type": "warning", "text": "one specific watch-out under 18 words"},
    {"type": "win", "text": "one specific positive observation under 18 words"},
    {"type": "tip", "text": "one actionable habit tip under 18 words"}
  ]
}

Be specific to the actual numbers. No generic platitudes. If data is sparse (all zeros), note that tracking is the first step.`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const data = JSON.parse(jsonMatch[0]) as {
      summary?: string
      insights?: Array<{ type: string; text: string }>
    }

    return NextResponse.json({
      summary: data.summary ?? '',
      insights: data.insights ?? [],
    })
  } catch {
    // Fallback insights derived from real data
    const fallbackInsights = [
      {
        type: settings.shadow_gap > 0 ? 'warning' : 'win',
        text:
          settings.shadow_gap > 0
            ? `Shadow gap: £${Math.round(settings.shadow_gap).toLocaleString()} behind expected savings.`
            : settings.shadow_gap < 0
              ? `Ahead of savings plan by £${Math.round(Math.abs(settings.shadow_gap)).toLocaleString()}. Keep it up.`
              : 'On track with shadow account. Consistency is compounding.',
      },
      {
        type: 'win',
        text:
          fireProgressPct > 0
            ? `FIRE at ${fireProgressPct.toFixed(1)}% — every month moves the needle.`
            : 'Set your FIRE number to start tracking progress.',
      },
      {
        type: 'tip',
        text:
          monthlySurplus > 0
            ? `£${Math.round(monthlySurplus).toLocaleString()} surplus this month. Consider auto-investing it.`
            : 'Review your top budget categories for quick savings wins.',
      },
    ]

    return NextResponse.json({
      summary:
        'Your financial data is loaded. Tracking consistently is the foundation — the rest follows.',
      insights: fallbackInsights,
    })
  }
}
