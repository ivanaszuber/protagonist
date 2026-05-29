import { anthropic, parseJsonFromClaude } from '@/lib/anthropic'
import {
  getDimensionMemories,
  saveDimensionMemory,
  getOuraDaily,
  getCalendarEvents,
  getGmailDigest,
  getUserProfile,
  type UserProfileRow,
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
AI life coach and this person's most trusted companion. You know them deeply.

You have received insights from your specialist advisors. Synthesise them into one
response in your voice — don't address every dimension, just what actually matters now.

━━ READ THE REGISTER FIRST ━━
Before writing a word, identify what kind of message this is:

PERSONAL / VULNERABLE — anything touching relationships, family (Zara, Leo), feelings,
  hard times, loneliness, fear, love, grief, or moments where they're opening up.
  → Lead with empathy. Be warm and present before being wise. Use 1–3 emojis that feel
    natural, not performed. Allow 4–7 sentences. Give them space to feel seen.

FINANCIAL / PRACTICAL — money, numbers, strategies, specific decisions, risk.
  → Be direct, concrete, clear. No emojis. If there are 3+ distinct points, a tight
    short list is fine. Otherwise prose. Short is better than long here.

PLANNING / ACTION — what to do, how to approach something, next steps.
  → Energetic, specific, actionable. Brief. End with the one clearest thing to do.

REFLECTIVE / CHECK-IN — morning check-in, "how am I doing", big picture questions.
  → Be the friend who sees patterns they can't see themselves. Warm but focused.
    Reference what you know about them across their life — make connections.

━━ TONE ━━
Warm but direct. Playful when it fits, serious when it matters. Never clinical.
Never use: "journey", "holistic", "self-care", "wellness", "mindset shift", "navigate".
Talk like the most perceptive coach they've ever had — who also genuinely likes them.
Reference their actual life, patterns, history. Make them feel *known*, not just heard.

━━ LENGTH & FORMAT ━━
Match depth to what they shared. 2–3 sentences for simple questions.
4–7 for complex or emotional topics. Never a wall of text.
Add a line break between paragraphs if going beyond 3 sentences.
Headers: never. Lists: only for 3+ genuinely list-worthy items (financial/practical only).

━━ ACTIONS ━━
The app's action system automatically handles tasks, milestones, and calendar events — it runs
before you even respond. So when someone wants to add a task, log a milestone, book time, or
track an activity, respond as if it's already done: "Added that to your career track" or
"Done — Systems Design is now a milestone on your career quest."
Be warm and confident. No caveats, no "you'll need to rephrase that." If you genuinely can't
infer what they want, ask one short clarifying question.

━━ FILE & DOCUMENT UPLOADS ━━
When the user shares a file or document WITHOUT a specific question or instruction alongside it,
do NOT dive straight into full analysis. Instead: acknowledge what you see in 1-2 sentences,
then ask one direct question about what they want — e.g. "I can see your Systems Design prep doc.
Want me to talk through the gaps, or pull out a focus list for today?"
When they DO give a clear instruction alongside the file (e.g. "review this", "what am I missing",
"extract tasks"), respond to that instruction directly. Never promise to do something
programmatically (like "I'll auto-create tasks from this") — you can discuss and suggest,
but the user confirms what gets saved.`

const SPECIALIST_MODEL = 'claude-haiku-4-5-20251001'
const ARC_MODEL = 'claude-sonnet-4-6'

// ── Relationship memory writer ─────────────────────────────────────────────────
// Runs silently after every conversation. Captures emotional and relational
// patterns that help Arc feel like it truly *knows* the person over time.

const RELATIONSHIP_MEMORY_PROMPT = `You are the emotional memory system for Arc, an AI life coach.

After each conversation exchange, your job is to record 0–2 emotional or relational
insights about the user — permanent internal notes that will make Arc more emotionally
intelligent in every future conversation.

WHAT TO CAPTURE (only if genuinely revealed in this exchange):
- Emotional patterns: how they react under stress, what they deflect, what opens them up
- Relationship dynamics: patterns with key people (Leo, Zara, family, colleagues)
- Emotional triggers: topics that create unusual anxiety, resistance, or energy
- Self-relationship: where they're harsh vs generous with themselves
- Growth loops: where they're genuinely stretching vs repeating old patterns
- What they need but don't always ask for (challenge, validation, space, directness)

WHAT NOT TO CAPTURE:
- Tasks, goals, plans (those go in dimension memories)
- Facts already in their profile (age, location, family info)
- Neutral or purely practical exchanges with no emotional content
- Anything already obvious or generic

FORMAT: Return JSON only — no other text.
{ "memories": ["sentence one", "sentence two"] }

Each memory: one sentence, present-tense, Arc's internal observation voice.
Good examples:
  "Deflects with humour when the Leo situation surfaces — the joke is the tell"
  "Pride and exhaustion live together around Zara; she rarely separates them"
  "Big ideas energise her immediately; the gap between idea and action is where fear lives"
  "Needs to feel competent before she can ask for help — vulnerability feels like weakness"

If no genuine emotional insight emerged from this exchange, return: { "memories": [] }
Maximum 2 memories. Quality over quantity.`

async function writeRelationshipMemory(
  userMessage: string,
  arcResponse: string,
  userId: string
): Promise<void> {
  try {
    const response = await anthropic.messages.create({
      model: SPECIALIST_MODEL,
      max_tokens: 220,
      system: RELATIONSHIP_MEMORY_PROMPT,
      messages: [{
        role: 'user',
        content: `User said: "${userMessage}"\n\nArc responded: "${arcResponse}"\n\nWhat emotional/relational memories should Arc store from this exchange?`,
      }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = parseJsonFromClaude<{ memories: string[] }>(text)
    if (parsed.memories?.length > 0) {
      await Promise.allSettled(
        parsed.memories.map((mem) =>
          saveDimensionMemory('arc', mem, 'conversation', 8, userId)
        )
      )
    }
  } catch {
    // Silent fail — background operation, never blocks the response
  }
}

export interface ArcInput {
  userMessage: string
  userId: string
  ouraData?: { sleepScore?: number; readiness?: number; hrv?: number }
  checkInData?: { energyLevel: number; mood: string }
  /** Plain-text file content (HTML, TXT, MD, CSV, etc.) */
  fileContent?: string
  /** Original filename, used in context block */
  fileName?: string
  /** Base64-encoded PDF (native Claude document support) */
  fileBase64?: string
  fileMimeType?: string
  /** Base64-encoded image — processed via Haiku vision then stored as memory */
  imageBase64?: string
  imageMimeType?: string
  /**
   * Recent conversation history from the current session.
   * Injected as context so Arc remembers what was said earlier in the chat.
   */
  conversationHistory?: Array<{ role: 'user' | 'oracle'; text: string }>
  /** If provided, Arc will stream text chunks to this callback instead of returning the full response at once */
  onChunk?: (chunk: string) => void
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

/**
 * Build a "WHO THIS PERSON IS" context block from the user's profile.
 * Injected into both the Arc system prompt and each specialist call so
 * every response is personalised to their identity, wiring, and life context.
 */
function buildPersonContext(profile: UserProfileRow): string {
  const lines: string[] = ['WHO THIS PERSON IS (always factor this in):']

  // Personal facts
  const facts: string[] = []
  if (profile.displayName) facts.push(`Name: ${profile.displayName}`)
  if (profile.age)          facts.push(`Age: ${profile.age}`)
  if (profile.location)     facts.push(`Lives in: ${profile.location}`)
  if (profile.familyInfo)   facts.push(profile.familyInfo)
  if (profile.financialStatus) facts.push(profile.financialStatus)
  if (profile.relationshipStatus) facts.push(profile.relationshipStatus)
  if (facts.length) lines.push(facts.join(' · '))

  // Personality archetypes
  if (profile.enneagram) {
    lines.push(`Enneagram: ${profile.enneagram} — The Achiever-Artist. Driven by success and recognition, but equally hungry for depth and authenticity. Can conflate worth with output. Needs to be seen for who they ARE, not just what they achieve.`)
  }

  if (profile.sunSign || profile.risingSign) {
    const astro: string[] = []
    if (profile.sunSign)    astro.push(`${profile.sunSign} Sun — bold, pioneering, direct, impatient, needs to lead`)
    if (profile.risingSign) astro.push(`${profile.risingSign} Rising — intuitive, protective, reads the room, feels everything more deeply than they show`)
    lines.push(`Astrology: ${astro.join('. ')}.`)
  }

  if (profile.neurodivergentNotes) {
    lines.push(`Neurodivergent wiring: ${profile.neurodivergentNotes}. This means: pattern-thinking, hyperfocus, sensory depth, non-linear processing, tendency to over-research before acting. Don't pathologise — this is a superpower with sharp edges.`)
  }

  lines.push(`HOW TO SPEAK TO THEM: Direct and warm. Acknowledge the complexity underneath. Don't oversimplify. They can handle the real picture. Avoid generic affirmations. They will see through performance.`)

  return lines.join('\n')
}

