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
  oracle_reflection: string
  mood_signal: string
}

interface ParsedTask {
  title: string; dimension: string | null; date: string | null
  questId: string | null; milestoneId: string | null; xpReward: number
}

interface ClassifyResult {
  intent: 'TASK' | 'COMPLETED_ACTIVITY' | 'NOTE' | 'LEGEND' | 'BOSS'
    | 'MILESTONE' | 'CALENDAR_CREATE' | 'CALENDAR_UPDATE' | 'CALENDAR_DELETE' | 'VAULT_UPDATE' | 'CHAT'
  task: ParsedTask | null
  tasks?: ParsedTask[]
  completed_task?: { title: string; dimension: string | null; date: string | null; xpReward: number } | null
  note: { text: string } | null
  legend?: { dimension: string; vision: string | null } | null
  boss?: { dimension: string } | null
  milestone?: { title: string; dimension: string | null; questId: string | null; targetDate?: string | null } | null
  calendar_event?: { title: string; date: string; startTime: string | null; durationMinutes: number; description?: string | null; location?: string | null } | null
  calendar_update?: { event_id: string; event_title: string; current_date: string; current_time: string | null; new_date: string; new_start_time: string | null; new_duration_minutes: number } | null
  calendar_delete?: { event_id: string; event_title: string; event_date: string; event_time: string | null } | null
  vault_update?: { field: 'invested' | 'cash' | 'cash_delta' | 'invested_delta' | 'both'; amount: number; notes?: string | null } | null
  oracleReply: string | null
}

type ModalMode = 'closed' | 'chat' | 'checkin-loading' | 'checkin-input' | 'checkin-thinking' | 'checkin-done'

// ── Helpers ───────────────────────────────────────────────────────────────────

function dimColor(d: string): string { return CHARACTERS[d as Dimension]?.color ?? '#A87EF8' }

// ── Check-in localStorage cache ───────────────────────────────────────────────

function getCheckinKey() {
  return 'protagonist-checkin-' + new Date().toISOString().split('T')[0]
}
export function saveCheckinToCache(result: MorningCheckinResult) {
  try { localStorage.setItem(getCheckinKey(), JSON.stringify(result)) } catch {}
  window.dispatchEvent(new CustomEvent('protagonist:checkin-done'))
}
export function loadCheckinFromCache(): MorningCheckinResult | null {
  try {
    const raw = localStorage.getItem(getCheckinKey())
    return raw ? (JSON.parse(raw) as MorningCheckinResult) : null
  } catch { return null }
}
export function isCheckinDoneToday(): boolean {
  try { return !!localStorage.getItem(getCheckinKey()) } catch { return false }
}

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

interface Attachment {
  type: 'file' | 'image'
  name: string
  /** For text files: raw UTF-8 text. For images/PDFs: base64-encoded data. */
  content: string
  mimeType?: string
}

