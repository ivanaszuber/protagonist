'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { CHARACTERS, type Dimension } from '@/lib/character'
import { getUserId } from '@/lib/user'

// ── Types (mirrored from OracleSheet) ─────────────────────────────────────────

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
  new_tasks: Array<{ id?: string; title: string; dimension: string; due_date: string; xp_reward: number }>
  focus_list: Array<{ text: string; dimension: string | null }>
  suggestions: Array<{ text: string; dimension: string }>
  oracle_message: string
  mood_signal: string
}

interface ParsedTask {
  title: string; dimension: string | null; date: string | null
  questId: string | null; milestoneId: string | null; xpReward: number
}

interface ClassifyResult {
  intent: 'TASK' | 'COMPLETED_ACTIVITY' | 'NOTE' | 'LEGEND' | 'BOSS'
    | 'CALENDAR_CREATE' | 'CALENDAR_UPDATE' | 'CALENDAR_DELETE' | 'VAULT_UPDATE' | 'CHAT'
  task: ParsedTask | null
  completed_task?: { title: string; dimension: string | null; date: string | null; xpReward: number } | null
  note: { text: string } | null
  legend?: { dimension: string; vision: string | null } | null
  boss?: { dimension: string } | null
  calendar_event?: { title: string; date: string; startTime: string | null; durationMinutes: number; description?: string | null; location?: string | null } | null
  calendar_update?: { event_id: string; event_title: string; current_date: string; current_time: string | null; new_date: string; new_start_time: string | null; new_duration_minutes: number } | null
  calendar_delete?: { event_id: string; event_title: string; event_date: string; event_time: string | null } | null
  vault_update?: { field: 'invested' | 'cash' | 'cash_delta' | 'invested_delta' | 'both'; amount: number; notes?: string | null } | null
  oracleReply: string | null
}

type ModalMode = 'closed' | 'chat' | 'checkin-loading' | 'checkin-input' | 'checkin-thinking' | 'checkin-done'

// ── Helpers ───────────────────────────────────────────────────────────────────

function dimColor(d: string): string { return CHARACTERS[d as Dimension]?.color ?? '#A87EF8' }

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="font-family:monospace;background:rgba(123,63,228,0.15);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/\n/g, '<br/>')
}

// ── Oracle robot SVG ──────────────────────────────────────────────────────────

function OracleRobot({ size = 64 }: { size?: number }) {
  const s = size / 58
  return (
    <svg width={size} height={size * 66 / 58} viewBox="0 0 58 66">
      <polygon points="16,16 22,6 29,13 36,6 42,16" fill="#FFB347"/>
      <rect x="14" y="14" width="30" height="3" rx="1.5" fill="#FFB347" opacity="0.7"/>
      <rect x="1" y="25" width="4" height="8" rx="2" fill="#FF7A65" opacity="0.7"/>
      <rect x="53" y="25" width="4" height="8" rx="2" fill="#FF7A65" opacity="0.7"/>
      <rect x="5" y="17" width="48" height="32" rx="9" fill="#FF7A65"/>
      <rect x="11" y="24" width="14" height="14" rx="4" fill="#130E2A"/>
      <rect x="33" y="24" width="14" height="14" rx="4" fill="#130E2A"/>
      <circle cx="15" cy="28" r="3" fill="white" opacity="0.9"/>
      <circle cx="37" cy="28" r="3" fill="white" opacity="0.9"/>
      <circle cx="17" cy="30" r="2" fill="#130E2A"/>
      <circle cx="39" cy="30" r="2" fill="#130E2A"/>
      <path d="M20 39 Q29 44 38 39" stroke="#130E2A" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <rect x="12" y="50" width="12" height="14" rx="5" fill="#FF7A65" opacity="0.85"/>
      <rect x="34" y="50" width="12" height="14" rx="5" fill="#FF7A65" opacity="0.85"/>
    </svg>
  )
}

// ── Biometric bar ─────────────────────────────────────────────────────────────

function BiometricBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, width: 56, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value ?? 0}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease-out' }} />
      </div>
      <span style={{ color: value != null ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600, width: 24, textAlign: 'right' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const MODAL_CSS = `
  @keyframes dm-fade-in { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
  @keyframes dm-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
  @keyframes dm-spin { to{transform:rotate(360deg)} }
  @keyframes dm-orb-a { from{transform:rotate(0deg) translateX(28px) rotate(0deg)} to{transform:rotate(360deg) translateX(28px) rotate(-360deg)} }
  @keyframes dm-orb-b { from{transform:rotate(130deg) translateX(28px) rotate(-130deg)} to{transform:rotate(490deg) translateX(28px) rotate(-490deg)} }
  @keyframes dm-orb-c { from{transform:rotate(250deg) translateX(28px) rotate(-250deg)} to{transform:rotate(610deg) translateX(28px) rotate(-610deg)} }
`

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }
const metaLabel: CSSProperties = { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 600, letterSpacing: '1.6px', textTransform: 'uppercase', display: 'block', marginBottom: 8 }

// ── Component ─────────────────────────────────────────────────────────────────

export function DesktopOracleModal() {
  const userId = getUserId()
  const [mode, setMode] = useState<ModalMode>('closed')

  // Chat state
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'oracle'; text: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  // Check-in state
  const [morningContext, setMorningContext] = useState<MorningContext | null>(null)
  const [checkinInput, setCheckinInput] = useState('')
  const [checkinResult, setCheckinResult] = useState<MorningCheckinResult | null>(null)
  const [checkinLoading, setCheckinLoading] = useState(false)

  // ── Open/close via event ────────────────────────────────────────────────────

  const close = useCallback(() => {
    setMode('closed')
    setChatInput('')
    setCheckinInput('')
    window.dispatchEvent(new CustomEvent('protagonist:oracle-closed'))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prefill?: string; context?: string }>).detail
      if (detail?.context === 'morning_checkin') {
        setCheckinResult(null)
        setCheckinInput('')
        setMode('checkin-loading')
        // Load morning context
        fetch(`/api/oracle/morning-context?userId=${encodeURIComponent(userId)}`)
          .then(r => r.json())
          .then((data: MorningContext) => {
            setMorningContext(data)
            setMode('checkin-input')
          })
          .catch(() => setMode('checkin-input'))
      } else {
        if (detail?.prefill) {
          setChatMessages([])
          setChatInput(detail.prefill)
        }
        setMode('chat')
        setTimeout(() => chatInputRef.current?.focus(), 100)
      }
    }
    window.addEventListener('protagonist:open-oracle', handler)
    return () => window.removeEventListener('protagonist:open-oracle', handler)
  }, [userId])

  // ── Escape to close ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // ── Auto-scroll chat ────────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [chatMessages])

  // ── Chat submit ─────────────────────────────────────────────────────────────
  const handleChatSubmit = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text }])
    setChatLoading(true)
    try {
      // Classify intent first
      const classRes = await fetch('/api/oracle/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userId }),
      })
      const data = (await classRes.json()) as ClassifyResult

      if (data.intent === 'TASK' && data.task) {
        await fetch('/api/quests/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, dimension: data.task.dimension ?? 'career', title: data.task.title, xpReward: data.task.xpReward, taskDate: data.task.date }),
        })
        window.dispatchEvent(new CustomEvent('protagonist:task-added'))
        const reply = data.oracleReply ?? `Task added: "${data.task.title}"`
        setChatMessages(prev => [...prev, { role: 'oracle', text: reply }])
      } else if (data.intent === 'COMPLETED_ACTIVITY' && data.completed_task) {
        const ct = data.completed_task
        const createRes = await fetch('/api/quests/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, dimension: ct.dimension ?? 'vitality', title: ct.title, xpReward: ct.xpReward ?? 50, taskDate: ct.date }),
        })
        const created = (await createRes.json()) as { task?: { id: string } }
        if (created.task?.id) {
          await fetch(`/api/quests/tasks/${created.task.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          })
        }
        window.dispatchEvent(new CustomEvent('protagonist:task-added'))
        const reply = data.oracleReply ?? `Logged +${ct.xpReward ?? 50} XP for "${ct.title}"`
        setChatMessages(prev => [...prev, { role: 'oracle', text: reply }])
      } else if (data.intent === 'CALENDAR_CREATE' && data.calendar_event) {
        const ev = data.calendar_event
        const calRes = await fetch('/api/calendar/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, title: ev.title, date: ev.date, startTime: ev.startTime, durationMinutes: ev.durationMinutes ?? 60 }),
        })
        window.dispatchEvent(new CustomEvent('protagonist:calendar-updated'))
        const reply = calRes.ok ? `Added to calendar: "${ev.title}" on ${ev.date}${ev.startTime ? ` at ${ev.startTime}` : ''}` : "Couldn't add that to your calendar — try again."
        setChatMessages(prev => [...prev, { role: 'oracle', text: reply }])
      } else {
        // CHAT / NOTE / anything else — send to Arc
        const arcRes = await fetch('/api/arc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, userId }),
        })
        const arcData = await arcRes.json()
        const reply = (arcData.response as string) ?? arcData.oracleReply ?? "I'm here with you."
        if (data.intent === 'NOTE') {
          fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, content: text, oracleReply: reply }),
          }).catch(() => {})
        }
        setChatMessages(prev => [...prev, { role: 'oracle', text: reply }])
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'oracle', text: "Something went wrong — try again." }])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatLoading, userId])

  // ── Check-in submit ─────────────────────────────────────────────────────────
  const handleCheckinSubmit = useCallback(async () => {
    const text = checkinInput.trim()
    if (!text || checkinLoading) return
    setCheckinLoading(true)
    setMode('checkin-thinking')
    try {
      const res = await fetch('/api/oracle/morning-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, transcript: text }),
      })
      if (!res.ok) { setMode('checkin-input'); return }
      const data = (await res.json()) as MorningCheckinResult
      setCheckinResult(data)
      setMode('checkin-done')
      window.dispatchEvent(new CustomEvent('protagonist:task-added'))
    } catch {
      setMode('checkin-input')
    } finally {
      setCheckinLoading(false)
    }
  }, [checkinInput, checkinLoading, userId])

  if (mode === 'closed') return null

  // ── Shared overlay wrapper ──────────────────────────────────────────────────
  return (
    <>
      <style>{MODAL_CSS}</style>
      {/* Backdrop */}
      <div
        role="button" tabIndex={0} aria-label="Close"
        onClick={close}
        onKeyDown={e => e.key === 'Enter' && close()}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100, cursor: 'default' }}
      />

      {/* Modal */}
      <div style={{
        ...font,
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 101,
        width: 'min(900px, calc(100vw - 40px))',
        maxHeight: 'calc(100vh - 60px)',
        background: '#130E2A',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animation: 'dm-fade-in 0.2s ease-out both',
      }}>
        {mode === 'chat' && <ChatView
          messages={chatMessages}
          input={chatInput}
          setInput={setChatInput}
          onSubmit={handleChatSubmit}
          loading={chatLoading}
          inputRef={chatInputRef}
          chatEndRef={chatEndRef}
          onClose={close}
        />}
        {(mode === 'checkin-loading' || mode === 'checkin-input' || mode === 'checkin-thinking') && <CheckinInputView
          mode={mode}
          context={morningContext}
          input={checkinInput}
          setInput={setCheckinInput}
          onSubmit={handleCheckinSubmit}
          onClose={close}
        />}
        {mode === 'checkin-done' && checkinResult && <CheckinDoneView
          result={checkinResult}
          context={morningContext}
          onClose={close}
          onAskArc={() => {
            setMode('chat')
            setChatMessages([])
          }}
        />}
      </div>
    </>
  )
}

// ── Chat view ─────────────────────────────────────────────────────────────────

function ChatView({ messages, input, setInput, onSubmit, loading, inputRef, chatEndRef, onClose }: {
  messages: { role: 'user' | 'oracle'; text: string }[]
  input: string
  setInput: (v: string) => void
  onSubmit: () => void
  loading: boolean
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  chatEndRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
}) {
  const QUICK = ['Plan my day', 'Review my week', 'Add a task', 'Log something I did', 'What should I focus on?']

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, height: 520 }}>
      {/* Left sidebar */}
      <div style={{ width: 220, background: '#0F0B1F', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', gap: 10, flexShrink: 0 }}>
        {/* Header X */}
        <button onClick={onClose} style={{ alignSelf: 'flex-end', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>

        {/* Oracle robot with orbiting particles */}
        <div style={{ position: 'relative', width: 72, height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', margin: -3, width: 6, height: 6, borderRadius: '50%', background: '#FFB347', animation: 'dm-orb-a 3.5s linear infinite' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', margin: -2.5, width: 5, height: 5, borderRadius: '50%', background: '#00D4B8', animation: 'dm-orb-b 3.5s linear infinite' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', margin: -2, width: 4, height: 4, borderRadius: '50%', background: '#6EE7A4', animation: 'dm-orb-c 5s linear infinite' }} />
          <div style={{ animation: 'dm-float 3s ease-in-out infinite', position: 'relative', zIndex: 1 }}>
            <OracleRobot size={56} />
          </div>
        </div>

        <div style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>Arc</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', lineHeight: 1.5 }}>Your AI life companion</div>

        <div style={{ width: '100%', marginTop: 12 }}>
          <span style={{ ...metaLabel }}>Quick ask</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {QUICK.map(q => (
              <button key={q} onClick={() => setInput(q)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 10px', color: 'rgba(255,255,255,0.65)', fontSize: 11, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.12s' }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Title bar */}
        <div style={{ background: '#1A1335', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <OracleRobot size={26} />
          <div>
            <div style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>The Oracle · Arc</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Your AI life companion</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none' }}>
          {messages.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: 40 }}>
              Ask Arc anything — tasks, calendar, reflections, or just a chat.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, maxWidth: '85%', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.role === 'oracle' ? 'rgba(255,122,101,0.15)' : '#7B3FE4', border: m.role === 'oracle' ? '1px solid rgba(255,122,101,0.3)' : 'none', fontSize: 11, fontWeight: 600, color: 'white' }}>
                {m.role === 'oracle' ? <OracleRobot size={16} /> : 'I'}
              </div>
              <div
                style={{ padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, background: m.role === 'oracle' ? 'rgba(255,122,101,0.1)' : '#7B3FE4', border: m.role === 'oracle' ? '1px solid rgba(255,122,101,0.2)' : 'none', color: 'rgba(255,255,255,0.88)' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
              />
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,122,101,0.15)', border: '1px solid rgba(255,122,101,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <OracleRobot size={16} />
              </div>
              <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,122,101,0.1)', border: '1px solid rgba(255,122,101,0.2)', display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 0.15, 0.3].map((d, i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF7A65', opacity: 0.6, animation: `dm-spin 1s ease-in-out ${d}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSubmit() } }}
            placeholder="Ask Arc anything…"
            rows={1}
            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.5 }}
          />
          <button
            onClick={() => void onSubmit()}
            disabled={!input.trim() || loading}
            style={{ background: input.trim() && !loading ? '#FF7A65' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading ? 'pointer' : 'default', flexShrink: 0, transition: 'background 0.15s' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Check-in input view (loading + input states) ───────────────────────────────

function CheckinInputView({ mode, context, input, setInput, onSubmit, onClose }: {
  mode: 'checkin-loading' | 'checkin-input' | 'checkin-thinking'
  context: MorningContext | null
  input: string
  setInput: (v: string) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const isLoading = mode === 'checkin-loading' || mode === 'checkin-thinking'

  return (
    <div style={{ display: 'flex', minHeight: 0, height: 480 }}>
      {/* Left */}
      <div style={{ width: 260, background: '#0F0B1F', borderRight: '1px solid rgba(255,255,255,0.07)', padding: '24px 18px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <button onClick={onClose} style={{ alignSelf: 'flex-end', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1, marginBottom: 8 }}>×</button>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 2 }}>Good morning,</div>
        <div style={{ color: '#FF7A65', fontSize: 22, fontWeight: 700, fontStyle: 'italic', marginBottom: 20 }}>Ivana.</div>

        {context && (
          <>
            <BiometricBar label="Sleep" value={context.sleep} color="#FFB347" />
            <BiometricBar label="Readiness" value={context.readiness} color="#FFB347" />
            <BiometricBar label="Activity" value={context.activity} color="#6EE7A4" />
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '14px 0' }} />
          </>
        )}

        <div style={{ background: 'rgba(255,122,101,0.08)', border: '1px solid rgba(255,122,101,0.18)', borderRadius: 10, padding: 12, flex: 1 }}>
          <span style={{ ...metaLabel, marginBottom: 6 }}>Arc says</span>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontStyle: 'italic', lineHeight: 1.6 }}>
            {isLoading ? 'Loading your morning...' : 'Tell me about how you\'re feeling and what\'s on your mind today.'}
          </div>
        </div>
      </div>

      {/* Right */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 22px' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6 }}>Morning Check-In</div>
        <div style={{ color: 'white', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>How's your morning going?</div>

        {isLoading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ animation: 'dm-float 2s ease-in-out infinite' }}>
              <OracleRobot size={56} />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontStyle: 'italic' }}>
              {mode === 'checkin-loading' ? 'Loading your morning...' : 'Arc is processing your check-in...'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
              Share anything — how you slept, how you feel, what's on your mind, what you're planning. Arc will pull out tasks, surface insights, and set you up for the day.
            </div>
            <textarea
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void onSubmit() }}
              placeholder="e.g. Slept okay, feeling a bit tired but motivated. Big interview at 11, then I need to work on the app. Also need to plan Croatia trip..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px', color: 'white', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.7, marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 18px', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Skip for now
              </button>
              <button
                onClick={() => void onSubmit()}
                disabled={!input.trim()}
                style={{ flex: 1, background: input.trim() ? '#FF7A65' : 'rgba(255,122,101,0.25)', border: 'none', borderRadius: 10, padding: '11px', color: 'white', fontSize: 13, fontWeight: 600, cursor: input.trim() ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'background 0.15s' }}
              >
                Start my day →
              </button>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
              ⌘ + Enter to submit
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Check-in done view (results) ──────────────────────────────────────────────

function CheckinDoneView({ result, context, onClose, onAskArc }: {
  result: MorningCheckinResult
  context: MorningContext | null
  onClose: () => void
  onAskArc: () => void
}) {
  const MOOD_OPTIONS = [
    { value: 1, color: '#E57373' },
    { value: 2, color: '#FF9A5C' },
    { value: 3, color: '#FFB347' },
    { value: 4, color: '#6EE7A4' },
    { value: 5, color: '#00D4B8' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: 0, height: 530 }}>
      {/* Left */}
      <div style={{ width: 260, background: '#0F0B1F', borderRight: '1px solid rgba(255,255,255,0.07)', padding: '24px 18px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <button onClick={onClose} style={{ alignSelf: 'flex-end', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1, marginBottom: 8 }}>×</button>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 2 }}>Good morning,</div>
        <div style={{ color: '#FF7A65', fontSize: 22, fontWeight: 700, fontStyle: 'italic', marginBottom: 20 }}>Ivana.</div>

        {context && (
          <>
            <BiometricBar label="Sleep" value={context.sleep} color="#FFB347" />
            <BiometricBar label="Readiness" value={context.readiness} color="#FFB347" />
            <BiometricBar label="Activity" value={context.activity} color="#6EE7A4" />
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '14px 0' }} />
          </>
        )}

        {/* Mood row */}
        <div style={{ marginBottom: 14 }}>
          <span style={{ ...metaLabel }}>Mood</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {MOOD_OPTIONS.map(({ value, color }) => (
              <div key={value} style={{ width: 26, height: 26, borderRadius: '50%', border: `2.5px solid ${color}`, background: `${color}15`, opacity: 0.55 }} />
            ))}
          </div>
        </div>

        <div style={{ background: 'rgba(255,122,101,0.08)', border: '1px solid rgba(255,122,101,0.18)', borderRadius: 10, padding: 12, flex: 1 }}>
          <span style={{ ...metaLabel, marginBottom: 6 }}>Arc says</span>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontStyle: 'italic', lineHeight: 1.6 }}>
            &ldquo;{result.oracle_message || 'Your morning has been set. Make today count.'}&rdquo;
          </div>
        </div>
      </div>

      {/* Right */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 22px', overflowY: 'auto', gap: 18, scrollbarWidth: 'none' }}>

        {/* Focus items */}
        {result.focus_list && result.focus_list.length > 0 && (
          <div>
            <span style={metaLabel}>Today's focus</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {result.focus_list.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 0', borderBottom: i < result.focus_list.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: f.dimension ? dimColor(f.dimension) : '#A87EF8', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12.5, lineHeight: 1.55 }}>{f.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks */}
        {result.new_tasks && result.new_tasks.length > 0 && (
          <div>
            <span style={metaLabel}>Tasks added to your day</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.new_tasks.map((t, i) => {
                const color = dimColor(t.dimension)
                return (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, flex: 1 }}>{t.title}</div>
                    <div style={{ background: `${color}18`, color, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
                      {CHARACTERS[t.dimension as Dimension]?.name ?? t.dimension}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Calendar matches */}
        {result.calendar_matches && result.calendar_matches.length > 0 && (
          <div>
            <span style={metaLabel}>Calendar today</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {result.calendar_matches.map((c, i) => (
                <div key={i} style={{ background: 'rgba(255,183,77,0.07)', border: '1px solid rgba(255,183,77,0.15)', borderRadius: 8, padding: '8px 12px', color: 'rgba(255,255,255,0.72)', fontSize: 12 }}>
                  📅 {c}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={onAskArc} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Ask Arc to adjust
          </button>
          <button onClick={onClose} style={{ flex: 1, background: '#FF7A65', border: 'none', borderRadius: 10, padding: '11px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Start my day →
          </button>
        </div>
      </div>
    </div>
  )
}
