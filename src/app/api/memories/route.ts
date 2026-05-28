import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { anthropic } from '@/lib/anthropic'

// Allow up to 20 MB body — base64-encoded photos can be large
export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
}

// Next.js App Router body size override
export const maxDuration = 60

const BUCKET = 'memory-photos'

// ── Oracle vision processing ──────────────────────────────────────────────────

async function processWithOracle(
  imageBase64: string,
  imageMimeType: string,
  context: string,
): Promise<{ caption: string; reflection: string; dimensions: string[]; chapter: string }> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: `You are Oracle — a warm, perceptive life coach who knows this person deeply. You are looking at a photo they just added to their personal journal. Your job is to witness this moment and weave it into the story of their life right now.`,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: imageMimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: imageBase64 },
        },
        {
          type: 'text',
          text: `Here is what's happening in this person's life right now:\n\n${context}\n\nLook at this photo and respond with JSON only (no markdown, no explanation):\n{\n  "caption": "One specific sentence, max 15 words, naming what's in the photo and tying it to something real in their life",\n  "reflection": "2-3 sentences of Oracle's take on what this moment means given where they are in their story. Warm and specific — reference their actual context, not generic wisdom.",\n  "dimensions": ["one or two of: career, social, wealth, vitality, mind, love, family"],\n  "chapter": "A short evocative chapter title for this period of their life, 2-5 words, like 'The Rebuild' or 'London in May' or 'Learning to Trust'"\n}`,
        },
      ],
    }],
  })

  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '{}'
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(cleaned) as { caption: string; reflection: string; dimensions: string[]; chapter: string }
  } catch {
    return { caption: 'A moment worth remembering.', reflection: raw, dimensions: [], chapter: 'My Story' }
  }
}

// ── Fetch lightweight context for Oracle ─────────────────────────────────────

async function getContext(userId: string): Promise<string> {
  try {
    const { data: notes } = await supabase
      .from('voice_notes')
      .select('content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!notes?.length) return 'No recent journal entries.'

    return notes
      .map(n => {
        const date = new Date(n.created_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        return `${date}: "${(n.content as string).slice(0, 200)}"`
      })
      .join('\n')
  } catch {
    return 'No context available.'
  }
}

// ── Upload image to Supabase storage ─────────────────────────────────────────

async function uploadPhoto(userId: string, imageBase64: string, imageMimeType: string): Promise<string> {
  const ext = imageMimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
  const filename = `${userId}/${Date.now()}.${ext}`
  const imageBuffer = Buffer.from(imageBase64, 'base64')

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, imageBuffer, { contentType: imageMimeType, upsert: false })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  return publicUrl
}

// ── POST /api/memories ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId, imageBase64, imageMimeType, location } = await req.json() as {
      userId: string; imageBase64: string; imageMimeType: string; location?: string
    }

    if (!userId || !imageBase64 || !imageMimeType) {
      return NextResponse.json({ error: 'userId, imageBase64, and imageMimeType are required' }, { status: 400 })
    }

    // Fetch context + upload photo in parallel, then process with Oracle
    const [context, photoUrl] = await Promise.all([
      getContext(userId),
      uploadPhoto(userId, imageBase64, imageMimeType),
    ])

    const oracleResult = await processWithOracle(imageBase64, imageMimeType, context)

    const { data, error } = await supabase
      .from('memories')
      .insert({
        user_id: userId,
        photo_url: photoUrl,
        caption: oracleResult.caption,
        reflection: oracleResult.reflection,
        dimensions: oracleResult.dimensions ?? [],
        chapter: oracleResult.chapter ?? null,
        location: location ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ memory: data })
  } catch (err) {
    console.error('memories POST error:', err)
    return NextResponse.json({ error: 'Failed to save memory' }, { status: 500 })
  }
}

// ── GET /api/memories ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const dimension = searchParams.get('dimension')
  const limit = Number(searchParams.get('limit') ?? '60')

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  let query = supabase
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (dimension) {
    query = query.contains('dimensions', [dimension])
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ memories: data ?? [] })
}

// ── DELETE /api/memories?id=xxx&userId=xxx ────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const userId = searchParams.get('userId')

  if (!id || !userId) return NextResponse.json({ error: 'id and userId required' }, { status: 400 })

  const { data: mem } = await supabase
    .from('memories')
    .select('photo_url, user_id')
    .eq('id', id).eq('user_id', userId)
    .single()

  if (!mem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Clean up storage
  try {
    const url = new URL(mem.photo_url as string)
    const path = url.pathname.split(`/${BUCKET}/`)[1]
    if (path) await supabase.storage.from(BUCKET).remove([path])
  } catch { /* ignore */ }

  const { error } = await supabase.from('memories').delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