/**
 * Describe a photo using Haiku vision and store it as an arc memory.
 * Returns the description string so Arc can reference it in its response.
 */
async function processPhotoAndStore(
  imageBase64: string,
  imageMimeType: string,
  userId: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: SPECIALIST_MODEL,
    max_tokens: 300,
    system: `You are a visual memory assistant for a life coaching app. The user has shared a personal photo.
Describe what you see in 2-4 sentences: the scene, mood, context, time of day if apparent, and any emotional resonance.
Then on a new line starting with MEMORY:, write a single concise memory sentence in first-person Arc voice (e.g. "Shared a photo of morning coffee in what looks like a café abroad — seems like a slow, content moment").
Focus on the human experience, not technical image details.`,
    messages: [{
      role: 'user',
      content: [{
        type: 'image',
        source: { type: 'base64', media_type: imageMimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: imageBase64 },
      }],
    }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  // Extract the MEMORY: line for storage
  const memoryMatch = text.match(/MEMORY:\s*(.+)/i)
  const memoryLine = memoryMatch?.[1]?.trim()
  if (memoryLine) {
    // Store as arc memory — fire-and-forget, don't block
    void saveDimensionMemory('arc', memoryLine, 'photo', 7, userId)
  }
  // Return just the description part (before MEMORY:)
  const memoryIdx = text.search(/MEMORY:/i)
  return (memoryIdx >= 0 ? text.slice(0, memoryIdx) : text).trim()
}

async function loadRecentJournalContext(userId: string): Promise<string> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    const { data: notes } = await supabaseAdmin
      .from('voice_notes')
      .select('content, brief, oracle_reply, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6)

    if (!notes?.length) return ''

    return notes
      .map(n => {
        const date = new Date(n.created_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        const text = (n.brief as string | null) ?? (n.content as string).slice(0, 300)
        return `[${date}] ${text}`
      })
      .join('\n')
  } catch {
    return ''
  }
}

async function loadActiveQuestsContext(userId: string): Promise<string> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    const { data: quests } = await supabaseAdmin
      .from('main_quests')
      .select('dimension, vision, character_name')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at')

    if (!quests?.length) return ''

    // Also grab active milestones for each quest
    const { data: milestones } = await supabaseAdmin
      .from('milestones')
      .select('title, target_date, dimension')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('sort_order')
      .limit(10)

    const milestonesByDim: Record<string, string[]> = {}
    for (const m of milestones ?? []) {
      const dim = m.dimension as string
      if (!milestonesByDim[dim]) milestonesByDim[dim] = []
      milestonesByDim[dim].push(m.title as string)
    }

    return quests
      .map(q => {
        const dim = q.dimension as string
        const ms = milestonesByDim[dim]?.slice(0, 2).join(', ')
        return `${dim.toUpperCase()}: "${q.vision}"${ms ? ` → milestones: ${ms}` : ''}`
      })
      .join('\n')
  } catch {
    return ''
  }
}

