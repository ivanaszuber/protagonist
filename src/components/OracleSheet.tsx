'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CHARACTERS, type Dimension } from '@/lib/character'
import { getUserId } from '@/lib/user'

type SheetState =
  | 'closed'
  | 'idle'
  | 'recording'
  | 'thinking'
  | 'task-done'
  | 'note-done'
  | 'calendar-confirm'
  | 'calendar-done'
  | 'chat'
  | 'checkin-loading'
  | 'checkin-listening'
  | 'checkin-thinking'
  | 'checkin-done'

interface MorningContext {
  readiness: number | null
  sleep: number | null
  activity: number | null
  task_count: number
  event_count: number
  already_checked_in: boolean
}

interface MorningCheckinResult {
  calendar_matches: string[]
  new_tasks: Array<{
    id?: string
    title: string
    dimension: string
    due_date: string
    xp_reward: number
  }>
  focus_list: Array<{ text: string; dimension: string | null }>
  suggestions: Array<{ text: string; dimension: string }>
  oracle_message: string
  mood_signal: string
}

interface CalendarEventInput {
  title: string
  date: string
  startTime: string | null
  durationMinutes: number
  description?: string | null
  location?: string | null
}

interface ParsedTask {
  title: string
  dimension: string | null
  date: string | null
  questId: string | null
  milestoneId: string | null
  xpReward: number
}

interface ClassifyResult {
  intent: 'TASK' | 'NOTE' | 'LEGEND' | 'BOSS' | 'CALENDAR_CREATE' | 'CHAT'
  task: ParsedTask | null
  note: { text: string } | null
  legend?: { dimension: string; vision: string | null } | null
  boss?: { dimension: string } | null
  calendar_event?: CalendarEventInput | null
  oracleReply: string | null
}

function buildCalendarConfirmMessage(ev: CalendarEventInput): string {
  const timeStr = ev.startTime
    ? `${ev.startTime} · ${ev.durationMinutes ?? 60} min`
    : 'All day'
  const desc = ev.description ? `\n${ev.description}` : ''
  const loc = ev.location ? `\n📍 ${ev.location}` : ''
  return `📅 Got it — adding to your calendar:\n\n${ev.title}\n${ev.date} · ${timeStr}${desc}${loc}`
}

function dimensionLabel(dim: string): string {
  const c = CHARACTERS[dim as Dimension]
  return c ? `${c.name} · ${c.tagline}` : dim
}

function dimensionColor(dim: string): string {
  return CHARACTERS[dim as Dimension]?.color ?? '#9333EA'
}

function OracleEye({ size = 16, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <ellipse
        cx="8"
        cy="8"
        rx="7"
        ry="4.5"
        stroke={pulse ? '#E879F9' : '#9333EA'}
        strokeWidth="1.2"
      />
      <circle cx="8" cy="8" r="2.5" stroke="#C084FC" strokeWidth="1" />
      <circle cx="8" cy="8" r="1.2" fill="#E879F9" />
      <circle cx="7" cy="7" r=".6" fill="white" opacity={0.5} />
    </svg>
  )
}

