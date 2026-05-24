import { NextRequest, NextResponse } from 'next/server'
import { anthropic, ARC_SYSTEM_PROMPT, parseJsonFromClaude } from '@/lib/anthropic'
import { DIMENSIONS } from '@/lib/dimensions'
import type { Quest, CompletionResult } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { quest, proofTranscript }: { quest: Quest; proofTranscript: string } =
      await req.json()

    if (!quest || !proofTranscript?.trim()) {
      return NextResponse.json({ error: 'Missing quest or proof' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const dimension = DIMENSIONS[quest.dimensionId]

    const prompt = `A player has attempted a quest and is providing voice proof of completion.

QUEST:
- Title: ${quest.title}
- Description: ${quest.description}
- Dimension: ${dimension.name} (${dimension.emoji})
- Max XP: ${quest.xpReward}
- Champion: ${quest.championName}

PLAYER'S PROOF (what they said):
"${proofTranscript}"

Evaluate this proof. The player just described what they did and how it felt.

Evaluation rules:
- Full XP (${quest.xpReward}): They genuinely did it — even imperfectly. Any real attempt counts.
- Partial XP (${Math.round(quest.xpReward * 0.5)}): They tried but were blocked, or partially completed. Still celebrate the honesty and effort.
- Small XP (${Math.round(quest.xpReward * 0.25)}): They didn't do it but are being honest and reflective about why. Reward that.
- Zero XP: Only if they're clearly gaming the system (one-word non-answers, obviously fake).
- A genuine 30-second reflection almost always earns full XP.
- Never be harsh about HOW they did it — only whether they engaged honestly.
- If they mentioned something specific (a feeling, a detail, a moment) — they did it.

Arc's response should:
- Reference something SPECIFIC they said
- Be warm, coach-like, 1-2 sentences max
- Never use the word "journey"

Respond with ONLY valid JSON, no markdown, no code fences:
{
  "completed": boolean,
  "partialCredit": boolean,
  "xpAwarded": number,
  "arcResponse": "string — warm, specific, 1-2 sentences",
  "encouragement": "string — short punchy coach line, max 8 words"
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: ARC_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    const result = parseJsonFromClaude<CompletionResult>(content.text)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Quest completion error:', error)
    return NextResponse.json(
      { error: 'Failed to evaluate quest completion' },
      { status: 500 }
    )
  }
}
