import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin as supabase, isSupabaseConfigured } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ALL_DIMENSIONS = ['career', 'social', 'wealth', 'vitality', 'mind', 'love', 'family'] as const
type Dim = typeof ALL_DIMENSIONS[number]

export interface ExtractedMemory {
  dimension: Dim
  content: string
  importance: number
  label: string // short human-readable label for the preview
}

/**
 * Try to flatten a ChatGPT JSON export into plain text.
 * Handles the standard export format: conversations[] with messages[].
 */
function flattenChatGptJson(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw)
    const conversations: unknown[] = Array.isArray(parsed) ? (parsed as unknown[]) : [parsed as unknown]
    const lines: string[] = []

    for (const conv of conversations) {
      if (!conv || typeof conv !== 'object') continue
      const c = conv as Record<string, unknown>

      // Title
      if (typeof c.title === 'string') {
        lines.push(`=== ${c.title} ===`)
      }

      // Messages
      const mappingObj = !Array.isArray(c.mapping) && c.mapping && typeof c.mapping === 'object'
        ? (c.mapping as Record<string, unknown>)
        : null
      const msgs: unknown[] | null = mappingObj
        ? Object.values(mappingObj)
        : Array.isArray(c.messages)
          ? (c.messages as unknown[])
          : null

      if (!msgs) continue

      for (const msgNode of msgs) {
        const node = msgNode as Record<string, unknown>
        // handle mapping node structure
        const msg = (node.message ?? node) as Record<string, unknown>
        if (!msg) continue

        const author = (msg.author as Record<string, string> | undefined)?.role ?? ''
        const content = msg.content as Record<string, unknown> | null
        if (!content) continue

        const parts = Array.isArray(content.parts) ? content.parts as unknown[] : null
        const text = parts
          ? parts.filter(p => typeof p === 'string').join(' ')
          : typeof content === 'string' ? content : ''

        if (!text.trim()) continue
        const role = author === 'assistant' ? 'ChatGPT' : 'Me'
        lines.push(`${role}: ${text.trim()}`)
      }
    }

    return lines.length > 5 ? lines.join('\n') : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const body = await request.json() as {
    userId: string
    text?: string
    memories?: ExtractedMemory[]
    save?: boolean
  }

  const { userId, save } = body

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  // ── SAVE mode: persist confirmed memories ────────────────────────────────
  if (save && body.memories) {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const rows = body.memories.map(m => ({
      user_id: userId,
      dimension_id: m.dimension,
      content: m.content,
      source: 'chatgpt_import',
      importance: m.importance,
    }))

    console.log('[import-context] Saving', rows.length, 'rows for userId:', userId)

    const { data: insertData, error } = await supabase
      .from('dimension_memories')
      .insert(rows)
      .select('id')

    console.log('[import-context] Insert result — data:', insertData, 'error:', error)

    if (error) {
      return NextResponse.json({ error: error.message, detail: error.details, hint: error.hint }, { status: 500 })
    }

    return NextResponse.json({ saved: insertData?.length ?? rows.length })
  }

  // ── EXTRACT mode: analyze pasted text ───────────────────────────────────
  if (!body.text?.trim()) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  // Try to parse ChatGPT JSON export, fall back to raw text
  const rawText = body.text.trim()
  const text = flattenChatGptJson(rawText) ?? rawText

  // Truncate to ~40k chars to stay within token limits
  const truncated = text.length > 40000 ? text.slice(0, 40000) + '\n\n[truncated for length]' : text

  const prompt = `You are Arc, a perceptive life coach AI reading a conversation history that a user has shared from ChatGPT. Your job is to extract the most meaningful, specific insights about this person's life — their goals, struggles, values, patterns, fears, relationships, and growth — and organize them by life dimension.

You will output a JSON array of memory objects. Each memory should be:
- Specific and personal (not generic advice)
- Written in third person about the user ("She wants to...", "He has been struggling with...", "They recently...")
- Actually derived from what was said — do not invent things
- Concise (1–3 sentences max)
- Tagged with the most relevant dimension

Dimensions:
- career: work, job, business, side projects, purpose, professional goals, productivity
- social: friendships, networking, community, social energy, going out
- wealth: money, savings, investments, financial goals, spending habits, income
- vitality: exercise, health, sleep, food, body, energy levels, medical things
- mind: learning, reading, study, courses, focus, clarity, mental patterns, therapy insights
- love: romantic relationships, dating, partnership, intimacy, connection with a partner
- family: family members, home life, children, parents, siblings, household

Importance scoring (1-10):
- 9-10: Core life themes, recurring deep struggles or major goals
- 7-8: Clear goals or significant patterns
- 5-6: Useful context, preferences, or habits
- 3-4: Minor details worth remembering

Output ONLY valid JSON — an array of objects with:
{
  "dimension": "career" | "social" | "wealth" | "vitality" | "mind" | "love" | "family",
  "content": "The memory text...",
  "importance": 7,
  "label": "Short 3-6 word label for display"
}

Extract 5–20 memories. Focus on quality over quantity. If the conversation is mostly technical help with no personal context, extract fewer.

CONVERSATION:
${truncated}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'

    let memories: ExtractedMemory[]
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      memories = jsonMatch ? (JSON.parse(jsonMatch[0]) as ExtractedMemory[]) : []
    } catch {
      memories = []
    }

    // Validate and filter
    memories = memories.filter(m =>
      ALL_DIMENSIONS.includes(m.dimension as Dim) &&
      typeof m.content === 'string' &&
      m.content.length > 10
    )

    return NextResponse.json({ memories, totalFound: memories.length })
  } catch (error) {
    console.error('Import context error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