export async function consultArc(input: ArcInput): Promise<ArcOutput> {
  const { userMessage, userId, checkInData, fileContent, fileName, fileBase64, fileMimeType, imageBase64, imageMimeType } = input

  // Load profile, arc relationship memories, and all external context in parallel
  const [loadedOura, { calendarContext, freeBlocks }, profileResult, arcMemories, gmailDigestResult, recentJournalEntries, activeQuestsResult] = await Promise.all([
    input.ouraData !== undefined
      ? Promise.resolve({ payload: input.ouraData, contextBlock: '' })
      : loadOuraContextForUser(userId),
    loadCalendarContextForUser(userId),
    getUserProfile(userId).catch(() => null),
    getDimensionMemories('arc', 25, userId).catch(() => [] as string[]),  // increased from 15
    getGmailDigest(userId).catch(() => null),
    // Fetch recent journal entries / voice notes for richer conversation context
    loadRecentJournalContext(userId).catch(() => ''),
    // Fetch active main quests so Arc knows what they're working toward
    loadActiveQuestsContext(userId).catch(() => ''),
  ])

  const ouraContextBlock = loadedOura.contextBlock
  const personContextBlock = profileResult ? buildPersonContext(profileResult) : ''
  const gmailContext = (gmailDigestResult?.arc_summary as string | undefined) ?? ''

  const allDimensions: DimensionId[] = isCheckIn(userMessage)
    ? ['vitality', 'mind', 'create', 'social', 'love', 'family', 'wealth']
    : detectDimensions(userMessage)

  const memoriesByDimension = await Promise.all(
    allDimensions.map(async (dim) => ({
      dim,
      memories: await getDimensionMemories(toPersistenceId(dim), 15, userId),  // increased from 8
    }))
  )
  const memoryMap = Object.fromEntries(
    memoriesByDimension.map(({ dim, memories }) => [dim, memories])
  ) as Record<DimensionId, string[]>

  const specialistResults = await Promise.all(
    allDimensions.map((dim) => {
      const dimensionExtra =
        dim === 'create' && (calendarContext || gmailContext)
          ? `WORK CONTEXT TODAY:\n${calendarContext || ''}\n${gmailContext ? `Inbox: ${gmailContext}` : ''}\nFree blocks: ${freeBlocks.join(', ') || 'check calendar'}`
          : dim === 'love' && calendarContext
            ? `Schedule note: ${calendarContext.split('\n')[0]}`
            : undefined

      const specialistExtra = [personContextBlock, dimensionExtra].filter(Boolean).join('\n\n') || undefined

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

  const arcMemoryBlock =
    arcMemories.length > 0
      ? `EMOTIONAL & RELATIONAL MEMORY (what you know about how this person feels, relates, and patterns):\n${arcMemories.join('\n')}`
      : ''

  // ── Process image attachment (vision pre-processing) ──────────────────────
  let photoContextBlock = ''
  if (imageBase64 && imageMimeType) {
    try {
      const description = await processPhotoAndStore(imageBase64, imageMimeType, userId)
      photoContextBlock = description
        ? `PHOTO SHARED BY USER:\n${description}`
        : ''
    } catch {
      // Continue without photo context if vision fails
    }
  }

  // ── Build file context block ───────────────────────────────────────────────
  let fileContextBlock = ''
  if (fileContent && fileName) {
    // Plain text file — truncate if too large (keep first 8000 chars)
    const truncated = fileContent.length > 8000 ? fileContent.slice(0, 8000) + '\n\n[... file truncated ...]' : fileContent
    fileContextBlock = `FILE SHARED BY USER (${fileName}):\n${truncated}`
  }

  // Build conversation history block (last 10 exchanges so Arc remembers the thread)
  const historyBlock = input.conversationHistory && input.conversationHistory.length > 0
    ? `EARLIER IN THIS CONVERSATION (most recent last):\n${
        input.conversationHistory
          .slice(-10)
          .map(m => `${m.role === 'user' ? 'User' : 'Oracle'}: ${m.text}`)
          .join('\n')
      }`
    : ''

  const contextSection = [
    personContextBlock ? personContextBlock : '',
    arcMemoryBlock,
    activeQuestsResult ? `WHAT THEY'RE WORKING ON (active quests):\n${activeQuestsResult}` : '',
    recentJournalEntries ? `RECENT JOURNAL / VOICE REFLECTIONS:\n${recentJournalEntries}` : '',
    ouraContextBlock
      ? `BIODATA FOR TODAY (from Oura Ring — use for energy/recovery calibration):\n${ouraContextBlock}`
      : '',
    calendarContext ? `SCHEDULE FOR TODAY:\n${calendarContext}` : '',
    freeBlocks.length > 0 ? `FREE BLOCKS FOR DEEP WORK:\n${freeBlocks.join('\n')}` : '',
    gmailContext ? `INBOX STATUS:\n${gmailContext}` : '',
    historyBlock,
    photoContextBlock,
    fileContextBlock,
  ]
    .filter(Boolean)
    .join('\n\n')

  const contextSectionBlock = contextSection ? `\n\n${contextSection}` : ''

  // Build the user message line — include filename hint if file is attached
  const fileHint = fileName && (fileContent || fileBase64 || imageBase64)
    ? ` [Attached: ${fileName}]`
    : ''
  const effectiveUserMessage = userMessage || (fileName ? `I've shared a file: ${fileName}` : '')

  // For PDF files, build a native document message
  const arcUserContent: Parameters<typeof anthropic.messages.create>[0]['messages'][0]['content'] | null =
    fileBase64 && fileMimeType === 'application/pdf'
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } } as { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } },
          { type: 'text', text: effectiveUserMessage || 'Please review this document and help me understand how to use it.' },
        ]
      : null

  const synthesisPrompt =
    activeResults.length > 0
      ? `User said: "${effectiveUserMessage}"${fileHint}${checkInContext}

Specialist insights:
${specialistContext}

Respond to the user as Arc. One unified response. Draw on what's relevant from the specialists.
Do not address every dimension — just what actually matters right now.`
      : `User said: "${effectiveUserMessage}"${fileHint}${checkInContext}

No specialist insights were available. Respond as Arc with warmth and specificity based on what they said.`

  let arcResponse = ''
  const { onChunk } = input

  if (onChunk) {
    // Streaming path — push text chunks to the caller as they arrive
    const arcStream = anthropic.messages.stream({
      model: ARC_MODEL,
      max_tokens: 700,
      system: `${ARC_SYNTHESIS_PROMPT}${contextSectionBlock}`,
      messages: [{ role: 'user', content: arcUserContent !== null ? arcUserContent : synthesisPrompt }],
    })
    arcStream.on('text', (text) => {
      arcResponse += text
      onChunk(text)
    })
    await arcStream.finalMessage()
    if (!arcResponse) arcResponse = "I'm here. Tell me more."
  } else {
    // Non-streaming path (used by morning check-in, witness, etc.)
    const arcMessage = await anthropic.messages.create({
      model: ARC_MODEL,
      max_tokens: 700,
      system: `${ARC_SYNTHESIS_PROMPT}${contextSectionBlock}`,
      messages: [{ role: 'user', content: arcUserContent !== null ? arcUserContent : synthesisPrompt }],
    })
    arcResponse =
      arcMessage.content[0].type === 'text'
        ? arcMessage.content[0].text
        : "I'm here. Tell me more."
  }

  const memoryPromises = activeResults
    .filter((r) => r.memoryToStore.trim().length > 0)
    .map((r) =>
      saveDimensionMemory(toPersistenceId(r.dimensionId), r.memoryToStore, 'conversation', 6, userId)
    )
  await Promise.allSettled(memoryPromises)

  // Fire-and-forget: extract emotional/relational patterns into arc memory.
  // Runs after response is returned — never delays the user.
  void writeRelationshipMemory(userMessage, arcResponse, userId)

  const questSuggestions = activeResults
    .filter((r) => r.questSuggestion)
    .map((r) => r.questSuggestion as string)

  return {
    response: arcResponse,
    dimensionsConsulted: allDimensions,
    questSuggestions,
  }
}
