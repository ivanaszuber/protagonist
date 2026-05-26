import { anthropic, parseJsonFromClaude } from '@/lib/anthropic'
import {
  getDimensionMemories,
  saveDimensionMemory,
  getOuraDaily,
  getCalendarEvents,
  getGmailDigest,
} from '@/lib/db'
import {
  buildCalendarContext,
  calendarRowToEvent,
  detectFreeBlocks,
  type CalendarEventRow,
} from '@/lib/google'
import {
  buildOuraContext,
  getReadinessGuidance,
  ouraRowToDailyData,
  ouraToArcPayload,
} from '@/lib/oura'
import { DimensionId } from '@/types'
import { SPECIALISTS, SpecialistResponse } from './specialists'
import { detectDimensions, isCheckIn } from './router'

const ARC_SYNTHESIS_PROMPT = `You are Arc, the Oracle — a wise, witty, deeply perceptive
AI life coach and the user's most trusted companion. You know them deeply.

You have just received insights from your specialist advisors. Your job is to synthesize
their input into one warm, coherent response in your voice.

TONE: warm but direct, playful but serious when it matters, never clinical.
Never use: "journey", "holistic", "self-care", "wellness", "mindset shift".
Talk like the most perceptive coach this person has ever had — who also genuinely
cares about them as a person, not just their productivity.

LENGTH: 2-4 sentences usually. Sometimes one perfect sentence is enough.
Never a list. Never headers. Just talk.

You know when to push and when to hold space. You know when someone needs a
challenge and when they need to feel witnessed. Read the room.`

const SPECIALIST_MODEL = 'claude-haiku-4-5-20251001'
const ARC_MODEL = 'claude-sonnet-4-6'

export interface ArcInput {
  userMessage: string
  userId: string
  ouraData?: { sleepScore?: number; readiness?: number; hrv?: number }
  checkInData?: { energyLevel: number; mood: string }
}

export interface ArcOutput {
  response: string
  dimensionsConsulted: string[]
  questSuggestions: string[]
}

