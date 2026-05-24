'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { getUserId } from '@/lib/user'

type ChatState = 'closed' | 'open' | 'recording' | 'thinking' | 'responding'

interface Message {
  role: 'user' | 'arc'
  text: string
}

export function ArcChat() {
  const [chatState, setChatState] = useState<ChatState>('closed')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatState])

  const sendToArc = useCallback(async (message: string) => {
    if (!message.trim()) return

    setMessages((prev) => [...prev, { role: 'user', text: message }])
    setInputText('')
    setChatState('thinking')

    try {
      const res = await fetch('/api/arc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          userId: getUserId(),
        }),
      })

      if (!res.ok) {
        throw new Error('Arc request failed')
      }

      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: 'arc', text: data.response ?? "I'm here. Tell me more." },
      ])
      setChatState('responding')
      setTimeout(() => setChatState('open'), 100)
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'arc', text: "Something went wrong. I'm still here though." },
      ])
      setChatState('open')
    }
  }, [])

  const startVoice = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      const text = window.prompt('Talk to Arc:')
      if (text?.trim()) void sendToArc(text.trim())
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = false
    recognition.lang = 'en-US'

    setChatState('recording')

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0]?.[0]?.transcript
      if (text?.trim()) void sendToArc(text.trim())
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'network' || event.error === 'not-allowed') {
        setChatState('open')
        const text = window.prompt('Talk to Arc:')
        if (text?.trim()) void sendToArc(text.trim())
      } else {
        setChatState('open')
      }
    }

    recognition.start()
  }, [sendToArc])

  if (chatState === 'closed') {
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
          transition: 'transform 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
        title="Talk to Arc"
        aria-label="Talk to Arc"
      >
        🔮
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 340,
        maxHeight: '70vh',
        background: '#130E2A',
        border: '1px solid rgba(255,122,101,0.25)',
        borderRadius: 20,
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        overflow: 'hidden',
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
            }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F0ECFF' }}>Arc</div>
            <div style={{ fontSize: 10, color: '#6B5E8C' }}>
              {chatState === 'recording'
                ? 'Listening...'
                : chatState === 'thinking'
                  ? 'Thinking...'
                  : 'Your Oracle'}
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
            fontSize: 18,
            padding: 4,
          }}
          aria-label="Close Arc chat"
        >
          ×
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minHeight: 200,
          maxHeight: 320,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              fontSize: 13,
              color: '#9B8EC4',
              fontStyle: 'italic',
              textAlign: 'center',
              marginTop: 16,
            }}
          >
            &ldquo;What&apos;s on your mind?&rdquo;
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={`${msg.role}-${i}-${msg.text.slice(0, 20)}`}
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
                fontSize: 13,
                color: '#F0ECFF',
                lineHeight: 1.6,
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
                padding: '10px 16px',
                fontSize: 18,
                letterSpacing: 4,
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
          padding: '12px 14px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Tell Arc anything..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void sendToArc(inputText)
          }}
          disabled={chatState === 'thinking' || chatState === 'recording'}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 100,
            padding: '9px 16px',
            fontSize: 13,
            color: '#F0ECFF',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={startVoice}
          disabled={chatState === 'thinking'}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background:
              chatState === 'recording' ? '#FF7A65' : 'rgba(255,122,101,0.15)',
            border: '1px solid rgba(255,122,101,0.3)',
            cursor: chatState === 'thinking' ? 'not-allowed' : 'pointer',
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-label="Voice message to Arc"
        >
          🎙
        </button>
      </div>
    </div>
  )
}