export function DesktopOracleModal() {
  const userId = getUserId()
  const [mode, setMode] = useState<ModalMode>('closed')

  // Chat state
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'oracle'; text: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Chat history persistence ────────────────────────────────────────────────
  const chatHistoryKey = `protagonist-oracle-chat-${userId}`
  const CHAT_MAX_MESSAGES = 40
  const CHAT_MAX_AGE_DAYS = 7

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
    setAttachments([])
    // Don't clear chatMessages — they persist for next open
    window.dispatchEvent(new CustomEvent('protagonist:oracle-closed'))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prefill?: string; context?: string }>).detail
      if (detail?.context === 'checkin-summary') {
        // Reopen today's completed check-in summary
        const cached = loadCheckinFromCache()
        if (cached) {
          setCheckinResult(cached)
          setMode('checkin-done')
        } else {
          // Fallback: start a new check-in
          setCheckinResult(null)
          setCheckinInput('')
          setMode('checkin-loading')
          fetch(`/api/oracle/morning-context?userId=${encodeURIComponent(userId)}`)
            .then(r => r.json())
            .then((data: MorningContext) => { setMorningContext(data); setMode('checkin-input') })
            .catch(() => setMode('checkin-input'))
        }
      } else if (detail?.context === 'morning_checkin') {
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
          // Pre-fill the input but keep existing conversation history
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

  // Scroll to bottom when the chat view opens (catches existing history)
  useEffect(() => {
    if (mode === 'chat') {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'instant' }), 80)
    }
  }, [mode])

  // ── Persist chat history to localStorage ───────────────────────────────────
  useEffect(() => {
    if (!userId || chatMessages.length === 0) return
    try {
      const payload = { messages: chatMessages.slice(-CHAT_MAX_MESSAGES), savedAt: Date.now() }
      localStorage.setItem(chatHistoryKey, JSON.stringify(payload))
    } catch { /* ignore */ }
  }, [chatMessages, userId, chatHistoryKey])

  // ── Restore chat history on first open ─────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    try {
      const raw = localStorage.getItem(chatHistoryKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as { messages: { role: 'user' | 'oracle'; text: string }[]; savedAt: number }
      const ageMs = Date.now() - (parsed.savedAt ?? 0)
      if (ageMs < CHAT_MAX_AGE_DAYS * 86400000 && parsed.messages?.length > 0) {
        setChatMessages(parsed.messages)
      } else {
        localStorage.removeItem(chatHistoryKey)
      }
    } catch { /* ignore */ }
  }, [userId, chatHistoryKey])

  // ── Handle file attach ──────────────────────────────────────────────────────
  const handleFileAttach = useCallback(async (file: File) => {
    const isImage = file.type.startsWith('image/')
    const isPdf   = file.type === 'application/pdf'

    if (isImage || isPdf) {
      // Read as base64
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        // dataUrl is "data:<mimeType>;base64,<data>" — strip the prefix
        const base64 = dataUrl.split(',')[1] ?? dataUrl
        setAttachments(prev => [...prev, { type: isImage ? 'image' : 'file', name: file.name, content: base64, mimeType: file.type }])
      }
      reader.readAsDataURL(file)
    } else {
      // Read as text (HTML, MD, TXT, etc.)
      const text = await file.text()
      setAttachments(prev => [...prev, { type: 'file', name: file.name, content: text, mimeType: file.type }])
    }
  }, [])

  // ── Streaming Arc helper ────────────────────────────────────────────────────
  // Adds a placeholder oracle message and updates it chunk-by-chunk as the
  // stream arrives, returning the complete reply when done.
  const streamArcReply = useCallback(async (body: Record<string, unknown>): Promise<string> => {
    const res = await fetch('/api/arc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok || !res.body) throw new Error('Arc request failed')

    // Insert placeholder that will be updated in-place
    setChatMessages(prev => [...prev, { role: 'oracle' as const, text: '' }])

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let reply = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      reply += decoder.decode(value, { stream: true })
      const current = reply
      setChatMessages(prev => {
        const msgs = [...prev]
        msgs[msgs.length - 1] = { role: 'oracle' as const, text: current }
        return msgs
      })
    }

    const final = reply || "I'm here with you."
    setChatMessages(prev => {
      const msgs = [...prev]
      msgs[msgs.length - 1] = { role: 'oracle' as const, text: final }
      return msgs
    })
    return final
  }, [])

  // ── Chat submit ─────────────────────────────────────────────────────────────
  const handleChatSubmit = useCallback(async () => {
    const text = chatInput.trim()
    const hasAttachments = attachments.length > 0
    if ((!text && !hasAttachments) || chatLoading) return
    const displayText = text || (hasAttachments ? `📎 ${attachments.map(a => a.name).join(', ')}` : '')
    setChatInput('')
    const currentAttachments = attachments
    setAttachments([])
    setChatMessages(prev => [...prev, { role: 'user', text: displayText }])
    setChatLoading(true)
    try {
      // If there are attachments, skip classify and go straight to Arc with multi-attachment payload
      if (currentAttachments.length > 0) {
        const body: Record<string, unknown> = {
          message: text || `I've shared ${currentAttachments.length > 1 ? 'some files' : 'a file'}: ${currentAttachments.map(a => a.name).join(', ')}`,
          userId,
          attachments: currentAttachments,
          conversationHistory: chatMessages.slice(-16),
        }
        await streamArcReply(body)
        return  // finally will still run
      }

      // Classify intent first
      const classRes = await fetch('/api/oracle/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userId }),
      })
      const data = (await classRes.json()) as ClassifyResult

      if (data.intent === 'TASK') {
        // Normalize: use tasks[] if present, fall back to single task
        const taskList: ParsedTask[] =
          data.tasks && data.tasks.length > 0
            ? data.tasks
            : data.task ? [data.task] : []

        if (taskList.length === 0) {
          setChatMessages(prev => [...prev, { role: 'oracle', text: "I caught that you want to add a task, but couldn't quite extract the details. Try something like: **\"Add task: book flights to Croatia\"** or **\"Remind me to call the dentist tomorrow\"**" }])
        } else {
          const results = await Promise.all(
            taskList.map(t =>
              fetch('/api/quests/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId,
                  dimension: t.dimension ?? 'career',
                  title: t.title,
                  xpReward: t.xpReward ?? 50,
                  taskDate: t.date,
                  milestoneId: t.milestoneId ?? undefined,
                }),
              })
            )
          )
          const allOk = results.every(r => r.ok)
          const savedCount = results.filter(r => r.ok).length
          if (savedCount > 0) {
            window.dispatchEvent(new CustomEvent('protagonist:task-added'))
          }
          if (allOk) {
            const reply = data.oracleReply ??
              (taskList.length === 1
                ? `Task added: "${taskList[0].title}"`
                : `Added ${taskList.length} tasks: ${taskList.map(t => `"${t.title}"`).join(', ')}`)
            setChatMessages(prev => [...prev, { role: 'oracle', text: reply }])
          } else if (savedCount > 0) {
            setChatMessages(prev => [...prev, { role: 'oracle', text: `Saved ${savedCount} of ${taskList.length} tasks — one or more couldn't be saved. Try adding the missing ones individually.` }])
          } else {
            setChatMessages(prev => [...prev, { role: 'oracle', text: "Couldn't save that task — try again." }])
          }
        }
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
      } else if (data.intent === 'MILESTONE' && data.milestone) {
        const ms = data.milestone
        if (!ms.questId) {
          // No quest matched — fall back to a loose task so it's still captured
          await fetch('/api/quests/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              dimension: ms.dimension ?? 'career',
              title: ms.title,
              xpReward: 75,
              taskDate: ms.targetDate ?? null,
            }),
          })
          window.dispatchEvent(new CustomEvent('protagonist:task-added'))
          const reply = data.oracleReply ?? `Added "${ms.title}" as a task — attach it to a quest on your ${ms.dimension ?? 'career'} page when ready.`
          setChatMessages(prev => [...prev, { role: 'oracle', text: reply }])
        } else {
          const msRes = await fetch('/api/quests/milestones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              questId: ms.questId,
              title: ms.title,
              targetDate: ms.targetDate ?? null,
            }),
          })
          window.dispatchEvent(new CustomEvent('protagonist:task-added'))
          if (!msRes.ok) {
            setChatMessages(prev => [...prev, { role: 'oracle', text: `Couldn't save that milestone — try again.` }])
          } else {
            const msData = (await msRes.json()) as { milestone?: { id: string } }
            const milestoneId = msData.milestone?.id

            // Confirm milestone created first
            const confirmMsg = data.oracleReply ?? `Done — "${ms.title}" added as a milestone.`
            setChatMessages(prev => [...prev, { role: 'oracle', text: confirmMsg + ' Generating tasks…' }])

            // Auto-generate tasks linked to this milestone in the background
            if (milestoneId) {
              try {
                // Fetch quest vision to give Oracle context for task generation
                const questRes = await fetch(`/api/quests/character/${ms.dimension ?? 'career'}?userId=${encodeURIComponent(userId)}`)
                const questData = (await questRes.json()) as { quest?: { vision?: string } }
                const questVision = questData.quest?.vision ?? ''

                const genRes = await fetch('/api/quests/milestones/generate-tasks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId,
                    milestoneId,
                    milestoneTitle: ms.title,
                    questVision,
                    dimension: ms.dimension ?? 'career',
                    targetDate: ms.targetDate ?? null,
                  }),
                })
                const genData = (await genRes.json()) as { tasks?: Array<{ title: string }> }
                const taskCount = genData.tasks?.length ?? 0
                if (taskCount > 0) {
                  setChatMessages(prev => {
                    const msgs = [...prev]
                    msgs[msgs.length - 1] = { role: 'oracle', text: confirmMsg + ` I've also broken it down into ${taskCount} tasks — open the milestone on your ${ms.dimension ?? 'career'} page to see them.` }
                    return msgs
                  })
                  window.dispatchEvent(new CustomEvent('protagonist:task-added'))
                } else {
                  setChatMessages(prev => {
                    const msgs = [...prev]
                    msgs[msgs.length - 1] = { role: 'oracle', text: confirmMsg }
                    return msgs
                  })
                }
              } catch {
                // Task generation failed silently — milestone is still saved
                setChatMessages(prev => {
                  const msgs = [...prev]
                  msgs[msgs.length - 1] = { role: 'oracle', text: confirmMsg }
                  return msgs
                })
              }
            }
          }
        }
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
        // CHAT / NOTE — send to Arc for a conversational reply (streamed)
        // Pass conversation history so Arc remembers context from earlier in the session
        const reply = await streamArcReply({
          message: text,
          userId,
          conversationHistory: chatMessages.slice(-16),
        })
        // Save all chat + note exchanges to voice_notes so they appear in the journal stream
        fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, content: text, oracleReply: reply }),
        }).then(() => {
          window.dispatchEvent(new CustomEvent('protagonist:note-saved'))
        }).catch(() => {})
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'oracle', text: "Something went wrong — try again." }])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatLoading, userId, attachments, chatMessages, streamArcReply])

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
      saveCheckinToCache(data)
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
      {/* Full-viewport flex overlay — avoids transform-centering issues with overflow:hidden ancestors */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Backdrop */}
        <div
          role="button" tabIndex={0} aria-label="Close"
          onClick={close}
          onKeyDown={e => e.key === 'Enter' && close()}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', cursor: 'default' }}
        />

        {/* Modal */}
        <div style={{
          ...font,
          position: 'relative',
          zIndex: 1,
          width: 'min(860px, calc(100vw - 40px))',
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
          attachments={attachments}
          onAttach={handleFileAttach}
          onRemoveAttach={(index) => setAttachments(prev => prev.filter((_, i) => i !== index))}
          fileInputRef={fileInputRef}
          onClearHistory={() => {
            setChatMessages([])
            try { localStorage.removeItem(chatHistoryKey) } catch { /* ignore */ }
          }}
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
      </div>
    </>
  )
}