async function callSpecialist(
  dimensionId: DimensionId,
  userMessage: string,
  memories: string[],
  userId: string,
  ouraContextBlock?: string,
  specialistExtra?: string
): Promise<SpecialistResponse & { dimensionId: DimensionId }> {
  const specialist = SPECIALISTS[dimensionId]
  if (!specialist) {
    return { dimensionId, insight: '', memoryToStore: '', urgency: 'low' }
  }

  const memoryContext =
    memories.length > 0
      ? `\nYour memory of this person in ${dimensionId}:\n${memories.join('\n')}`
      : `\nNo memories yet for ${dimensionId}.`

  const ouraContext =
    ouraContextBlock && dimensionId === 'vitality' ? `\n\n${ouraContextBlock}` : ''

  const zaraBootstrap =
    dimensionId === 'family' && memories.length === 0
      ? `\n\nKnown context: The user's daughter is named Zara. Zara is autistic.
This is established fact — treat it as memory, not assumption.`
      : ''

  const specialistExtraBlock = specialistExtra ? `\n\n${specialistExtra}` : ''

  const contextMessage = `User message: "${userMessage}"${memoryContext}${zaraBootstrap}${ouraContext}${specialistExtraBlock}

What is your specialist insight on the ${dimensionId} angle of this message?`

  try {
    const response = await anthropic.messages.create({
      model: SPECIALIST_MODEL,
      max_tokens: 300,
      system: specialist.systemPrompt,
      messages: [{ role: 'user', content: contextMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = parseJsonFromClaude<SpecialistResponse>(text)
    return { ...parsed, dimensionId }
  } catch (error) {
    console.error(`Specialist ${dimensionId} error:`, error)
    return { dimensionId, insight: '', memoryToStore: '', urgency: 'low' }
  }
}

async function loadOuraContextForUser(userId: string): Promise<{
  payload?: ArcInput['ouraData']
  contextBlock: string
}> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const row = await getOuraDaily(userId, today)
    if (!row) return { contextBlock: '' }

    const data = ouraRowToDailyData({
      date: row.date,
      sleep_score: row.sleep_score,
      sleep_total_seconds: row.sleep_total_seconds,
      sleep_rem_seconds: row.sleep_rem_seconds,
      sleep_deep_seconds: row.sleep_deep_seconds,
      sleep_efficiency: row.sleep_efficiency,
      sleep_latency_seconds: row.sleep_latency_seconds,
      readiness_score: row.readiness_score,
      hrv_balance: row.hrv_balance,
      recovery_index: row.recovery_index,
      body_temperature_deviation: row.body_temperature_deviation,
      activity_score: row.activity_score,
      steps: row.steps,
      active_calories: row.active_calories,
      resilience_level: row.resilience_level,
      hrv_average: row.hrv_average,
    })

    const context = buildOuraContext(data)
    const guidance = getReadinessGuidance(data.readiness_score)
    return {
      payload: ouraToArcPayload(data),
      contextBlock: guidance ? `${context}\n${guidance}` : context,
    }
  } catch {
    return { contextBlock: '' }
  }
}

async function loadCalendarContextForUser(userId: string): Promise<{
  calendarContext: string
  freeBlocks: string[]
}> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const rows = await getCalendarEvents(userId, today)
    if (!rows.length) return { calendarContext: '', freeBlocks: [] }

    const events = rows.map((row) =>
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

    return {
      calendarContext: buildCalendarContext(events, today),
      freeBlocks: detectFreeBlocks(events, today),
    }
  } catch {
    return { calendarContext: '', freeBlocks: [] }
  }
}

/**
 * Arc uses 'create' as the DimensionId for the career/work dimension,
 * but the app stores everything under 'career'. Map when reading/writing memories.
 */
function toPersistenceId(dim: DimensionId): string {
  return dim === 'create' ? 'career' : dim
}

export async function consultArc(input: ArcInput): Promise<ArcOutput> {
  const { userMessage, userId, checkInData } = input

  const loadedOura =
    input.ouraData !== undefined
      ? {
          payload: input.ouraData,
          contextBlock: '',
        }
      : await loadOuraContextForUser(userId)

  const ouraContextBlock = loadedOura.contextBlock

  const { calendarContext, freeBlocks } = await loadCalendarContextForUser(userId)

  let gmailContext = ''
  try {
    const gmailDigest = await getGmailDigest(userId)
    if (gmailDigest?.arc_summary) {
      gmailContext = gmailDigest.arc_summary as string
    }
  } catch {
    // Gmail not connected — continue without it
  }

  const allDimensions: DimensionId[] = isCheckIn(userMessage)
    ? ['vitality', 'mind', 'create', 'social', 'love', 'family', 'wealth']
    : detectDimensions(userMessage)

  const memoriesByDimension = await Promise.all(
    allDimensions.map(async (dim) => ({
      dim,
      memories: await getDimensionMemories(toPersistenceId(dim), 8, userId),
    }))
  )
  const memoryMap = Object.fromEntries(
    memoriesByDimension.map(({ dim, memories }) => [dim, memories])
  ) as Record<DimensionId, string[]>

  const specialistResults = await Promise.all(
    allDimensions.map((dim) => {
      const specialistExtra =
        dim === 'create' && (calendarContext || gmailContext)
          ? `WORK CONTEXT TODAY:\n${calendarContext || ''}\n${gmailContext ? `Inbox: ${gmailContext}` : ''}\nFree blocks: ${freeBlocks.join(', ') || 'check calendar'}`
          : dim === 'love' && calendarContext
            ? `Schedule note: ${calendarContext.split('\n')[0]}`
            : undefined

      return callSpecialist(
        dim,
        userMessage,
        memoryMap[dim] || [],
        userId,
        ouraContextBlock,
        specialistExtra
      )
    })
  )

  const activeResults = specialistResults.filter((r) => r.insight.trim().length > 0)

  const specialistContext = activeResults
    .map((r) => {
      const urgencyFlag = r.urgency === 'high' ? ' [PRIORITY]' : ''
      return `${SPECIALISTS[r.dimensionId]?.name ?? r.dimensionId}${urgencyFlag}: ${r.insight}`
    })
    .join('\n\n')

  const checkInContext = checkInData
    ? `\nUser's current state: energy ${checkInData.energyLevel}/10, mood: ${checkInData.mood}`
    : ''

  const contextSection = [
    ouraContextBlock
      ? `BIODATA FOR TODAY (from Oura Ring — use for energy/recovery calibration):\n${ouraContextBlock}`
      : '',
    calendarContext ? `SCHEDULE FOR TODAY:\n${calendarContext}` : '',
    freeBlocks.length > 0 ? `FREE BLOCKS FOR DEEP WORK:\n${freeBlocks.join('\n')}` : '',
    gmailContext ? `INBOX STATUS:\n${gmailContext}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const contextSectionBlock = contextSection ? `\n\n${contextSection}` : ''

  const synthesisPrompt =
    activeResults.length > 0
      ? `User said: "${userMessage}"${checkInContext}

Specialist insights:
${specialistContext}

Respond to the user as Arc. One unified response. Draw on what's relevant from the specialists.
Do not address every dimension — just what actually matters right now.`
      : `User said: "${userMessage}"${checkInContext}

No specialist insights were available. Respond as Arc with warmth and specificity based on what they said.`

  const arcMessage = await anthropic.messages.create({
    model: ARC_MODEL,
    max_tokens: 400,
    system: `${ARC_SYNTHESIS_PROMPT}${contextSectionBlock}`,
    messages: [{ role: 'user', content: synthesisPrompt }],
  })

  const arcResponse =
    arcMessage.content[0].type === 'text'
      ? arcMessage.content[0].text
      : "I'm here. Tell me more."

  const memoryPromises = activeResults
    .filter((r) => r.memoryToStore.trim().length > 0)
    .map((r) =>
      saveDimensionMemory(toPersistenceId(r.dimensionId), r.memoryToStore, 'conversation', 6, userId)
    )
  await Promise.allSettled(memoryPromises)

  const questSuggestions = activeResults
    .filter((r) => r.questSuggestion)
    .map((r) => r.questSuggestion as string)

  return {
    response: arcResponse,
    dimensionsConsulted: allDimensions,
    questSuggestions,
  }
}
