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
  | 'activity-done'
  | 'note-done'
  | 'calendar-confirm'
  | 'calendar-update-confirm'
  | 'calendar-delete-confirm'
  | 'calendar-manage-done'
  | 'calendar-done'
  | 'chat'
  | 'checkin-loading'
  | 'checkin-listening'
  | 'checkin-thinking'
  | 'checkin-done'
  | 'vault-updated'

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

interface CalendarUpdateInput {
  event_id: string
  event_title: string
  current_date: string
  current_time: string | null
  new_date: string
  new_start_time: string | null
  new_duration_minutes: number
}

interface CalendarDeleteInput {
  event_id: string
  event_title: string
  event_date: string
  event_time: string | null
}

interface VaultUpdateInput {
  field: 'invested' | 'cash' | 'cash_delta' | 'invested_delta' | 'both'
  amount: number
  notes?: string | null
}

interface ClassifyResult {
  intent:
    | 'TASK'
    | 'COMPLETED_ACTIVITY'
    | 'NOTE'
    | 'LEGEND'
    | 'BOSS'
    | 'CALENDAR_CREATE'
    | 'CALENDAR_UPDATE'
    | 'CALENDAR_DELETE'
    | 'VAULT_UPDATE'
    | 'CHAT'
  task: ParsedTask | null
  completed_task?: {
    title: string
    dimension: string | null
    date: string | null
    xpReward: number
  } | null
  note: { text: string } | null
  legend?: { dimension: string; vision: string | null } | null
  boss?: { dimension: string } | null
  calendar_event?: CalendarEventInput | null
  calendar_update?: CalendarUpdateInput | null
  calendar_delete?: CalendarDeleteInput | null
  vault_update?: VaultUpdateInput | null
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

/** Render basic markdown (bold, italic, inline code) as safe HTML for Oracle responses */
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="font-family:monospace;background:rgba(147,51,234,0.15);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/\n/g, '<br/>')
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
  const [calendarManaging, setCalendarManaging] = useState(false)
  const [calendarManageAction, setCalendarManageAction] = useState<'update' | 'delete' | null>(
    null
  )
  const [calendarManageDoneMsg, setCalendarManageDoneMsg] = useState('')
  const [calendarInsufficientScope, setCalendarInsufficientScope] = useState(false)
  const [calendarDoneTitle, setCalendarDoneTitle] = useState('')
  const [vaultUpdatedTotal, setVaultUpdatedTotal] = useState<number | null>(null)
  const [morningContext, setMorningContext] = useState<MorningContext | null>(null)
  const [checkinResult, setCheckinResult] = useState<MorningCheckinResult | null>(null)
  const [legendDimension, setLegendDimension] = useState<string | null>(null)
  const [chatVoiceActive, setChatVoiceActive] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const checkinModeRef = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

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
      setChatVoiceActive(false)
      if (detail?.context === 'morning_checkin') {
        setInputText(detail?.prefill ?? '')
        setLegendDimension(null)
        checkinModeRef.current = true
        setState('checkin-loading')
        void loadMorningContext()
      } else if (
        detail?.context?.startsWith('legend:') ||
        detail?.context?.startsWith('legend-edit:')
      ) {
        // Legend creation/edit mode — bypass classify, save vision directly
        const parts = detail.context.split(':')
        const dim = parts[1] ?? ''
        setLegendDimension(dim)
        setInputText('')
        checkinModeRef.current = false
        setState('idle')
        setTimeout(() => inputRef.current?.focus(), 100)
      } else {
        setInputText(detail?.prefill ?? '')
        setLegendDimension(null)
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
    setLegendDimension(null)
    setChatVoiceActive(false)
    setCalendarInsufficientScope(false)
    setCalendarDoneTitle('')
    setCalendarManaging(false)
    setCalendarManageAction(null)
    setCalendarManageDoneMsg('')
    setVaultUpdatedTotal(null)
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

  const handleCalendarUpdate = useCallback(async () => {
    if (!result?.calendar_update) return
    const { event_id, event_title, new_date, new_start_time, new_duration_minutes } =
      result.calendar_update
    setCalendarManaging(true)
    try {
      const res = await fetch('/api/calendar/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          eventId: event_id,
          newDate: new_date,
          newStartTime: new_start_time ?? undefined,
          newDurationMinutes: new_duration_minutes ?? 60,
        }),
      })
      const data = (await res.json()) as { error?: string }

      if (res.status === 403 && data.error === 'insufficient_scope') {
        setCalendarInsufficientScope(true)
        setState('calendar-done')
      } else if (res.ok) {
        setCalendarManageDoneMsg(`✅ Updated — ${event_title} rescheduled.`)
        setState('calendar-manage-done')
        window.dispatchEvent(new CustomEvent('protagonist:calendar-updated'))
      } else {
        setCalendarManageDoneMsg("⚠️ Couldn't update the event — try again.")
        setState('calendar-manage-done')
      }
    } finally {
      setCalendarManaging(false)
    }
  }, [result, userId])

  const handleCalendarDelete = useCallback(async () => {
    if (!result?.calendar_delete) return
    const { event_id, event_title } = result.calendar_delete
    setCalendarManaging(true)
    try {
      const res = await fetch('/api/calendar/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, eventId: event_id }),
      })
      const data = (await res.json()) as { error?: string }

      if (res.status === 403 && data.error === 'insufficient_scope') {
        setCalendarInsufficientScope(true)
        setState('calendar-done')
      } else if (res.ok) {
        setCalendarManageDoneMsg(`🗑 Cancelled — ${event_title} removed from your calendar.`)
        setState('calendar-manage-done')
        window.dispatchEvent(new CustomEvent('protagonist:calendar-updated'))
      } else {
        setCalendarManageDoneMsg("⚠️ Couldn't cancel the event — try again.")
        setState('calendar-manage-done')
      }
    } finally {
      setCalendarManaging(false)
    }
  }, [result, userId])

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

  const startChatVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'
    recognitionRef.current = rec
    setChatVoiceActive(true)
    setInputText('')

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      setInputText(transcript)
    }

    rec.onerror = () => {
      setChatVoiceActive(false)
    }

    rec.onend = () => {
      setChatVoiceActive((active) => {
        if (active) {
          try {
            rec.start()
          } catch {
            return false
          }
          return true
        }
        return false
      })
    }

    rec.start()
  }, [])

  const stopChatVoice = useCallback(() => {
    setChatVoiceActive(false)
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (state === 'chat') {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [chatMessages, state])

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

    // Clear input immediately so it doesn't linger while Oracle thinks
    setInputText('')

    // Legend mode: skip classify, save vision directly
    if (legendDimension) {
      setIsSubmitting(true)
      setState('thinking')
      try {
        await fetch('/api/quests/vision', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, dimension: legendDimension, vision: text }),
        })
        const dimChar = CHARACTERS[legendDimension as Dimension]
        const charName = dimChar?.name ?? legendDimension
        setResult({
          intent: 'LEGEND',
          task: null,
          note: null,
          legend: { dimension: legendDimension, vision: text },
          oracleReply: `Your Legend is set, ${charName}: "${text}" — that's the mountain you're climbing.`,
        })
        setLegendDimension(null)
        window.dispatchEvent(new CustomEvent('protagonist:quest-updated'))
        setState('note-done')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

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

      if (data.intent === 'COMPLETED_ACTIVITY' && data.completed_task) {
        const ct = data.completed_task
        // Create task
        const createRes = await fetch('/api/quests/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            dimension: ct.dimension ?? 'vitality',
            title: ct.title,
            xpReward: ct.xpReward ?? 50,
            taskDate: ct.date,
          }),
        })
        const created = (await createRes.json()) as { task?: { id: string } }
        const taskId = created.task?.id
        if (taskId) {
          // Immediately mark complete to award XP
          await fetch(`/api/quests/tasks/${taskId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          })
        }
        // Reuse task-done state, but put the completed_task into result.task shape
        setResult({
          ...data,
          task: {
            title: ct.title,
            dimension: ct.dimension,
            date: ct.date,
            questId: null,
            milestoneId: null,
            xpReward: ct.xpReward ?? 50,
          },
        })
        window.dispatchEvent(new CustomEvent('protagonist:task-added'))
        setState('activity-done')
      } else if (data.intent === 'TASK' && data.task) {
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
      } else if (data.intent === 'CALENDAR_UPDATE' && data.calendar_update?.event_id) {
        setResult(data)
        setCalendarManageAction('update')
        setState('calendar-update-confirm')
      } else if (data.intent === 'CALENDAR_DELETE' && data.calendar_delete?.event_id) {
        setResult(data)
        setCalendarManageAction('delete')
        setState('calendar-delete-confirm')
      } else if (data.intent === 'VAULT_UPDATE' && data.vault_update) {
        const vu = data.vault_update
        const settingsRes = await fetch(`/api/vault/settings?userId=${encodeURIComponent(userId)}`)
        const settingsJson = (await settingsRes.json()) as {
          settings?: { invested: number; cash: number }
        }
        const current = settingsJson.settings ?? { invested: 0, cash: 0 }

        const patch: Record<string, number> = {}
        if (vu.field === 'cash') patch.cash = vu.amount
        if (vu.field === 'invested') patch.invested = vu.amount
        if (vu.field === 'both') {
          patch.cash = vu.amount
          patch.invested = vu.amount
        }
        if (vu.field === 'cash_delta') patch.cash = current.cash + vu.amount
        if (vu.field === 'invested_delta') patch.invested = current.invested + vu.amount

        const newInvested = patch.invested ?? current.invested
        const newCash = patch.cash ?? current.cash
        setVaultUpdatedTotal(newInvested + newCash)

        await fetch('/api/vault/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, patch }),
        })

        setResult(data)
        window.dispatchEvent(new CustomEvent('protagonist:vault-updated'))
        setState('vault-updated')
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
          const reply = await sendChatToArc(text)
          setChatMessages((prev) => [...prev, { role: 'oracle', text: reply }])
        } else {
          const reply = data.oracleReply ?? (await sendChatToArc(text))
          setChatMessages([{ role: 'user', text }, { role: 'oracle', text: reply }])
          setState('chat')
        }
      }
    } catch {
      if (!inChat) setState('idle')
    } finally {
      setIsSubmitting(false)
    }
  }, [inputText, legendDimension, userId, state, sendChatToArc, isSubmitting])

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
                  : state === 'activity-done'
                    ? `logged & +${result?.task?.xpReward ?? 50} XP`
                    : state === 'vault-updated'
                      ? 'Net worth synced'
                      : state === 'note-done'
                      ? 'reflecting on your note...'
                      : state === 'calendar-confirm'
                        ? 'confirm calendar event'
                        : state === 'calendar-update-confirm'
                          ? 'confirm reschedule'
                          : state === 'calendar-delete-confirm'
                            ? 'confirm cancellation'
                            : state === 'calendar-manage-done'
                              ? 'calendar updated'
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
                          : state === 'activity-done'
                            ? 'Activity logged ✓'
                            : state === 'vault-updated'
                              ? 'Vault updated ✓'
                              : state === 'calendar-confirm'
                            ? 'Calendar event'
                            : state === 'calendar-update-confirm'
                              ? 'Reschedule event'
                              : state === 'calendar-delete-confirm'
                                ? 'Cancel event'
                                : state === 'calendar-manage-done'
                                  ? calendarManageAction === 'delete'
                                    ? 'Event cancelled'
                                    : 'Event rescheduled'
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
                        : state === 'task-done' || state === 'activity-done' || state === 'vault-updated'
                          ? '#34d399'
                          : state === 'note-done'
                            ? '#C084FC'
                            : state === 'calendar-confirm' ||
                                state === 'calendar-update-confirm' ||
                                state === 'calendar-manage-done' ||
                                state === 'calendar-done'
                              ? '#60a5fa'
                              : state === 'calendar-delete-confirm'
                                ? '#ef4444'
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
              {legendDimension && (
                <div
                  style={{
                    background: 'rgba(147,51,234,0.08)',
                    border: '0.5px solid rgba(147,51,234,0.3)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 10, color: '#9333EA', marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    🔮 Define your Legend
                  </div>
                  <div style={{ fontSize: 12, color: '#C084FC', lineHeight: 1.5 }}>
                    {CHARACTERS[legendDimension as Dimension]
                      ? `Who will ${CHARACTERS[legendDimension as Dimension].name} become? Write your vision in one powerful sentence.`
                      : 'Write your vision in one powerful sentence.'}
                  </div>
                </div>
              )}
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

          {state === 'vault-updated' && (
            <>
              {result?.oracleReply && (
                <div
                  style={{
                    background: '#1A0D35',
                    border: '0.5px solid #2D1B55',
                    borderLeft: '3px solid #1D9E75',
                    padding: '10px 12px',
                    marginBottom: 10,
                    borderRadius: '0 10px 10px 10px',
                  }}
                >
                  <div style={{ fontSize: 10, color: '#1D9E75', marginBottom: 4 }}>Oracle</div>
                  <div
                    style={{ fontSize: 12, color: '#A090C0', fontStyle: 'italic', lineHeight: 1.5 }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(result.oracleReply) }}
                  />
                </div>
              )}
              {vaultUpdatedTotal != null && (
                <div
                  style={{
                    background: '#0A1F17',
                    borderRadius: 10,
                    border: '0.5px solid rgba(29,158,117,0.35)',
                    padding: '10px 12px',
                    marginBottom: 10,
                    fontSize: 13,
                    color: '#1D9E75',
                    fontWeight: 500,
                  }}
                >
                  New total net worth: £{Math.round(vaultUpdatedTotal).toLocaleString('en-GB')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={close}
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
                  Done
                </button>
              </div>
            </>
          )}

          {state === 'activity-done' && result?.task && (
            <>
              <div
                style={{
                  background: '#0D0820',
                  borderRadius: 12,
                  border: '0.5px solid #1A3A28',
                  padding: '12px',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 16 }}>✓</span>
                  <div style={{ fontSize: 13, color: '#C0B0E0', fontWeight: 500 }}>
                    {result.task.title}
                  </div>
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
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      background: 'rgba(52,211,153,.12)',
                      border: '0.5px solid rgba(52,211,153,.3)',
                      color: '#34d399',
                      fontWeight: 600,
                    }}
                  >
                    +{result.task.xpReward} XP earned
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
                    setTimeout(() => inputRef.current?.focus(), 100)
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
                  Log another
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
                  Keep going ›
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

          {state === 'calendar-update-confirm' && result?.calendar_update && (
            <>
              <div
                style={{
                  background: '#0D0820',
                  borderRadius: 12,
                  border: '0.5px solid #3D2070',
                  padding: '12px',
                  marginBottom: 10,
                  fontSize: 12,
                  color: '#C0B0E0',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontSize: 10, color: '#5A4A7A', marginBottom: 8 }}>
                  📅 Reschedule event
                </div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  {result.calendar_update.event_title}
                </div>
                <div
                  style={{
                    color: '#5A4A7A',
                    textDecoration: 'line-through',
                    fontSize: 11,
                  }}
                >
                  {result.calendar_update.current_date}
                  {result.calendar_update.current_time
                    ? ` · ${result.calendar_update.current_time}`
                    : ''}
                </div>
                <div style={{ color: '#60a5fa', fontSize: 11, marginTop: 2 }}>
                  → {result.calendar_update.new_date}
                  {result.calendar_update.new_start_time
                    ? ` · ${result.calendar_update.new_start_time}`
                    : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null)
                    setState('idle')
                  }}
                  disabled={calendarManaging}
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
                  onClick={() => void handleCalendarUpdate()}
                  disabled={calendarManaging}
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
                    opacity: calendarManaging ? 0.6 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {calendarManaging ? 'Updating...' : 'Reschedule ✓'}
                </button>
              </div>
            </>
          )}

          {state === 'calendar-delete-confirm' && result?.calendar_delete && (
            <>
              <div
                style={{
                  background: '#0D0820',
                  borderRadius: 12,
                  border: '0.5px solid #6B1A1A',
                  padding: '12px',
                  marginBottom: 10,
                  fontSize: 12,
                  color: '#C0B0E0',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontSize: 10, color: '#5A4A7A', marginBottom: 8 }}>
                  🗑 Cancel event
                </div>
                <div style={{ fontWeight: 500 }}>{result.calendar_delete.event_title}</div>
                {result.calendar_delete.event_time && (
                  <div style={{ color: '#5A4A7A', fontSize: 11, marginTop: 2 }}>
                    {result.calendar_delete.event_date} · {result.calendar_delete.event_time}
                  </div>
                )}
                <div style={{ color: '#ef4444', fontSize: 11, marginTop: 8 }}>
                  This will remove it from Google Calendar.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null)
                    setState('idle')
                  }}
                  disabled={calendarManaging}
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
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={() => void handleCalendarDelete()}
                  disabled={calendarManaging}
                  style={{
                    flex: 2,
                    height: 44,
                    borderRadius: 10,
                    background: calendarManaging ? '#3B0010' : '#7F1D1D',
                    border: '0.5px solid #ef4444',
                    color: '#fca5a5',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    opacity: calendarManaging ? 0.6 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {calendarManaging ? 'Cancelling...' : 'Yes, cancel it'}
                </button>
              </div>
            </>
          )}

          {state === 'calendar-manage-done' && (
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
                {calendarManageDoneMsg}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
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
                    background: '#1E0D40',
                    border: '0.5px solid #2D1B55',
                    color: '#7A5FA0',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Do more
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
                  Done
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
                    🔐 To manage events, reconnect Google Calendar with updated permissions.
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
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(checkinResult.oracle_message) }}
                  />
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
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(result.oracleReply) }}
                  />
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
                  maxHeight: '52vh',
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
                      dangerouslySetInnerHTML={
                        msg.role === 'oracle'
                          ? { __html: renderMarkdown(msg.text) }
                          : undefined
                      }
                    >
                      {msg.role === 'user' ? msg.text : null}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {chatVoiceActive && (
                <div
                  style={{
                    background: '#0D0820',
                    border: '0.5px solid #9333EA',
                    borderRadius: 10,
                    padding: '8px 12px',
                    marginBottom: 6,
                    fontSize: 12,
                    color: inputText ? '#C0B0E0' : '#5A4A7A',
                    fontStyle: inputText ? 'normal' : 'italic',
                    minHeight: 32,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#9333EA',
                      flexShrink: 0,
                      animation: 'oracle-cursor-blink 1s step-end infinite',
                    }}
                  />
                  {inputText || 'Listening...'}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={chatVoiceActive ? stopChatVoice : startChatVoice}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: chatVoiceActive ? '#9333EA' : '#1E0D40',
                    border: `0.5px solid ${chatVoiceActive ? '#9333EA' : '#2D1B55'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  aria-label={chatVoiceActive ? 'Stop recording' : 'Voice input'}
                >
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                    <rect
                      x="4.5"
                      y="1"
                      width="5"
                      height="8"
                      rx="2.5"
                      stroke={chatVoiceActive ? 'white' : '#9333EA'}
                      strokeWidth="1.2"
                    />
                    <path
                      d="M2 7.5c0 2.8 2.2 5 5 5s5-2.2 5-5"
                      stroke={chatVoiceActive ? 'white' : '#9333EA'}
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <line
                      x1="7"
                      y1="12.5"
                      x2="7"
                      y2="14"
                      stroke={chatVoiceActive ? 'white' : '#9333EA'}
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
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