// ── Chat view ─────────────────────────────────────────────────────────────────

function ChatView({ messages, input, setInput, onSubmit, loading, inputRef, chatEndRef, onClose, attachments, onAttach, onRemoveAttach, fileInputRef, onClearHistory }: {
  messages: { role: 'user' | 'oracle'; text: string }[]
  input: string
  setInput: (v: string) => void
  onSubmit: () => void
  loading: boolean
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  chatEndRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  attachments: { type: 'file' | 'image'; name: string; content: string; mimeType?: string }[]
  onAttach: (file: File) => void
  onRemoveAttach: (index: number) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onClearHistory: () => void
}) {
  const QUICK = ['Plan my day', 'Review my week', 'Add a task', 'Log something I did', 'What should I focus on?']
  const [isRecording, setIsRecording] = React.useState(false)
  const recognitionRef = React.useRef<SpeechRecognition | null>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const isNearBottomRef = React.useRef(true)

  // Track whether user has scrolled away from the bottom
  const handleScrollContainer = React.useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    isNearBottomRef.current = (el.scrollHeight - el.scrollTop - el.clientHeight) < 80
  }, [])

  // Sticky-scroll: instant snap when near bottom (no smooth = no bouncing during streaming)
  React.useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    if (isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  // Auto-grow textarea
  React.useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input, inputRef])

  function stopVoice() {
    if (!isRecording) return
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsRecording(false)
  }

  function toggleVoice() {
    if (isRecording) { stopVoice(); return }
    const SR = (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'
    recognitionRef.current = rec
    setIsRecording(true)
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setInput(t)
    }
    rec.onerror = () => { setIsRecording(false) }
    rec.onend = () => {
      setIsRecording(s => {
        if (s) { try { rec.start() } catch { return false } }
        return s
      })
    }
    rec.start()
  }

  function handleSubmit() {
    stopVoice()
    void onSubmit()
  }

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

        {messages.length > 0 && (
          <div style={{ width: '100%', marginTop: 'auto', paddingTop: 16 }}>
            <button
              onClick={onClearHistory}
              style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 10px', color: 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.87"/>
              </svg>
              New conversation
            </button>
          </div>
        )}
      </div>

      {/* Chat main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Title bar */}
        <div style={{ background: '#1A1335', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <OracleRobot size={26} />
          <div>
            <div style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>The Oracle</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Your AI life companion</div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollContainerRef} onScroll={handleScrollContainer} style={{ flex: 1, padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none' }}>
          {messages.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: 40 }}>
              Ask Oracle anything — tasks, calendar, reflections, or just a chat.
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
          {loading && messages[messages.length - 1]?.role !== 'oracle' && (
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
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px' }}>
          {/* Attachment preview — thumbnail grid for multiple files */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {attachments.map((att, idx) => (
                att.type === 'image' ? (
                  <div key={idx} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:${att.mimeType ?? 'image/jpeg'};base64,${att.content}`}
                      alt={att.name}
                      style={{ height: 52, maxWidth: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}
                    />
                    <button onClick={() => onRemoveAttach(idx)} style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: 'rgba(30,20,50,0.9)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                  </div>
                ) : (
                  <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(123,63,228,0.15)', border: '1px solid rgba(123,63,228,0.3)', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: 'rgba(255,255,255,0.8)', maxWidth: 220 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(123,63,228,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                    <button onClick={() => onRemoveAttach(idx)} style={{ marginLeft: 2, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.html,.htm,.txt,.md,.csv"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                const files = Array.from(e.target.files ?? [])
                files.forEach(file => onAttach(file))
                e.target.value = ''
              }}
            />

            {/* Paperclip button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file or photo"
              style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>

            {/* Mic button */}
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
              style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: isRecording ? 'rgba(255,107,157,0.2)' : 'rgba(255,255,255,0.06)',
                border: isRecording ? '1.5px solid rgba(255,107,157,0.6)' : '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
                animation: isRecording ? 'dm-spin 2s linear infinite' : 'none',
              }}
            >
              {isRecording ? (
                /* Stop icon */
                <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,107,157,0.9)">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
              ) : (
                /* Mic icon */
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              )}
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
              placeholder={isRecording ? 'Listening…' : attachments.length > 0 ? 'Add a message (or just send the files)…' : 'Ask Oracle anything…'}
              rows={1}
              style={{ flex: 1, background: isRecording ? 'rgba(255,107,157,0.06)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isRecording ? 'rgba(255,107,157,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.5, transition: 'border-color 0.15s, background 0.15s', overflowY: 'auto', minHeight: 40, maxHeight: 160 }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={(!input.trim() && attachments.length === 0) || loading}
              style={{ background: (input.trim() || attachments.length > 0) && !loading ? '#FF7A65' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (input.trim() || attachments.length > 0) && !loading ? 'pointer' : 'default', flexShrink: 0, transition: 'background 0.15s' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
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
  const [isRecording, setIsRecording] = React.useState(false)
  const recognitionRef = React.useRef<SpeechRecognition | null>(null)

  function stopVoice() {
    if (!isRecording) return
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsRecording(false)
  }

  function toggleVoice() {
    if (isRecording) { stopVoice(); return }
    const SR = (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'
    recognitionRef.current = rec
    setIsRecording(true)
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setInput(t)
    }
    rec.onerror = () => { setIsRecording(false) }
    rec.onend = () => {
      setIsRecording(s => {
        if (s) { try { rec.start() } catch { return false } }
        return s
      })
    }
    rec.start()
  }

  function handleSubmit() {
    stopVoice()
    void onSubmit()
  }

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
          <span style={{ ...metaLabel, marginBottom: 6 }}>Oracle says</span>
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
              {mode === 'checkin-loading' ? 'Loading your morning...' : 'Oracle is processing your check-in...'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
              Share anything — how you slept, how you feel, what's on your mind, what you're planning. Oracle will pull out tasks, surface insights, and set you up for the day.
            </div>
            <textarea
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
              placeholder={isRecording ? 'Listening…' : 'e.g. Slept okay, feeling a bit tired but motivated. Big interview at 11, then I need to work on the app. Also need to plan Croatia trip...'}
              style={{ flex: 1, background: isRecording ? 'rgba(255,107,157,0.06)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isRecording ? 'rgba(255,107,157,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, padding: '14px 16px', color: 'white', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.7, marginBottom: 14, transition: 'border-color 0.15s, background 0.15s' }}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Voice button */}
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: isRecording ? 'rgba(255,107,157,0.2)' : 'rgba(255,255,255,0.06)',
                  border: isRecording ? '1.5px solid rgba(255,107,157,0.6)' : '1px solid rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {isRecording ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,107,157,0.9)">
                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </button>
              <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 18px', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Skip for now
              </button>
              <button
                onClick={handleSubmit}
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
          <span style={{ ...metaLabel, marginBottom: 6 }}>Oracle says</span>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontStyle: 'italic', lineHeight: 1.6 }}>
            &ldquo;{result.oracle_message || 'Your morning has been set. Make today count.'}&rdquo;
          </div>
        </div>
      </div>

      {/* Right */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 22px', overflowY: 'auto', gap: 18, scrollbarWidth: 'none' }}>

        {/* Oracle's reflection — shown first, most important */}
        {result.oracle_reflection && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,122,101,0.1) 0%, rgba(123,63,228,0.08) 100%)',
            border: '1px solid rgba(255,122,101,0.22)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <OracleRobot size={18} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#FF7A65', letterSpacing: '1.2px', textTransform: 'uppercase' as const }}>Oracle's take</span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
              {result.oracle_reflection}
            </p>
          </div>
        )}

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
                      {CHARACTERS[t.dimension as Dimension]?.categoryLabel ?? t.dimension}
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
            Ask Oracle to adjust
          </button>
          <button onClick={onClose} style={{ flex: 1, background: '#FF7A65', border: 'none', borderRadius: 10, padding: '11px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Start my day →
          </button>
        </div>
      </div>
    </div>
  )
}
