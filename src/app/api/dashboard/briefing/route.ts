import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import {
  getOuraDaily,
  getCalendarEvents,
  getGmailDigest,
  getDimensionXP,
  getDailyBriefing,
  saveDailyBriefing,
} from '@/lib/db'
import {
  buildCalendarContext,
  calendarRowToEvent,
  detectFreeBlocks,
  type CalendarEventRow,
} from '@/lib/google'
import { buildOuraContext, getReadinessGuidance, ouraRowToDailyData } from '@/lib/oura'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const briefing = await getDailyBriefing(userId)
  return NextResponse.json({ briefing })
}

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const today = new Date().toISOString().split('T')[0]

    const [ouraRow, calendarRows, gmailDigest, xpData] = await Promise.all([
      getOuraDaily(userId, today),
      getCalendarEvents(userId, today),
      getGmailDigest(userId),
      getDimensionXP(userId),
    ])

    const sections: string[] = []

    if (ouraRow) {
      const ouraData = ouraRowToDailyData({
        date: ouraRow.date,
        sleep_score: ouraRow.sleep_score,
        sleep_total_seconds: ouraRow.sleep_total_seconds,
        sleep_rem_seconds: ouraRow.sleep_rem_seconds,
        sleep_deep_seconds: ouraRow.sleep_deep_seconds,
        sleep_efficiency: ouraRow.sleep_efficiency,
        sleep_latency_seconds: ouraRow.sleep_latency_seconds,
        readiness_score: ouraRow.readiness_score,
        hrv_balance: ouraRow.hrv_balance,
        recovery_index: ouraRow.recovery_index,
        body_temperature_deviation: ouraRow.body_temperature_deviation,
        activity_score: ouraRow.activity_score,
        steps: ouraRow.steps,
        active_calories: ouraRow.active_calories,
        resilience_level: ouraRow.resilience_level,
        hrv_average: ouraRow.hrv_average,
      })
      sections.push(buildOuraContext(ouraData))
      const guidance = getReadinessGuidance(ouraData.readiness_score)
      if (guidance) sections.push(guidance)
    }

    if (calendarRows.length > 0) {
      const events = calendarRows.map((row) =>
        calendarRowToEvent({
          google_event_id: row.google_event_id as string,
          title: row.title as string,
          start_time: (row.start_time as string | null) ?? null,
          end_time: (row.end_time as string | null) ?? null,
          all_day: Boolean(row.all_day),
          location: (row.location as string | null) ?? null,
          description: (row.description as string | null) ?? null,
          calendar_name: (row.calendar_name as string) ?? 'Calendar',
          event_date: row.event_date as string,
        } satisfies CalendarEventRow)
      )
      sections.push(buildCalendarContext(events, today))
      const freeBlocks = detectFreeBlocks(events, today)
      if (freeBlocks.length > 0) sections.push(`Free blocks: ${freeBlocks.join(', ')}`)
    }

    if (gmailDigest?.arc_summary) {
      sections.push(gmailDigest.arc_summary as string)
    }

    if (xpData && Object.keys(xpData).length > 0) {
      const dims = Object.entries(xpData)
        .map(([dim, val]) => `${dim}: ${val}XP`)
        .join(', ')
      sections.push(`Current XP — ${dims}`)
    }

    const dataContext = sections.join('\n\n')
    const now = new Date()
    const hour = now.getHours()
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
    const dayName = now.toLocaleDateString('en-GB', { weekday: 'long' })

    const systemPrompt = `You are Arc — the user's personal life coach in Protagonist, an AI life coaching app with RPG mechanics.

Write a short, personalized ${timeOfDay} briefing for this ${dayName}.

Your briefing should:
- Be 3-4 sentences maximum
- Reference their actual data specifically (scores, events, inbox state)
- Set the tone and intention for the day
- End with one clear focus or gentle challenge
- Sound like a trusted friend who knows them deeply — warm, direct, never generic
- Never use the word "journey" or corporate wellness speak
- Be specific — mention actual numbers, actual events from their calendar if present

If readiness is high: energize them, this is a day to push
If readiness is low: support them, frame rest as strategy
If inbox is heavy: acknowledge it, help them prioritize
If calendar is packed: help them find the pockets of focus`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content:
            dataContext ||
            `Good ${timeOfDay}. No data connected yet — give a warm general greeting.`,
        },
      ],
    })

    const briefing =
      response.content[0].type === 'text'
        ? response.content[0].text
        : `Good ${timeOfDay}. Ready when you are.`

    await saveDailyBriefing(userId, briefing, { sections })

    return NextResponse.json({ briefing })
  } catch (error) {
    console.error('Briefing generation error:', error)
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 })
  }
}
