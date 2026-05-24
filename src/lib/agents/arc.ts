import { anthropic, parseJsonFromClaude } from '@/lib/anthropic'
import { getDimensionMemories, saveDimensionMemory } from '@/lib/db'
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
  ouraData?: ArcInput['ouraData']
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
    ouraData && dimensionId === 'vitality'
      ? `\nOura data: sleep ${ouraData.sleepScore ?? 'unknown'}, readiness ${ouraData.readiness ?? 'unknown'}, HRV ${ouraData.hrv ?? 'unknown'}`
      : ''

  const zaraBootstrap =
    dimensionId === 'family' && memories.length === 0
      ? `\n\nKnown context: The user's daughter is named Zara. Zara is autistic.
This is established fact — treat it as memory, not assumption.`
      : ''

  const contextMessage = `User message: "${userMessage}"${memoryContext}${zaraBootstrap}${ouraContext}

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

export async function consultArc(input: ArcInput): Promise<ArcOutput> {
  const { userMessage, userId, ouraData, checkInData } = input

  const allDimensions: DimensionId[] = isCheckIn(userMessage)
    ? ['vitality', 'mind', 'create', 'social', 'love', 'family', 'wealth']
    : detectDimensions(userMessage)

  const memoriesByDimension = await Promise.all(
    allDimensions.map(async (dim) => ({
      dim,
      memories: await getDimensionMemories(dim, 8, userId),
    }))
  )
  const memoryMap = Object.fromEntries(
    memoriesByDimension.map(({ dim, memories }) => [dim, memories])
  ) as Record<DimensionId, string[]>

  const specialistResults = await Promise.all(
    allDimensions.map((dim) =>
      callSpecialist(dim, userMessage, memoryMap[dim] || [], userId, ouraData)
    )
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
    system: ARC_SYNTHESIS_PROMPT,
    messages: [{ role: 'user', content: synthesisPrompt }],
  })

  const arcResponse =
    arcMessage.content[0].type === 'text'
      ? arcMessage.content[0].text
      : "I'm here. Tell me more."

  const memoryPromises = activeResults
    .filter((r) => r.memoryToStore.trim().length > 0)
    .map((r) =>
      saveDimensionMemory(r.dimensionId, r.memoryToStore, 'conversation', 6, userId)
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
