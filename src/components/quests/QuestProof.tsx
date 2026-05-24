'use client'

import { useState, useCallback, useRef } from 'react'
import { Quest, CompletionResult } from '@/types'
import { DIMENSIONS } from '@/lib/dimensions'

type ProofState = 'prompt' | 'recording' | 'processing' | 'result' | 'error'

interface QuestProofProps {
  quest: Quest
  onComplete: (
    xpAwarded: number,
    dimensionId: string,
    proofTranscript: string,
    arcResponse: string
  ) => void
  onClose: () => void
}

export function QuestProof({ quest, onComplete, onClose }: QuestProofProps) {
  const [proofState, setProofState] = useState<ProofState>('prompt')
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<CompletionResult | null>(null)
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const dimension = DIMENSIONS[quest.dimensionId]

  const processProof = useCallback(
    async (text: string) => {
      setTranscript(text)
      setProofState('processing')

      try {
        const res = await fetch('/api/quests/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quest, proofTranscript: text }),
        })

        if (!res.ok) throw new Error('API error')
        const data: CompletionResult = await res.json()
        setResult(data)
        setProofState('result')
      } catch {
        setError('Arc had trouble connecting. Try again?')
        setProofState('error')
      }
    },
    [quest]
  )

  const startVoiceProof = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      const text = window.prompt(
        `Did you complete "${quest.title}"? Tell Arc what happened — be specific.`
      )
      if (text?.trim()) processProof(text.trim())
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    setProofState('recording')

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0]?.[0]?.transcript
      if (text?.trim()) processProof(text.trim())
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'network' || event.error === 'not-allowed') {
        recognition.stop()
        setProofState('prompt')
        const text = window.prompt(
          `Did you complete "${quest.title}"? Tell Arc what happened — be specific.`
        )
        if (text?.trim()) processProof(text.trim())
      } else {
        setError(`Recording error: ${event.error}`)
        setProofState('error')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [quest, processProof])

  const dimColor = dimension.color

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(13, 8, 32, 0.92)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#130E2A',
          border: `1px solid ${dimColor}40`,
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: `0 0 80px ${dimColor}15`,
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: `${dimColor}15`,
              border: `1px solid ${dimColor}30`,
              borderRadius: '100px',
              padding: '5px 14px',
              fontSize: '12px',
              fontWeight: 700,
              color: dimColor,
              marginBottom: '12px',
            }}
          >
            {dimension.emoji} {dimension.name} · {quest.championName}
          </div>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#F0ECFF',
              marginBottom: '6px',
              lineHeight: 1.2,
            }}
          >
            {quest.title}
          </div>
          <div style={{ fontSize: '13px', color: '#9B8EC4', lineHeight: 1.5 }}>
            {quest.description}
          </div>
        </div>

        {proofState === 'prompt' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎙</div>
            <div
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#F0ECFF',
                marginBottom: '8px',
              }}
            >
              Did you do it?
            </div>
            <div
              style={{
                fontSize: '14px',
                color: '#9B8EC4',
                marginBottom: '24px',
                lineHeight: 1.65,
              }}
            >
              Tell Arc what happened. 30 seconds.
              <br />
              How did it feel? What surprised you?
            </div>
            <button
              type="button"
              onClick={startVoiceProof}
              style={{
                background: dimColor,
                color: 'white',
                border: 'none',
                borderRadius: '100px',
                padding: '15px 32px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
                marginBottom: '10px',
                fontFamily: 'inherit',
                boxShadow: `0 8px 24px ${dimColor}40`,
              }}
            >
              Speak your proof →
            </button>
            <button
              type="button"
              onClick={() => {
                const text = window.prompt(
                  `Did you complete "${quest.title}"? Tell Arc what happened — be specific.`
                )
                if (text?.trim()) processProof(text.trim())
              }}
              style={{
                background: 'transparent',
                color: '#9B8EC4',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '100px',
                padding: '11px 24px',
                fontSize: '13px',
                cursor: 'pointer',
                width: '100%',
                marginBottom: '10px',
                fontFamily: 'inherit',
              }}
            >
              Type instead
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                color: '#6B5E8C',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '100px',
                padding: '11px 24px',
                fontSize: '13px',
                cursor: 'pointer',
                width: '100%',
                fontFamily: 'inherit',
              }}
            >
              Not yet — go back
            </button>
          </div>
        )}

        {proofState === 'recording' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: `${dimColor}20`,
                border: `2px solid ${dimColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                margin: '0 auto 16px',
                boxShadow: `0 0 30px ${dimColor}40`,
              }}
            >
              🎙
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#F0ECFF',
                marginBottom: '6px',
              }}
            >
              Arc is listening...
            </div>
            <div style={{ fontSize: '13px', color: '#9B8EC4' }}>
              Tell it what happened. Be real.
            </div>
          </div>
        )}

        {proofState === 'processing' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚡</div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#F0ECFF',
                marginBottom: '6px',
              }}
            >
              Arc is evaluating...
            </div>
            {transcript && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#9B8EC4',
                  fontStyle: 'italic',
                  marginTop: '14px',
                  textAlign: 'left',
                  lineHeight: 1.5,
                }}
              >
                &ldquo;{transcript}&rdquo;
              </div>
            )}
          </div>
        )}

        {proofState === 'result' && result && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '44px', marginBottom: '10px' }}>
                {result.completed ? '✦' : result.partialCredit ? '◈' : '○'}
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: result.xpAwarded > 0 ? dimColor : '#6B5E8C',
                  marginBottom: '4px',
                }}
              >
                {result.xpAwarded > 0 ? `+${result.xpAwarded} XP` : 'Not this time'}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#9B8EC4' }}>
                {result.encouragement}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(123,63,228,0.08)',
                border: '1px solid rgba(123,63,228,0.2)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, #FFB0A3, #FF7A65)',
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                />
                <div
                  style={{
                    fontSize: '13px',
                    color: '#C4B8E8',
                    lineHeight: 1.65,
                    fontStyle: 'italic',
                  }}
                >
                  &ldquo;{result.arcResponse}&rdquo;
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onComplete(
                  result.xpAwarded,
                  quest.dimensionId,
                  transcript,
                  result.arcResponse
                )
              }
              style={{
                background: result.xpAwarded > 0 ? dimColor : 'rgba(255,255,255,0.06)',
                color: 'white',
                border: 'none',
                borderRadius: '100px',
                padding: '15px 32px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
                fontFamily: 'inherit',
                boxShadow: result.xpAwarded > 0 ? `0 8px 24px ${dimColor}40` : 'none',
              }}
            >
              {result.xpAwarded > 0 ? `Claim ${result.xpAwarded} XP →` : 'Got it →'}
            </button>
          </div>
        )}

        {proofState === 'error' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠</div>
            <div style={{ fontSize: '14px', color: '#9B8EC4', marginBottom: '20px' }}>
              {error}
            </div>
            <button
              type="button"
              onClick={() => setProofState('prompt')}
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#F0ECFF',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '100px',
                padding: '12px 24px',
                fontSize: '14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
