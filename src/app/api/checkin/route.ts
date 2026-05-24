import { NextResponse } from 'next/server'
import { anthropic, ARC_SYSTEM_PROMPT, parseJsonFromClaude } from '@/lib/anthropic'

export interface CheckInData {
  transcript: string
  energyLevel: number
  mood: string
  socialBattery: number
  mainConcern: string
  mainDesire: string
  arcResponse: string
}

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json()

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 3) {
      return NextResponse.json({ error: 'Transcript too short' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: ARC_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `The user just did their morning voice check-in. Here's what they said:

"${transcript}"

Respond with a JSON object only (no markdown, no code fences) with these exact fields:
{
  "transcript": "<echo the user's words verbatim>",
  "energyLevel": <number 1-10 based on what they described>,
  "mood": "<one or two words describing their emotional state>",
  "socialBattery": <number 1-10, how much they seem up for social interaction today>,
  "mainConcern": "<the main thing weighing on them, one sentence, or empty string if none>",
  "mainDesire": "<the one thing they most want from today, one sentence>",
  "arcResponse": "<your warm, specific, 2-3 sentence response to what they said. Acknowledge what you heard. Make them feel seen. End with one sharp question or a single line of encouragement.>"
}`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    const checkInData = parseJsonFromClaude<CheckInData>(content.text)
    checkInData.transcript = transcript.trim()

    return NextResponse.json(checkInData)
  } catch (error) {
    console.error('Check-in API error:', error)
    return NextResponse.json({ error: 'Failed to process check-in' }, { status: 500 })
  }
}
