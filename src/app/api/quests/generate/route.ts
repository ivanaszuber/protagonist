import { NextResponse } from 'next/server'
import { anthropic, ARC_SYSTEM_PROMPT, parseJsonFromClaude } from '@/lib/anthropic'
import type { CheckInData } from '@/app/api/checkin/route'
import type { DimensionId } from '@/lib/dimensions'

export interface Quest {
  id: string
  dimension: DimensionId
  title: string
  description: string
  xpReward: number
  difficulty: 'gentle' | 'normal' | 'stretch'
  champion: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const checkIn: CheckInData = body
    const ouraContext: string | undefined = body.ouraContext

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const energyContext =
      checkIn.energyLevel <= 4
        ? 'LOW energy day — quests must be gentle and achievable. No big social events, no marathon work sessions.'
        : checkIn.energyLevel <= 6
          ? 'MODERATE energy — balanced quests, some stretch but nothing overwhelming.'
          : 'HIGH energy — this is a day to push. Give them a real challenge in at least one dimension.'

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: ARC_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Generate exactly 3 daily quests for the user based on their morning check-in.

CHECK-IN DATA:
- Energy level: ${checkIn.energyLevel}/10
- Mood: ${checkIn.mood}
- Social battery: ${checkIn.socialBattery}/10
- Main concern: ${checkIn.mainConcern || 'none mentioned'}
- Main desire: ${checkIn.mainDesire}
- What they said: "${checkIn.transcript}"

ENERGY GUIDANCE: ${energyContext}
${ouraContext ? `\nOURA RING DATA:\n${ouraContext}\nCalibrate vitality quests to readiness/sleep. Low readiness (<60) = gentle recovery only.` : ''}

RULES:
- Generate EXACTLY 3 quests
- Each quest must cover a DIFFERENT dimension group:
  * Quest 1: one of [vitality, mind]
  * Quest 2: one of [create, wealth]
  * Quest 3: one of [social, love, family]
- Quests must be SPECIFIC and completable TODAY (not "exercise more", but "take a 20-min walk after your first coffee")
- Quests should relate to what the user actually said in their check-in when possible
- XP reward: 50-100 for gentle, 100-150 for normal, 150-200 for stretch
- Never mention calories, weight, or body metrics
- Vitality quests focus on energy and recovery (movement, sleep prep, sauna, cold shower, fresh air, etc.)

Respond with raw JSON only (no markdown, no code fences) — a JSON array of exactly 3 objects:
[
  {
    "id": "quest-1",
    "dimension": "<dimension id>",
    "title": "<short punchy title, max 6 words>",
    "description": "<specific, actionable description of what to do today, 1-2 sentences>",
    "xpReward": <number>,
    "difficulty": "<gentle|normal|stretch>",
    "champion": "<champion name for this dimension>"
  },
  { ... quest 2 ... },
  { ... quest 3 ... }
]`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    const quests = parseJsonFromClaude<Quest[]>(content.text)

    if (!Array.isArray(quests) || quests.length !== 3) {
      throw new Error('Claude returned wrong number of quests')
    }

    return NextResponse.json(quests)
  } catch (error) {
    console.error('Quest generation error:', error)
    return NextResponse.json({ error: 'Failed to generate quests' }, { status: 500 })
  }
}
