import { NextRequest, NextResponse } from 'next/server'
import { consultArc } from '@/lib/agents/arc'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const { message, userId, ouraData, checkInData, fileContent, fileName, fileBase64, fileMimeType, imageBase64, imageMimeType } = await req.json()

    if (!message?.trim() && !fileContent && !fileBase64 && !imageBase64) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 })
    }

    const result = await consultArc({
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
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Arc route error:', error)
    return NextResponse.json(
      { error: 'The Oracle is having a moment. Try again.' },
      { status: 500 }
    )
  }
}
