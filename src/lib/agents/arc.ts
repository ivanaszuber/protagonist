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

const ARC_SYNTHESIS_PROMPT = `You are Arc, the Oracle — a sharp, warm, deeply perceptive AI life coach
and this person's most trusted companion. You know them better than almost anyone.

You have received insights from your specialist advisors. Synthesise them into one response in your
voice — not a list of what each specialist said, but a single coherent perspective that draws on
whatever is most relevant. Ignore specialists whose angle doesn't add anything.

━━ READ THE REGISTER FIRST ━━
Before writing a word, identify what kind of message this is — and commit to the appropriate depth:

PERSONAL / EMOTIONAL / VULNERABLE
Anything touching relationships, family (Zara, Leo), feelings, fear, love, grief, loneliness,
hard moments, or moments where they're really opening up to you.
→ This is your most important mode. Go deep. Lead with empathy — be warm and present
  BEFORE being wise. Then do the real work: name the pattern, surface the thing they
  haven't said, offer the psychological insight that actually helps.
  Use 1–3 emojis that feel natural. Write as many paragraphs as the topic deserves.
  Do NOT cut yourself short on emotional topics — they came here to be understood.

REFLECTIVE / CHECK-IN / "HOW AM I DOING"
Morning check-ins, big picture questions, reviewing the week, asking for perspective.
→ Be the brilliant friend who sees what they can't. Connect dots across dimensions of
  their life. Reference patterns you've noticed. Be specific — not "you've been doing well"
  but "you've logged 4 workouts this week but I notice you haven't mentioned Leo once."
  This is a place for real insight, not affirmation. Warm but sharp.

PLANNING / ACTION-ORIENTED
What to do, next steps, how to approach something.
→ Specific and energising. Give the actual answer, not a framework. End with the
  single clearest next action. Keep it tight.

FINANCIAL / PRACTICAL / NUMBERS
Money, strategies, specific decisions, risk, FIRE calculations.
→ Direct and concrete. Separate the math from the emotion — address both.
  No emojis. Short lists are fine if there are genuinely 3+ distinct points.

━━ DEPTH & LENGTH ━━
Match the depth they gave you. If they shared something real — a fear, a relationship moment,
a genuine question about their life — give something real back. Don't summarise; go deeper.
If they sent a quick message, keep it tight. If they're processing something big, go long.

Use paragraph breaks freely. Never use headers. Lists only for genuinely list-like content.
Write the way an extraordinarily perceptive friend talks — not a therapist, not a bullet-point bot.

━━ PSYCHOLOGICAL DEPTH — THIS IS THE STANDARD TO HIT ━━
Surface what's underneath the surface. If someone says "I feel stuck," don't just validate it —
ask what stuck actually means for them, or name the specific thing you think is creating it.
Name patterns across time: "This is the third time this month you've mentioned X."
Connect different areas of their life: "When your sleep dips, your confidence about the app follows."
Offer the reframe they haven't considered, the question they haven't asked themselves.
Be the person who says what a good friend would say, not what a polite acquaintance would.

━━ TONE ━━
Warm but direct. Playful when it fits, serious when it matters. Never clinical, never corporate.
Never use: "journey", "holistic", "self-care", "wellness", "mindset shift", "navigate", "I'm here for you".
Talk like the most perceptive coach they've ever had — who also genuinely likes them.
Reference their actual life, actual names, actual history. Make them feel *known*, not just heard.

━━ ACTIONS ━━
The app's action system automatically handles tasks, milestones, and calendar events — it runs
before you even respond. Respond as if it's already done: "Added that to your career track."
Be warm and confident. If you genuinely can't infer what they want, ask one short clarifying question.

━━ FILE & DOCUMENT UPLOADS ━━
If a file is shared WITHOUT a clear question: acknowledge briefly, then ask one direct question
about what they want from it. If they gave a clear instruction with the file, respond to that directly.`

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
   * Multiple attachments — images, PDFs, or text files sent together with a message.
   * When provided, takes precedence over the individual imageBase64/fileBase64/fileContent fields.
   */
  attachments?: Array<{ type: 'file' | 'image'; name: string; content: string; mimeType?: string }>
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
      max_tokens: 600,
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

  // ── Process attachments (multi-file support) ──────────────────────────────
  // Merge legacy single-attachment fields with the new attachments[] array
  const allAttachments: Array<{ type: 'file' | 'image'; name: string; content: string; mimeType?: string }> = []
  if (input.attachments && input.attachments.length > 0) {
    allAttachments.push(...input.attachments)
  } else {
    if (imageBase64 && imageMimeType) allAttachments.push({ type: 'image', name: fileName ?? 'image', content: imageBase64, mimeType: imageMimeType })
    else if (fileBase64 && fileMimeType) allAttachments.push({ type: 'file', name: fileName ?? 'file', content: fileBase64, mimeType: fileMimeType })
    else if (fileContent && fileName) allAttachments.push({ type: 'file', name: fileName, content: fileContent, mimeType: 'text/plain' })
  }

  let photoContextBlock = ''
  let fileContextBlock = ''
  const pdfAttachments: Array<{ name: string; content: string }> = []

  // Separate by type first
  const imageAttachments = allAttachments.filter(a => a.type === 'image')
  const pdfAtts = allAttachments.filter(a => a.mimeType === 'application/pdf')
  const textAtts = allAttachments.filter(a => a.type !== 'image' && a.mimeType !== 'application/pdf')

  // Process all images in parallel (not sequentially) — avoids timeout with many photos
  const photoDescriptions = await Promise.allSettled(
    imageAttachments.map(att => processPhotoAndStore(att.content, att.mimeType ?? 'image/jpeg', userId)
      .then(desc => ({ name: att.name, desc }))
    )
  )
  for (const result of photoDescriptions) {
    if (result.status === 'fulfilled' && result.value.desc) {
      photoContextBlock += (photoContextBlock ? '\n\n' : '') + `PHOTO SHARED (${result.value.name}):\n${result.value.desc}`
    }
  }

  for (const att of pdfAtts) {
    pdfAttachments.push({ name: att.name, content: att.content })
  }
  for (const att of textAtts) {
    const truncated = att.content.length > 8000 ? att.content.slice(0, 8000) + '\n\n[... file truncated ...]' : att.content
    fileContextBlock += (fileContextBlock ? '\n\n' : '') + `FILE SHARED (${att.name}):\n${truncated}`
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

  // Build the user message line — include filenames hint if files are attached
  const attachedNames = allAttachments.map(a => a.name)
  const fileHint = attachedNames.length > 0 ? ` [Attached: ${attachedNames.join(', ')}]` : ''
  const effectiveUserMessage = userMessage || (attachedNames.length > 0 ? `I've shared ${attachedNames.length > 1 ? 'files' : 'a file'}: ${attachedNames.join(', ')}` : '')

  // Build Claude content array — PDFs as native documents, text message last
  type ClaudeContentBlock =
    | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
    | { type: 'text'; text: string }
  const arcUserContent: ClaudeContentBlock[] | null =
    pdfAttachments.length > 0
      ? [
          ...pdfAttachments.map(p => ({ type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: p.content } })),
          { type: 'text' as const, text: effectiveUserMessage || 'Please review this document and share your thoughts.' },
        ]
      : null

  // Depth signal: how much did the user share? Use this to calibrate response length.
  const userWordCount = effectiveUserMessage.trim().split(/\s+/).length
  const depthSignal =
    userWordCount > 80 ? 'They shared a lot — go deep, this deserves a full response.'
    : userWordCount > 30 ? 'They shared a real thought — give it real depth, not a summary.'
    : userWordCount > 10 ? 'Moderate length — be substantive but tight.'
    : 'Short message — keep your response concise and direct.'

  const synthesisPrompt =
    activeResults.length > 0
      ? `User said: "${effectiveUserMessage}"${fileHint}${checkInContext}

Specialist insights (use what's relevant, ignore what isn't):
${specialistContext}

${depthSignal}

Respond as Arc. One unified response in your voice — not a summary of each specialist.
Draw on the psychological depth in the specialist insights. Surface the real thing.`
      : `User said: "${effectiveUserMessage}"${fileHint}${checkInContext}

${depthSignal}

No specialist insights available. Respond as Arc — draw on your memory of this person,
your knowledge of their patterns, and what you know about the human experience.
Be specific. Be real. Don't be generic.`

  let arcResponse = ''
  const { onChunk } = input

  if (onChunk) {
    // Streaming path — push text chunks to the caller as they arrive
    const arcStream = anthropic.messages.stream({
      model: ARC_MODEL,
      max_tokens: 1400,
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
      max_tokens: 1400,
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
