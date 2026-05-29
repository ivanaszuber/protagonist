import { NextRequest, NextResponse } from 'next/server'
import { consultArc } from '@/lib/agents/arc'

// Increase body size limit for this route — needed for multi-image payloads
export const maxDuration = 60  // seconds (allows time to process many images)
// Next.js App Router doesn't expose a per-route bodyParser limit,
// but with client-side compression active, payloads stay well under 10 MB.

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const {
      message,
      userId,
      ouraData,
      checkInData,
      fileContent,
      fileName,
      fileBase64,
      fileMimeType,
      imageBase64,
      imageMimeType,
      attachments,
      conversationHistory,
    } = await req.json() as {
      message?: string
      userId?: string
      ouraData?: { sleepScore?: number; readiness?: number; hrv?: number }
      checkInData?: { energyLevel: number; mood: string }
      fileContent?: string
      fileName?: string
      fileBase64?: string
      fileMimeType?: string
      imageBase64?: string
      imageMimeType?: string
      attachments?: Array<{ type: 'file' | 'image'; name: string; content: string; mimeType?: string }>
      conversationHistory?: Array<{ role: 'user' | 'oracle'; text: string }>
    }

    const hasContent = message?.trim() || fileContent || fileBase64 || imageBase64 || (attachments && attachments.length > 0)
    if (!hasContent) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 })
    }

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          await consultArc({
            userMessage: message ?? '',
            userId: userId || 'default',
            ouraData,
            checkInData,
            fileContent,
            fileName,
            fileBase64,
            fileMimeType,
            imageBase64,
            imageMimeType,
            attachments,
            conversationHistory,
            onChunk: (chunk) => {
              controller.enqueue(encoder.encode(chunk))
            },
          })
        } catch (error) {
          console.error('Arc stream error:', error)
          controller.enqueue(encoder.encode("The Oracle is having a moment. Try again."))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('Arc route error:', error)
    return NextResponse.json(
      { error: 'The Oracle is having a moment. Try again.' },
      { status: 500 }
    )
  }
}
