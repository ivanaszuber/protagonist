'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { CheckInData as ApiCheckInData } from '@/app/api/checkin/route'
import type { Quest as ApiQuest } from '@/app/api/quests/generate/route'
import type { Quest, CheckInData } from '@/types'
import { QuestCard } from '@/components/quests/QuestCard'
import { mapApiQuestsToAppQuests } from '@/lib/questMapper'
import { getUserId } from '@/lib/user'
import { buildOuraContext } from '@/lib/oura'

type FlowState =
  | 'idle'
  | 'recording'
  | 'processing-checkin'
  | 'processing-quests'
  | 'done'
  | 'error'

interface VoiceCheckinProps {
  onQuestsGenerated?: (quests: Quest[], checkIn: CheckInData, transcript: string) => void
}

export function VoiceCheckin({ onQuestsGenerated }: VoiceCheckinProps) {
  const [flowState, setFlowState] = useState<FlowState>('idle')
  const [transcript, setTranscript] = useState('')
  const [checkIn, setCheckIn] = useState<ApiCheckInData | null>(null)
  const [quests, setQuests] = useState<ApiQuest[]>([])
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const transcriptRef = useRef('')

  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  const processCheckIn = useCallback(async (finalTranscript: string) => {
    if (finalTranscript.trim().length < 3) {
      setError('Say a bit more — Arc needs at least a few words to work with.')
      setFlowState('error')
      return
    }

    setFlowState('processing-checkin')

    try {
      const checkinRes = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: finalTranscript }),
      })

      if (!checkinRes.ok) {
        const body = await checkinRes.json().catch(() => ({}))
        throw new Error(
          typeof body.error === 'string' ? body.error : 'Check-in processing failed'
        )
      }

      const checkInData: ApiCheckInData = await checkinRes.json()
      setCheckIn(checkInData)

      setFlowState('processing-quests')

      let ouraContext: string | undefined
      try {
        const userId = getUserId()
        const syncRes = await fetch('/api/oura/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        const syncData = await syncRes.json()
        if (syncData.connected && syncData.data) {
          ouraContext = buildOuraContext(syncData.data)
        }
      } catch {
        // Oura optional — continue without
      }

      const questsRes = await fetch('/api/quests/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...checkInData, ouraContext }),
      })

      if (!questsRes.ok) {
        const body = await questsRes.json().catch(() => ({}))
        throw new Error(
          typeof body.error === 'string' ? body.error : 'Quest generation failed'
        )
      }

      const questData: ApiQuest[] = await questsRes.json()
      const appCheckIn: CheckInData = {
        energyLevel: checkInData.energyLevel,
        mood: checkInData.mood,
        socialBattery: checkInData.socialBattery,
        mainConcern: checkInData.mainConcern,
        mainDesire: checkInData.mainDesire,
        arcResponse: checkInData.arcResponse,
      }

      if (onQuestsGenerated) {
        onQuestsGenerated(
          mapApiQuestsToAppQuests(questData),
          appCheckIn,
          finalTranscript.trim()
        )
        reset()
        return
      }

      setQuests(questData)
      setFlowState('done')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again?')
      setFlowState('error')
    }
  }, [onQuestsGenerated])

  const startRecording = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Voice recording not supported in this browser. Please use Chrome.')
      setFlowState('error')
      return
    }

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const fullTranscript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ')
      setTranscript(fullTranscript)
      transcriptRef.current = fullTranscript
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'network' || event.error === 'not-allowed') {
        // Fall back to text input gracefully
        recognition.stop()
        setFlowState('idle')
        const text = window.prompt('Arc is listening (text mode) — how are you feeling today?')
        if (text?.trim()) {
          processCheckIn(text)
        }
      } else {
        setError(`Recording error: ${event.error}`)
        setFlowState('error')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setFlowState('recording')
    setTranscript('')
    transcriptRef.current = ''
    setError(null)
  }, [])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    void processCheckIn(transcriptRef.current)
  }, [processCheckIn])

  const submitTypedCheckIn = useCallback(
    (text: string) => {
      setTranscript(text)
      transcriptRef.current = text
      void processCheckIn(text)
    },
    [processCheckIn]
  )

  const reset = () => {
    recognitionRef.current?.abort()
    setFlowState('idle')
    setTranscript('')
    transcriptRef.current = ''
    setCheckIn(null)
    setQuests([])
    setError(null)
  }

  if (flowState === 'done' && checkIn && quests.length > 0) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 20px' }}>
        <div
          style={{
            background: 'rgba(123,63,228,0.1)',
            border: '1px solid rgba(123,63,228,0.25)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '14px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #FFD4C8, #FF7A65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                boxShadow: '0 0 16px rgba(255,122,101,0.4)',
                flexShrink: 0,
              }}
            >
              ✦
            </div>
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#A87EF8',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}
              >
                Arc · The Oracle
              </div>
              <div style={{ fontSize: '11px', color: '#6B5E8C' }}>
                Energy {checkIn.energyLevel}/10 · {checkIn.mood}
              </div>
            </div>
          </div>
          <p
            style={{
              fontSize: '15px',
              color: '#F0ECFF',
              lineHeight: 1.7,
              fontStyle: 'italic',
            }}
          >
            &ldquo;{checkIn.arcResponse}&rdquo;
          </p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: '#6B5E8C',
              marginBottom: '16px',
            }}
          >
            Today&apos;s Quests
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mapApiQuestsToAppQuests(quests).map((quest) => (
              <QuestCard key={quest.id} quest={quest} onComplete={() => {}} />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={reset}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#6B5E8C',
            padding: '10px 20px',
            borderRadius: '100px',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginTop: '8px',
          }}
        >
          ↺ New Check-In
        </button>
      </div>
    )
  }

  if (flowState === 'processing-checkin' || flowState === 'processing-quests') {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #FFD4C8, #FF7A65)',
            margin: '0 auto 24px',
            boxShadow: '0 0 40px rgba(255,122,101,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          ✦
        </div>
        <p style={{ fontSize: '16px', color: '#9B8EC4', fontWeight: 500 }}>
          {flowState === 'processing-checkin'
            ? 'Arc is listening…'
            : 'Generating your quests…'}
        </p>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.9; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.05); }
          }
        `}</style>
      </div>
    )
  }

  if (flowState === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: '#FF6060', marginBottom: '16px' }}>{error}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: 'rgba(255,122,101,0.1)',
            border: '1px solid rgba(255,122,101,0.3)',
            color: '#FF7A65',
            padding: '12px 24px',
            borderRadius: '100px',
            fontSize: '14px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '60px 20px',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 35% 35%, #FFD4C8, #FF7A65 60%, #CC4A33)',
          margin: '0 auto 32px',
          boxShadow:
            flowState === 'recording'
              ? '0 0 60px rgba(255,122,101,0.6), 0 0 100px rgba(255,122,101,0.2)'
              : '0 0 30px rgba(255,122,101,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '36px',
          transition: 'box-shadow 0.4s',
          animation:
            flowState === 'recording'
              ? 'pulse 1s ease-in-out infinite'
              : 'float 3s ease-in-out infinite',
        }}
      >
        {flowState === 'recording' ? '🎙' : '✦'}
      </div>

      <h2
        style={{
          fontSize: '26px',
          fontWeight: 700,
          color: '#F0ECFF',
          marginBottom: '10px',
          lineHeight: 1.2,
        }}
      >
        {flowState === 'recording' ? 'Arc is listening…' : 'Good morning.'}
      </h2>

      <p
        style={{
          fontSize: '16px',
          color: '#9B8EC4',
          marginBottom: '40px',
          lineHeight: 1.6,
        }}
      >
        {flowState === 'recording'
          ? "Tell Arc how you're feeling. What's on your mind? Tap the mic when you're done."
          : "How are you feeling today? What's on your mind? Tap the mic and just talk."}
      </p>

      {flowState === 'recording' && transcript && (
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '32px',
            fontSize: '14px',
            color: '#9B8EC4',
            fontStyle: 'italic',
            lineHeight: 1.6,
            textAlign: 'left',
          }}
        >
          &ldquo;{transcript}&rdquo;
        </div>
      )}

      <button
        type="button"
        onClick={flowState === 'recording' ? stopRecording : startRecording}
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          border: 'none',
          background:
            flowState === 'recording'
              ? 'rgba(255,96,96,0.15)'
              : 'rgba(255,122,101,0.15)',
          cursor: 'pointer',
          fontSize: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          transition: 'all 0.2s',
          outline: `2px solid ${flowState === 'recording' ? 'rgba(255,96,96,0.4)' : 'rgba(255,122,101,0.3)'}`,
          outlineOffset: '4px',
        }}
      >
        {flowState === 'recording' ? '⏹' : '🎙'}
      </button>

      <p style={{ fontSize: '12px', color: '#6B5E8C', marginTop: '16px' }}>
        {flowState === 'recording' ? 'Tap to stop' : 'Tap to speak'}
      </p>

      {flowState === 'idle' && (
        <p style={{ fontSize: '12px', color: '#6B5E8C', marginTop: '32px' }}>
          No mic?{' '}
          <button
            type="button"
            onClick={() => {
              const text = prompt('Type your check-in:')
              if (text?.trim()) {
                submitTypedCheckIn(text.trim())
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#A87EF8',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Type instead
          </button>
        </p>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