export function OracleSheet() {
  const router = useRouter()
  const pathname = usePathname()
  const userId = getUserId()
  const [state, setState] = useState<SheetState>('closed')
  const [inputText, setInputText] = useState('')
  const [result, setResult] = useState<ClassifyResult | null>(null)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'oracle'; text: string }[]>(
    []
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [calendarCreating, setCalendarCreating] = useState(false)
  const [calendarInsufficientScope, setCalendarInsufficientScope] = useState(false)
  const [calendarDoneTitle, setCalendarDoneTitle] = useState('')
  const [morningContext, setMorningContext] = useState<MorningContext | null>(null)
  const [checkinResult, setCheckinResult] = useState<MorningCheckinResult | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const checkinModeRef = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const hideFab = pathname === '/oracle'
  const prevStateRef = useRef<SheetState>('closed')

  useEffect(() => {
    if (prevStateRef.current !== 'closed' && state === 'closed') {
      window.dispatchEvent(new CustomEvent('protagonist:oracle-closed'))
    }
    prevStateRef.current = state
  }, [state])

  const loadMorningContext = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/oracle/morning-context?userId=${encodeURIComponent(userId)}`
      )
      const data = (await res.json()) as MorningContext
      setMorningContext(data)
    } catch {
      setMorningContext(null)
    }
    setState('checkin-listening')
    setTimeout(() => startVoiceRef.current?.(), 200)
  }, [userId])

  const startVoiceRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prefill?: string; context?: string }>).detail
      setCheckinResult(null)
      setMorningContext(null)
      setInputText(detail?.prefill ?? '')
      if (detail?.context === 'morning_checkin') {
        checkinModeRef.current = true
        setState('checkin-loading')
        void loadMorningContext()
      } else {
        checkinModeRef.current = false
        setState('idle')
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    }
    window.addEventListener('protagonist:open-oracle', handler)
    return () => window.removeEventListener('protagonist:open-oracle', handler)
  }, [loadMorningContext])

  const close = useCallback(() => {
    checkinModeRef.current = false
    setState('closed')
    setInputText('')
    setResult(null)
    setChatMessages([])
    setCalendarInsufficientScope(false)
    setCalendarDoneTitle('')
    setMorningContext(null)
    setCheckinResult(null)
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }, [])

  const handleCalendarConfirm = useCallback(
    async (ev: CalendarEventInput) => {
      setCalendarCreating(true)
      setCalendarInsufficientScope(false)
      try {
        const res = await fetch('/api/calendar/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            title: ev.title,
            date: ev.date,
            startTime: ev.startTime ?? undefined,
            durationMinutes: ev.durationMinutes ?? 60,
            description: ev.description ?? undefined,
            location: ev.location ?? undefined,
          }),
        })
        const data = (await res.json()) as { error?: string }

        if (res.status === 403 && data.error === 'insufficient_scope') {
          setCalendarInsufficientScope(true)
          setState('calendar-done')
        } else if (res.ok) {
          setCalendarDoneTitle(ev.title)
          setState('calendar-done')
          window.dispatchEvent(new CustomEvent('protagonist:calendar-updated'))
        } else {
          setResult({
            intent: 'CHAT',
            task: null,
            note: null,
            oracleReply: "Couldn't add the event — try again.",
          })
          setState('note-done')
        }
      } finally {
        setCalendarCreating(false)
      }
    },
    [userId]
  )

  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'
    recognitionRef.current = rec
    setState(checkinModeRef.current ? 'checkin-listening' : 'recording')
    setInputText('')

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      setInputText(transcript)
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'aborted') {
        setState(checkinModeRef.current ? 'checkin-listening' : 'idle')
      }
    }

    rec.onend = () => {
      setState((s) => {
        if (s === 'recording' || s === 'checkin-listening') {
          try {
            rec.start()
          } catch {
            return checkinModeRef.current ? 'checkin-listening' : 'idle'
          }
          return checkinModeRef.current ? 'checkin-listening' : 'recording'
        }
        return s
      })
    }

    rec.start()
  }, [])

  startVoiceRef.current = startVoice

  const stopVoice = useCallback(() => {
    setState(checkinModeRef.current ? 'checkin-listening' : 'idle')
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const handleCheckinSubmit = useCallback(async () => {
    const text = inputText.trim()
    if (!text) return

    stopVoice()
    setState('checkin-thinking')

    try {
      const res = await fetch('/api/oracle/morning-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, transcript: text }),
      })
      if (!res.ok) {
        setState('checkin-listening')
        return
      }
      const data = (await res.json()) as MorningCheckinResult
      setCheckinResult(data)
      setState('checkin-done')
      window.dispatchEvent(new CustomEvent('protagonist:oracle-closed'))
      window.dispatchEvent(new CustomEvent('protagonist:task-added'))
    } catch {
      setState('checkin-listening')
    }
  }, [inputText, userId, stopVoice])

  const sendChatToArc = useCallback(
    async (text: string) => {
      const res = await fetch('/api/arc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, userId }),
      })
      const data = await res.json()
      return (data.response as string) ?? data.oracleReply ?? "I'm here with you."
    },
    [userId]
  )

  const handleSubmit = useCallback(async () => {
    const text = inputText.trim()
    if (!text || isSubmitting) return

    const inChat = state === 'chat'
    setIsSubmitting(true)
    if (!inChat) setState('thinking')

    try {
      // Always classify first — even mid-chat, so "add task X" works in any state
      const res = await fetch('/api/oracle/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userId }),
      })
      const data = (await res.json()) as ClassifyResult
      setResult(data)

      if (data.intent === 'TASK' && data.task) {
        const taskRes = await fetch('/api/quests/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            dimension: data.task.dimension ?? 'career',
            title: data.task.title,
            xpReward: data.task.xpReward,
            taskDate: data.task.date,
            milestoneId: data.task.milestoneId,
          }),
        })
        await taskRes.json()
        // Tell any open Tasks page to refresh
        window.dispatchEvent(new CustomEvent('protagonist:task-added'))
        setState('task-done')
      } else if (data.intent === 'LEGEND' && data.legend?.dimension && data.legend.vision) {
        await fetch('/api/quests/vision', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            dimension: data.legend.dimension,
            vision: data.legend.vision,
          }),
        })
        const arcReply =
          data.oracleReply ?? `Your Legend is set: "${data.legend.vision}"`
        setResult({ ...data, oracleReply: arcReply })
        setState('note-done')
      } else if (data.intent === 'CALENDAR_CREATE' && data.calendar_event) {
        setResult(data)
        setState('calendar-confirm')
      } else if (data.intent === 'BOSS' && data.boss?.dimension) {
        const genRes = await fetch('/api/bosses/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            dimension: data.boss.dimension,
            userMessage: text,
          }),
        })
        const genData = await genRes.json()
        const reply = genRes.ok
          ? `Boss battle created: ${(genData.boss as { name?: string })?.name ?? 'Your nemesis awaits.'}`
          : (genData.error as string) ?? 'Could not create boss battle.'
        setResult({ ...data, oracleReply: reply })
        setState('note-done')
      } else if (data.intent === 'NOTE') {
        const arcReply = await sendChatToArc(text)

        fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            content: text,
            oracleReply: arcReply,
          }),
        }).catch(() => {})

        setResult({ ...data, oracleReply: arcReply })
        setState('note-done')
      } else {
        // CHAT intent — works whether starting fresh or already mid-conversation
        if (inChat) {
          setChatMessages((prev) => [...prev, { role: 'user', text }])
          setInputText('')
          const reply = await sendChatToArc(text)
          setChatMessages((prev) => [...prev, { role: 'oracle', text: reply }])
        } else {
          const reply = data.oracleReply ?? (await sendChatToArc(text))
          setChatMessages([{ role: 'user', text }, { role: 'oracle', text: reply }])
          setInputText('')
          setState('chat')
        }
      }
    } catch {
      if (!inChat) setState('idle')
    } finally {
      setIsSubmitting(false)
    }
  }, [inputText, userId, state, sendChatToArc, isSubmitting])

  if (state === 'closed') {
    if (hideFab) return null
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 96,
          right: 20,
          width: 54,
          height: 54,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '1.5px solid #9333EA',
            animation: 'oracle-ring 2.2s ease-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '1.5px solid #9333EA',
            animation: 'oracle-ring 2.2s ease-out infinite',
            animationDelay: '1.1s',
          }}
        />
        <button
          type="button"
          onClick={() => setState('idle')}
          aria-label="Open Oracle"
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: '#200A45',
            border: '2px solid #9333EA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            animation: 'oracle-breathe 3s ease-in-out infinite',
          }}
        >
          <OracleEye size={26} />
        </button>
      </div>
    )
  }

  const isCheckinListening = state === 'checkin-listening'
  const isMicActive = state === 'recording' || isCheckinListening

  const subtitle =
    isCheckinListening
      ? "Tell me about your day — I'm listening"
      : state === 'recording'
        ? 'tap stop when done'
        : state === 'thinking'
          ? 'reading your intent...'
          : state === 'checkin-loading'
            ? 'loading your morning...'
            : state === 'checkin-thinking'
              ? 'cross-referencing calendar · extracting tasks'
              : state === 'checkin-done'
                ? 'morning briefing ready'
                : state === 'task-done'
                  ? `saved · ${result?.task?.dimension ? dimensionLabel(result.task.dimension) : ''}`
                  : state === 'note-done'
                    ? 'reflecting on your note...'
                    : state === 'calendar-confirm'
                      ? 'confirm calendar event'
                      : state === 'calendar-done'
                        ? 'calendar updated'
                        : 'speak, type, or drop an image'

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Close Oracle"
        onClick={close}
        onKeyDown={(e) => e.key === 'Escape' && close()}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 55,
        }}
      />

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 56,
          background: '#140C28',
          borderRadius: '20px 20px 0 0',
          borderTop: '0.5px solid #2D1B55',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
      >
        <div
          style={{
            width: 32,
            height: 3,
            background: '#2D1B55',
            borderRadius: 2,
            margin: '12px auto 0',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px 10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: '#200A45',
                border: `1.5px solid ${isMicActive ? '#E879F9' : '#9333EA'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <OracleEye size={16} pulse={isMicActive} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#E8E0F0' }}>
                {isCheckinListening
                  ? 'Morning check-in'
                  : state === 'recording'
                    ? 'Listening...'
                    : state === 'checkin-thinking'
                      ? 'Analysing your day'
                      : state === 'checkin-done'
                        ? 'Check-in complete'
                        : state === 'task-done'
                          ? 'Task added'
                          : state === 'calendar-confirm'
                            ? 'Calendar event'
                            : state === 'calendar-done'
                              ? calendarInsufficientScope
                                ? 'Reconnect needed'
                                : 'Event added'
                              : 'Oracle'}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color:
                    isMicActive
                      ? '#9333EA'
                      : state === 'thinking' || state === 'checkin-thinking'
                        ? '#5A4A7A'
                        : state === 'task-done'
                          ? '#34d399'
                          : state === 'note-done'
                            ? '#C084FC'
                            : state === 'calendar-confirm' || state === 'calendar-done'
                              ? '#60a5fa'
                              : '#5A4A7A',
                }}
              >
                {subtitle}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: '#1E0D40',
              border: '0.5px solid #2D1B55',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 2l6 6M8 2l-6 6"
                stroke="#6A5A8A"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div style={{ padding: '0 14px' }}>
          {state === 'checkin-loading' && (
            <div
              style={{
                padding: '20px 14px',
                textAlign: 'center',
                color: '#5A4A7A',
                fontSize: 12,
                marginBottom: 14,
              }}
            >
              Loading your morning context...
            </div>
          )}

          {state === 'checkin-thinking' && (
            <div style={{ padding: '20px 14px', textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: '#E8E0F0', marginBottom: 6 }}>
                Analysing your day...
              </div>
              <div style={{ fontSize: 11, color: '#5A4A7A' }}>
                cross-referencing calendar · extracting tasks
              </div>
            </div>
          )}

          {state === 'checkin-listening' && (
            <>
              {morningContext && (
                <div
                  style={{
                    background: '#0D0820',
                    border: '0.5px solid #2D1B55',
                    borderRadius: 10,
                    padding: '10px 12px',
                    marginBottom: 10,
                    fontSize: 11,
                    color: '#5A4A7A',
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ color: '#E8E0F0', fontWeight: 500, marginBottom: 4 }}>
                    Good morning ☀
                  </div>
                  <div>
                    Readiness {morningContext.readiness ?? '--'} · Sleep{' '}
                    {morningContext.sleep ?? '--'}
                    {morningContext.activity != null
                      ? ` · Move ${morningContext.activity}`
                      : ' · Move —'}
                  </div>
                  <div>
                    {morningContext.task_count} tasks · {morningContext.event_count}{' '}
                    calendar events today
                  </div>
                </div>
              )}
              <div
                style={{
                  background: '#0D0820',
                  borderRadius: 12,
                  border: '0.5px solid #9333EA',
                  padding: '12px',
                  marginBottom: 10,
                }}
              >
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="What's on your mind..."
                  rows={3}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    fontSize: 13,
                    color: inputText ? '#C0B0E0' : '#3D3358',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={stopVoice}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#9333EA',
                    border: '0.5px solid #9333EA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    color: 'white',
                    fontSize: 10,
                  }}
                  aria-label="Stop recording"
                >
                  Stop
                </button>
                <button
                  type="button"
                  onClick={() => void handleCheckinSubmit()}
                  disabled={!inputText.trim()}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    background: inputText.trim() ? '#9333EA' : '#1E0D40',
                    border: 'none',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: inputText.trim() ? 'pointer' : 'default',
                    opacity: inputText.trim() ? 1 : 0.6,
                    fontFamily: 'inherit',
                  }}
                >
                  Done — analyse my day
                </button>
              </div>
            </>
          )}

          {(state === 'idle' || state === 'recording' || state === 'thinking') && (
            <>
              <div
                style={{
                  background: '#0D0820',
                  borderRadius: 12,
                  border: `0.5px solid ${state === 'recording' ? '#9333EA' : '#2D1B55'}`,
                  padding: '12px',
                  marginBottom: 10,
                }}
              >
                {state === 'recording' ? (
                  <div style={{ minHeight: 42, position: 'relative' }}>
                    {inputText ? (
                      <div
                        style={{
                          fontSize: 13,
                          color: '#C0B0E0',
                          lineHeight: 1.5,
                          paddingRight: 16,
                        }}
                      >
                        {inputText}
                        <span
                          style={{
                            display: 'inline-block',
                            width: 2,
                            height: 13,
                            background: '#9333EA',
                            marginLeft: 2,
                            verticalAlign: 'text-bottom',
                            animation: 'oracle-cursor-blink 1s step-end infinite',
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
                        {[6, 14, 20, 10, 18, 8, 22, 12, 16, 6, 20, 10, 14].map((h, i) => (
                          <div
                            key={i}
                            style={{
                              width: 3,
                              height: h,
                              borderRadius: 2,
                              background: '#9333EA',
                              opacity: 0.4 + (i % 3) * 0.2,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSubmit()
                      }
                    }}
                    placeholder="What's on your mind..."
                    rows={2}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      fontSize: 13,
                      color: inputText ? '#C0B0E0' : '#3D3358',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                    }}
                    disabled={state === 'thinking'}
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={state === 'recording' ? stopVoice : startVoice}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: state === 'recording' ? '#9333EA' : '#1E0D40',
                    border: `0.5px solid ${state === 'recording' ? '#9333EA' : '#2D1B55'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  aria-label={state === 'recording' ? 'Stop recording' : 'Start voice input'}
                >
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                    <rect
                      x="4.5"
                      y="1"
                      width="5"
                      height="8"
                      rx="2.5"
                      stroke={state === 'recording' ? 'white' : '#9333EA'}
                      strokeWidth="1.2"
                    />
                    <path
                      d="M2 7.5c0 2.8 2.2 5 5 5s5-2.2 5-5"
                      stroke={state === 'recording' ? 'white' : '#9333EA'}
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <line
                      x1="7"
                      y1="12.5"
                      x2="7"
                      y2="14"
                      stroke={state === 'recording' ? 'white' : '#9333EA'}
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={state === 'thinking' || (!inputText.trim() && state !== 'recording')}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    background:
                      inputText.trim() || state === 'recording' ? '#9333EA' : '#1E0D40',
                    border: 'none',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    opacity: state === 'thinking' ? 0.6 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {state === 'thinking' ? 'Reading...' : 'Send'}
                </button>
              </div>
            </>
          )}

          {state === 'task-done' && result?.task && (
            <>
              <div
                style={{
                  background: '#0D0820',
                  borderRadius: 12,
                  border: '0.5px solid #2D1B55',
                  padding: '12px',
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 13, color: '#C0B0E0', marginBottom: 10 }}>
                  &ldquo;{result.task.title}&rdquo;
                </div>
                <div style={{ height: '0.5px', background: '#1E1040', marginBottom: 10 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {result.task.dimension && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        background: `${dimensionColor(result.task.dimension)}1a`,
                        border: `0.5px solid ${dimensionColor(result.task.dimension)}4d`,
                        color: dimensionColor(result.task.dimension),
                      }}
                    >
                      {dimensionLabel(result.task.dimension)}
                    </span>
                  )}
                  {result.task.date && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        background: '#1E0D40',
                        border: '0.5px solid #2D1B55',
                        color: '#7A5FA0',
                      }}
                    >
                      {new Date(result.task.date + 'T12:00:00').toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                  {!result.task.date && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        background: '#1E0D40',
                        border: '0.5px solid #2D1B55',
                        color: '#5A4A7A',
                      }}
                    >
                      Someday
                    </span>
                  )}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      background: 'rgba(52,211,153,.08)',
                      border: '0.5px solid rgba(52,211,153,.2)',
                      color: '#34d399',
                    }}
                  >
                    +{result.task.xpReward} XP
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => router.push('/tasks')}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    background: '#1E0D40',
                    border: '0.5px solid #2D1B55',
                    color: '#7A5FA0',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  View in Tasks
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputText('')
                    setResult(null)
                    setState('idle')
                    setTimeout(() => inputRef.current?.focus(), 100)
                  }}
                  style={{
                    flex: 2,
                    height: 44,
                    borderRadius: 10,
                    background: '#9333EA',
                    border: 'none',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Add another
                </button>
              </div>
            </>
          )}

          {state === 'calendar-confirm' && result?.calendar_event && (
            <>
              <div
                style={{
                  background: '#0D0820',
                  borderRadius: 12,
                  border: '0.5px solid #3D2070',
                  padding: '12px',
                  marginBottom: 10,
                  whiteSpace: 'pre-line',
                  fontSize: 12,
                  color: '#C0B0E0',
                  lineHeight: 1.55,
                }}
              >
                {buildCalendarConfirmMessage(result.calendar_event)}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null)
                    setState('idle')
                  }}
                  disabled={calendarCreating}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    background: '#1E0D40',
                    border: '0.5px solid #2D1B55',
                    color: '#7A5FA0',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleCalendarConfirm(result.calendar_event!)}
                  disabled={calendarCreating}
                  style={{
                    flex: 2,
                    height: 44,
                    borderRadius: 10,
                    background: '#9333EA',
                    border: 'none',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    opacity: calendarCreating ? 0.6 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {calendarCreating ? 'Adding...' : 'Add to Calendar ✓'}
                </button>
              </div>
            </>
          )}

          {state === 'calendar-done' && (
            <>
              <div
                style={{
                  background: '#0D0820',
                  borderRadius: 12,
                  border: '0.5px solid #2D1B55',
                  padding: '12px',
                  marginBottom: 10,
                  fontSize: 12,
                  color: '#C0B0E0',
                  lineHeight: 1.55,
                }}
              >
                {calendarInsufficientScope ? (
                  <>
                    🔐 To create events, reconnect Google Calendar with updated permissions.
                  </>
                ) : (
                  <>✅ Added! {calendarDoneTitle} is in your calendar.</>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {calendarInsufficientScope ? (
                  <a
                    href={`/api/calendar/connect?userId=${encodeURIComponent(userId)}`}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 10,
                      background: '#9333EA',
                      border: 'none',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    Reconnect Google Calendar
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null)
                      setState('idle')
                    }}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 10,
                      background: '#9333EA',
                      border: 'none',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Done
                  </button>
                )}
              </div>
            </>
          )}

          {state === 'checkin-done' && checkinResult && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#E8E0F0',
                    marginBottom: 12,
                  }}
                >
                  ☀ Morning check-in complete
                </div>

                {checkinResult.calendar_matches.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#5A4A7A', marginBottom: 6 }}>
                      📅 Already on your schedule
                    </div>
                    {checkinResult.calendar_matches.map((match, i) => (
                      <div
                        key={i}
                        style={{ fontSize: 12, color: '#7A6A9A', padding: '3px 0' }}
                      >
                        ✓ {match}
                      </div>
                    ))}
                  </div>
                )}

                {checkinResult.new_tasks.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#5A4A7A', marginBottom: 6 }}>
                      ✨ Added {checkinResult.new_tasks.length} task
                      {checkinResult.new_tasks.length > 1 ? 's' : ''}
                    </div>
                    {checkinResult.new_tasks.map((task, i) => {
                      const dimColor =
                        CHARACTERS[task.dimension as Dimension]?.color ?? '#9333EA'
                      return (
                        <div
                          key={task.id ?? i}
                          style={{ fontSize: 12, color: '#C0B0E0', padding: '3px 0' }}
                        >
                          {task.title}
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 9,
                              color: dimColor,
                              background: `${dimColor}18`,
                              border: `0.5px solid ${dimColor}`,
                              borderRadius: 20,
                              padding: '1px 6px',
                            }}
                          >
                            {task.dimension}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {checkinResult.focus_list.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#5A4A7A', marginBottom: 6 }}>
                      ⚔ Today&apos;s focus
                    </div>
                    {checkinResult.focus_list.map((item, i) => (
                      <div
                        key={i}
                        style={{ fontSize: 12, color: '#E8E0F0', padding: '3px 0' }}
                      >
                        <span style={{ color: '#5A4A7A', marginRight: 6 }}>{i + 1}.</span>
                        {item.text}
                      </div>
                    ))}
                  </div>
                )}

                {checkinResult.suggestions.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#5A4A7A', marginBottom: 6 }}>
                      💡 Suggestions
                    </div>
                    {checkinResult.suggestions.map((item, i) => (
                      <div
                        key={i}
                        style={{ fontSize: 11, color: '#7A6A9A', padding: '2px 0' }}
                      >
                        · {item.text}
                      </div>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    background: '#1A0D35',
                    border: '0.5px solid #2D1B55',
                    borderLeft: '3px solid #9333EA',
                    padding: '10px 12px',
                    borderRadius: '0 10px 10px 10px',
                  }}
                >
                  <div style={{ fontSize: 10, color: '#9333EA', marginBottom: 4 }}>Oracle</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#A090C0',
                      fontStyle: 'italic',
                      lineHeight: 1.5,
                    }}
                  >
                    {checkinResult.oracle_message}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    checkinModeRef.current = false
                    setCheckinResult(null)
                    setState('idle')
                    setInputText('')
                  }}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    background: '#1E0D40',
                    border: '0.5px solid #2D1B55',
                    color: '#7A5FA0',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Add something
                </button>
                <button
                  type="button"
                  onClick={close}
                  style={{
                    flex: 2,
                    height: 44,
                    borderRadius: 10,
                    background: '#9333EA',
                    border: 'none',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Go build ›
                </button>
              </div>
            </>
          )}

          {state === 'note-done' && result && (
            <>
              <div
                style={{
                  background: '#0D0820',
                  borderRadius: 12,
                  border: '0.5px solid #2D1B55',
                  padding: '12px',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: '#7A5FA0',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                    marginBottom: 8,
                  }}
                >
                  &ldquo;{result.note?.text ?? inputText}&rdquo;
                </div>
                <div style={{ height: '0.5px', background: '#1E1040', marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 5 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      background: '#1E0D40',
                      border: '0.5px solid #2D1B55',
                      color: '#7A5FA0',
                    }}
                  >
                    Voice note
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      background: 'rgba(168,85,247,.08)',
                      border: '0.5px solid rgba(168,85,247,.2)',
                      color: '#C084FC',
                    }}
                  >
                    Logged
                  </span>
                </div>
              </div>
              {result.oracleReply && (
                <div
                  style={{
                    background: '#1A0D35',
                    border: '0.5px solid #2D1B55',
                    borderLeft: '3px solid #9333EA',
                    padding: '10px 12px',
                    marginBottom: 8,
                    borderRadius: '0 10px 10px 10px',
                  }}
                >
                  <div style={{ fontSize: 10, color: '#9333EA', marginBottom: 4 }}>Oracle</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#A090C0',
                      fontStyle: 'italic',
                      lineHeight: 1.5,
                    }}
                  >
                    {result.oracleReply}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setInputText('')
                    setResult(null)
                    setState('idle')
                  }}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    background: '#1E0D40',
                    border: '0.5px solid #2D1B55',
                    color: '#7A5FA0',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  New note
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatMessages([{ role: 'oracle', text: result.oracleReply ?? '' }])
                    setState('chat')
                  }}
                  style={{
                    flex: 2,
                    height: 44,
                    borderRadius: 10,
                    background: '#9333EA',
                    border: 'none',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Reply to Oracle
                </button>
              </div>
            </>
          )}

          {state === 'chat' && (
            <>
              <div
                style={{
                  maxHeight: 240,
                  overflowY: 'auto',
                  marginBottom: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      maxWidth: '85%',
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        background:
                          msg.role === 'user' ? 'rgba(147,51,234,0.2)' : '#1A0D35',
                        border: `0.5px solid ${msg.role === 'user' ? 'rgba(147,51,234,0.35)' : '#2D1B55'}`,
                        borderRadius:
                          msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        padding: '9px 13px',
                        fontSize: 13,
                        color: '#E8E0F0',
                        lineHeight: 1.55,
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSubmit()
                    }
                  }}
                  placeholder="Reply..."
                  rows={1}
                  style={{
                    flex: 1,
                    background: '#0D0820',
                    border: '0.5px solid #2D1B55',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13,
                    color: '#C0B0E0',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting || !inputText.trim()}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#9333EA',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                  aria-label="Send"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 13V3M4 7l4-4 4 4"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
