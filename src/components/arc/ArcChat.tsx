'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getUserId } from '@/lib/user'

type ChatState = 'closed' | 'open' | 'recording' | 'thinking'

interface Message {
  role: 'user' | 'arc'
  text: string
}

export function ArcChat() {
  const pathname = usePathname()
  const hideDefaultFab = pathname === '/dashboard' || pathname === '/oracle'
  const [chatState, setChatState] = useState<ChatState>('closed')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const openOracle = () => setChatState('open')
    window.addEventListener('protagonist:open-oracle', openOracle)
    return () => window.removeEventListener('protagonist:open-oracle', openOracle)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendToArc = useCallback(async (message: string) => {
    const text = message.trim()
    if (!text) return

    setMessages((prev) => [...prev, { role: 'user', text }])
    setInputText('')
    setChatState('thinking')
    setTimeout(scrollToBottom, 50)

    try {
      const res = await fetch('/api/arc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userId: getUserId(),
          // Pass conversation history so Oracle remembers what was said earlier
          conversationHistory: messages.slice(-16).map(m => ({
            role: m.role === 'arc' ? 'oracle' : 'user' as 'user' | 'oracle',
            text: m.text,
          })),
        }),
      })

      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'arc', text: data.response }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'arc', text: "Something went wrong on my end. Still here though." },
      ])
    } finally {
      setChatState('open')
      setTimeout(scrollToBottom, 50)
    }
  }, [messages])

  const startVoice = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    setChatState('recording')

    let gotResult = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      gotResult = true
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) {
        setInputText(transcript)
      }
      setChatState('open')
    }

    recognition.onend = () => {
      if (!gotResult) {
        setChatState('open')
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Voice error:', event.error)
      setChatState('open')
    }

    try {
      recognition.start()
    } catch (e) {
      console.error('Could not start recognition:', e)
      setChatState('open')
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendToArc(inputText)
    }
  }

  if (chatState === 'closed') {
    if (hideDefaultFab) return null

    return (
      <button
        type="button"
        onClick={() => setChatState('open')}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #FFB0A3, #FF7A65 60%, #CC4A33)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(255,122,101,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          zIndex: 50,
        }}
        title="Talk to the Oracle"
        aria-label="Talk to the Oracle"
      >
        🔮
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        left: 0,
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setChatState('closed')}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setChatState('closed')
        }}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'auto',
          background: 'transparent',
        }}
        aria-label="Close Oracle chat"
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 380,
          maxHeight: '80vh',
          margin: '0 0 0 auto',
          background: '#130E2A',
          border: '1px solid rgba(255,122,101,0.25)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#1A1238',
            borderRadius: '20px 20px 0 0',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #FFB0A3, #FF7A65)',
                boxShadow: '0 0 12px rgba(255,122,101,0.4)',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0ECFF' }}>Oracle</div>
              <div style={{ fontSize: 10, color: '#6B5E8C' }}>
                {chatState === 'recording'
                  ? '🎙 Listening — tap Send when done'
                  : chatState === 'thinking'
                    ? '⚡ Thinking...'
                    : 'Your Oracle · always on'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setChatState('closed')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6B5E8C',
              cursor: 'pointer',
              fontSize: 22,
              padding: '0 4px',
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                fontSize: 13,
                color: '#9B8EC4',
                fontStyle: 'italic',
                textAlign: 'center',
                paddingTop: 24,
                lineHeight: 1.6,
              }}
            >
              &ldquo;Talk to me. Check in, process something,
              <br />
              ask a question — I&apos;m always here.&rdquo;
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              style={{
                maxWidth: '85%',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  background:
                    msg.role === 'user'
                      ? 'rgba(123,63,228,0.2)'
                      : 'rgba(255,122,101,0.08)',
                  border: `1px solid ${
                    msg.role === 'user'
                      ? 'rgba(123,63,228,0.3)'
                      : 'rgba(255,122,101,0.15)'
                  }`,
                  borderRadius:
                    msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  padding: '10px 14px',
                  fontSize: 14,
                  color: '#F0ECFF',
                  lineHeight: 1.65,
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {chatState === 'thinking' && (
            <div style={{ alignSelf: 'flex-start' }}>
              <div
                style={{
                  background: 'rgba(255,122,101,0.08)',
                  border: '1px solid rgba(255,122,101,0.15)',
                  borderRadius: '14px 14px 14px 4px',
                  padding: '10px 18px',
                  fontSize: 20,
                  letterSpacing: 5,
                  color: '#FF7A65',
                }}
              >
                ···
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div
          style={{
            padding: '10px 12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={startVoice}
            disabled={chatState === 'thinking'}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background:
                chatState === 'recording' ? '#FF7A65' : 'rgba(255,122,101,0.12)',
              border: `1px solid ${
                chatState === 'recording' ? '#FF7A65' : 'rgba(255,122,101,0.25)'
              }`,
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              opacity: chatState === 'thinking' ? 0.4 : 1,
            }}
            aria-label="Record voice message"
          >
            🎙
          </button>

          <input
            type="text"
            placeholder={
              chatState === 'recording'
                ? 'Transcript will appear here...'
                : 'Talk to the Oracle...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={chatState === 'thinking'}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 100,
              padding: '10px 16px',
              fontSize: 14,
              color: '#F0ECFF',
              outline: 'none',
              fontFamily: 'inherit',
              opacity: chatState === 'thinking' ? 0.5 : 1,
            }}
          />

          {inputText.trim().length > 0 && (
            <button
              type="button"
              onClick={() => void sendToArc(inputText)}
              disabled={chatState === 'thinking'}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#7B3FE4',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(123,63,228,0.4)',
              }}
              aria-label="Send message"
            >
              ↑
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
