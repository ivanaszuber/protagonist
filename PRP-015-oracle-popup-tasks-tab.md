# PRP-015 — Oracle Popup Redesign + Tasks Tab

## What this builds

1. **Dashboard fix** — `MissionCard` shows "+ Add task for today" when a quest exists but no task is scheduled.
2. **`OracleSheet` component** — replaces `ArcChat` everywhere. A unified bottom sheet that accepts voice or text, classifies intent (task / voice note / chat), and acts accordingly.
3. **`POST /api/oracle/classify`** — AI endpoint that parses free-text input and returns structured intent + data.
4. **Tasks page** (`/tasks`) — Today / Upcoming / Someday views, grouped by dimension with accent colours.
5. **Nav update** — 5th tab (Tasks checklist icon), consistent across all pages.
6. **Remove old Arc FAB** — delete `ArcChat` usage from `layout.tsx`; `OracleSheet` replaces it everywhere.

---

## Change 1: Dashboard fix — `src/app/dashboard/page.tsx`

Inside the **filled** `MissionCard` (the `return` after `if (!quest)`), add an inline "+ Add task for today" row immediately after the `{todayTask && ...}` block:

```tsx
{/* Show when quest exists but no task today */}
{!todayTask && (
  <div
    role="button"
    tabIndex={0}
    onClick={(e) => {
      e.stopPropagation()
      window.dispatchEvent(
        new CustomEvent('protagonist:open-oracle', {
          detail: { prefill: `add task for ${areaLabel} today — `, dimension },
        })
      )
    }}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation()
        window.dispatchEvent(
          new CustomEvent('protagonist:open-oracle', {
            detail: { prefill: `add task for ${areaLabel} today — `, dimension },
          })
        )
      }
    }}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer',
      padding: '2px 0',
    }}
  >
    <div
      style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        border: `1.5px dashed ${color}`,
        flexShrink: 0,
        opacity: 0.5,
      }}
    />
    <span style={{ fontSize: 9, color: '#5A4A7A' }}>+ Add task for today</span>
  </div>
)}
```

This opens the Oracle sheet pre-filled with the dimension context so the user can complete the task description naturally.

---

## Change 2: Oracle classify API — `src/app/api/oracle/classify/route.ts`

Create this new file. It takes free text, the user's active quests for context, and returns a classified intent with parsed fields.

```typescript
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const { text, userId } = await request.json()
  if (!text || !userId) {
    return NextResponse.json({ error: 'text and userId required' }, { status: 400 })
  }

  // Fetch active quests for context
  const { data: quests } = await supabase
    .from('main_quests')
    .select('id, dimension, vision')
    .eq('user_id', userId)
    .eq('active', true)

  const questContext = (quests ?? [])
    .map((q) => `- ${q.dimension}: "${q.vision}" (id: ${q.id})`)
    .join('\n')

  const today = new Date().toISOString().split('T')[0]
  const todayDate = new Date()

  const prompt = `You are a smart assistant for the Protagonist app. The user spoke or typed: "${text}"

Today's date is ${today}.

The user's active quests:
${questContext || '(none yet)'}

Classify this input into one of three intents:
1. TASK — user wants to create a task/to-do (keywords: "add", "remind", "schedule", "I need to", "don't forget", "book", "call", "send", "prep", "do", or any action item)
2. NOTE — user is journaling, reflecting, or sharing feelings (emotional, reflective, no clear action item)
3. CHAT — user has a question or wants Oracle's guidance

For TASK, extract:
- title: clean task title (remove filler words like "add task" or "remind me to")
- dimension: one of "career", "social", "wealth" (infer from context — job/work/interview = career, people/relationships/social = social, money/finances/savings = wealth). If unclear, return null.
- date: ISO date string if a date is mentioned (today, tomorrow, day names, etc.), otherwise null. Today = ${today}.
- milestoneId: match to one of the user's quest IDs above if clearly relevant, otherwise null
- xpReward: 25 for tiny tasks, 50 for standard, 100 for hard/important ones
- questId: the quest id if matched, otherwise null

Respond ONLY with valid JSON, no explanation:
{
  "intent": "TASK" | "NOTE" | "CHAT",
  "task": {
    "title": "...",
    "dimension": "career" | "social" | "wealth" | null,
    "date": "YYYY-MM-DD" | null,
    "questId": "..." | null,
    "milestoneId": null,
    "xpReward": 50
  } | null,
  "note": {
    "text": "..." 
  } | null,
  "oracleReply": "..." // short reply for NOTE or CHAT intents (1-2 sentences, warm, direct)
}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'

  try {
    const parsed = JSON.parse(raw)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json(
      { intent: 'CHAT', task: null, note: null, oracleReply: "I heard you — what would you like to do?" },
      { status: 200 }
    )
  }
}
```

---

## Change 3: Update tasks API to allow Someday — `src/app/api/quests/tasks/route.ts`

The POST handler currently defaults `task_date` to today. Change it to allow `null` for Someday tasks:

```typescript
// BEFORE
task_date: taskDate ?? new Date().toISOString().split('T')[0],

// AFTER
task_date: taskDate ?? null,   // null = Someday (no scheduled date)
```

And update the GET handler to support fetching Someday tasks:

```typescript
// Existing GET already accepts ?date=YYYY-MM-DD
// Add support for ?someday=true to fetch undated tasks for a dimension

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const date = searchParams.get('date')
  const someday = searchParams.get('someday') === 'true'
  const dimension = searchParams.get('dimension')

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }
  if (!isQuestDbConfigured()) {
    return NextResponse.json({ tasks: [] })
  }

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (someday) {
    query = query.is('task_date', null)
  } else if (date) {
    query = query.eq('task_date', date)
  }

  if (dimension) {
    query = query.eq('dimension', dimension)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ tasks: data ?? [] })
}
```

---

## Change 4: New OracleSheet component — `src/components/OracleSheet.tsx`

This replaces `ArcChat.tsx`. It shows on every page as a bottom sheet, triggered by the pulsing Oracle FAB. The FAB is now rendered inside this component so it's consistent everywhere (no more separate FAB on the dashboard page).

```tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getUserId } from '@/lib/user'

type SheetState = 'closed' | 'idle' | 'recording' | 'thinking' | 'task-done' | 'note-done' | 'chat'

interface ParsedTask {
  title: string
  dimension: string | null
  date: string | null
  questId: string | null
  milestoneId: string | null
  xpReward: number
}

interface ClassifyResult {
  intent: 'TASK' | 'NOTE' | 'CHAT'
  task: ParsedTask | null
  note: { text: string } | null
  oracleReply: string | null
}

const DIMENSION_LABELS: Record<string, string> = {
  career: 'Forge · Career',
  social: 'Echo · Social',
  wealth: 'Vault · Finances',
}

const DIMENSION_COLORS: Record<string, string> = {
  career: '#EF9F27',
  social: '#F0997B',
  wealth: '#1D9E75',
}

function OracleEye({ size = 16, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <ellipse cx="8" cy="8" rx="7" ry="4.5" stroke={pulse ? '#E879F9' : '#9333EA'} strokeWidth="1.2"/>
      <circle cx="8" cy="8" r="2.5" stroke="#C084FC" strokeWidth="1"/>
      <circle cx="8" cy="8" r="1.2" fill="#E879F9"/>
      <circle cx="7" cy="7" r=".6" fill="white" opacity={0.5}/>
    </svg>
  )
}

export function OracleSheet() {
  const router = useRouter()
  const userId = getUserId()
  const [state, setState] = useState<SheetState>('closed')
  const [inputText, setInputText] = useState('')
  const [result, setResult] = useState<ClassifyResult | null>(null)
  const [savedTaskId, setSavedTaskId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'oracle'; text: string }[]>([])
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Listen for programmatic open events (e.g. from dashboard "+ Add task" button)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { prefill?: string } | undefined
      setInputText(detail?.prefill ?? '')
      setState('idle')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    window.addEventListener('protagonist:open-oracle', handler)
    return () => window.removeEventListener('protagonist:open-oracle', handler)
  }, [])

  const close = useCallback(() => {
    setState('closed')
    setInputText('')
    setResult(null)
    setSavedTaskId(null)
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }, [])

  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    recognitionRef.current = rec
    setState('recording')
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const t = e.results[0]?.[0]?.transcript ?? ''
      setInputText(t)
      setState('idle')
    }
    rec.onerror = () => setState('idle')
    rec.onend = () => {
      if (state === 'recording') setState('idle')
    }
    rec.start()
  }, [state])

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop()
    setState('idle')
  }, [])

  const handleSubmit = useCallback(async () => {
    const text = inputText.trim()
    if (!text) return
    setState('thinking')

    try {
      const res = await fetch('/api/oracle/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userId }),
      })
      const data: ClassifyResult = await res.json()
      setResult(data)

      if (data.intent === 'TASK' && data.task) {
        // Auto-save the task immediately
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
        const taskData = await taskRes.json()
        setSavedTaskId(taskData.task?.id ?? null)
        setState('task-done')
      } else if (data.intent === 'NOTE') {
        setState('note-done')
      } else {
        // CHAT — show Oracle's reply in conversation
        setChatMessages((prev) => [
          ...prev,
          { role: 'user', text },
          { role: 'oracle', text: data.oracleReply ?? '...' },
        ])
        setState('chat')
      }
    } catch {
      setState('idle')
    }
  }, [inputText, userId])

  // FAB — not rendered on /oracle page (Oracle has its own full page)
  if (state === 'closed') {
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

  return (
    <>
      {/* Backdrop */}
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
          zIndex: 48,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 49,
          background: '#140C28',
          borderRadius: '20px 20px 0 0',
          borderTop: '0.5px solid #2D1B55',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 32, height: 3, background: '#2D1B55', borderRadius: 2, margin: '12px auto 0' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: '#200A45',
                border: `1.5px solid ${state === 'recording' ? '#E879F9' : '#9333EA'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <OracleEye size={16} pulse={state === 'recording'} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#E8E0F0' }}>
                {state === 'recording' ? 'Listening...' :
                 state === 'thinking' ? 'Oracle' :
                 state === 'task-done' ? 'Task added' :
                 state === 'note-done' ? 'Oracle' :
                 'Oracle'}
              </div>
              <div style={{ fontSize: 10, color:
                state === 'recording' ? '#9333EA' :
                state === 'thinking' ? '#5A4A7A' :
                state === 'task-done' ? '#34d399' :
                state === 'note-done' ? '#C084FC' :
                '#5A4A7A'
              }}>
                {state === 'recording' ? 'tap stop when done' :
                 state === 'thinking' ? 'reading your intent...' :
                 state === 'task-done' ? `saved · ${result?.task?.dimension ? DIMENSION_LABELS[result.task.dimension] ?? '' : ''}` :
                 state === 'note-done' ? 'reflecting on your note...' :
                 'speak, type, or drop an image'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{ width: 26, height: 26, borderRadius: '50%', background: '#1E0D40', border: '0.5px solid #2D1B55', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="#6A5A8A" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ padding: '0 14px' }}>

          {/* ── IDLE / RECORDING: input area ── */}
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
                  /* Voice waveform */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
                    {[6,14,20,10,18,8,22,12,16,6,20,10,14].map((h, i) => (
                      <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: '#9333EA', opacity: 0.4 + (i % 3) * 0.2 }} />
                    ))}
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
                    <rect x="4.5" y="1" width="5" height="8" rx="2.5" stroke={state === 'recording' ? 'white' : '#9333EA'} strokeWidth="1.2"/>
                    <path d="M2 7.5c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke={state === 'recording' ? 'white' : '#9333EA'} strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="7" y1="12.5" x2="7" y2="14" stroke={state === 'recording' ? 'white' : '#9333EA'} strokeWidth="1.2" strokeLinecap="round"/>
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
                    background: (inputText.trim() || state === 'recording') ? '#9333EA' : '#1E0D40',
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

          {/* ── TASK DONE ── */}
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
                <div style={{ fontSize: 13, color: '#C0B0E0', marginBottom: 10 }}>"{result.task.title}"</div>
                <div style={{ height: '0.5px', background: '#1E1040', marginBottom: 10 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {result.task.dimension && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                      borderRadius: 6, fontSize: 10,
                      background: `${DIMENSION_COLORS[result.task.dimension]}1a`,
                      border: `0.5px solid ${DIMENSION_COLORS[result.task.dimension]}4d`,
                      color: DIMENSION_COLORS[result.task.dimension],
                    }}>
                      <svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill={DIMENSION_COLORS[result.task.dimension]}/></svg>
                      {DIMENSION_LABELS[result.task.dimension]}
                    </span>
                  )}
                  {result.task.date && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 10, background: '#1E0D40', border: '0.5px solid #2D1B55', color: '#7A5FA0' }}>
                      {new Date(result.task.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {!result.task.date && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 10, background: '#1E0D40', border: '0.5px solid #2D1B55', color: '#5A4A7A' }}>
                      Someday
                    </span>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(52,211,153,.08)', border: '0.5px solid rgba(52,211,153,.2)', color: '#34d399' }}>
                    +{result.task.xpReward} XP
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => router.push('/tasks')}
                  style={{ flex: 1, height: 44, borderRadius: 10, background: '#1E0D40', border: '0.5px solid #2D1B55', color: '#7A5FA0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  View in Tasks
                </button>
                <button
                  type="button"
                  onClick={() => { setInputText(''); setResult(null); setState('idle'); setTimeout(() => inputRef.current?.focus(), 100) }}
                  style={{ flex: 2, height: 44, borderRadius: 10, background: '#9333EA', border: 'none', color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Add another
                </button>
              </div>
            </>
          )}

          {/* ── NOTE DONE ── */}
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
                <div style={{ fontSize: 12, color: '#7A5FA0', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 8 }}>"{result.note?.text}"</div>
                <div style={{ height: '0.5px', background: '#1E1040', marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 5 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 10, background: '#1E0D40', border: '0.5px solid #2D1B55', color: '#7A5FA0' }}>Voice note</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(168,85,247,.08)', border: '0.5px solid rgba(168,85,247,.2)', color: '#C084FC' }}>Logged</span>
                </div>
              </div>
              {result.oracleReply && (
                <div style={{ background: '#1A0D35', borderRadius: 10, border: '0.5px solid #2D1B55', borderLeft: '3px solid #9333EA', padding: '10px 12px', marginBottom: 8, borderRadius: '0 10px 10px 10px' }}>
                  <div style={{ fontSize: 10, color: '#9333EA', marginBottom: 4 }}>Oracle</div>
                  <div style={{ fontSize: 12, color: '#A090C0', fontStyle: 'italic', lineHeight: 1.5 }}>{result.oracleReply}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => { setInputText(''); setResult(null); setState('idle') }}
                  style={{ flex: 1, height: 44, borderRadius: 10, background: '#1E0D40', border: '0.5px solid #2D1B55', color: '#7A5FA0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  New note
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatMessages([
                      { role: 'oracle', text: result.oracleReply ?? '' }
                    ])
                    setState('chat')
                  }}
                  style={{ flex: 2, height: 44, borderRadius: 10, background: '#9333EA', border: 'none', color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Reply to Oracle
                </button>
              </div>
            </>
          )}

          {/* ── CHAT ── */}
          {state === 'chat' && (
            <>
              <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      maxWidth: '85%',
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div style={{
                      background: msg.role === 'user' ? 'rgba(147,51,234,0.2)' : '#1A0D35',
                      border: `0.5px solid ${msg.role === 'user' ? 'rgba(147,51,234,0.35)' : '#2D1B55'}`,
                      borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      padding: '9px 13px',
                      fontSize: 13,
                      color: '#E8E0F0',
                      lineHeight: 1.55,
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit() } }}
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
                  style={{ width: 44, height: 44, borderRadius: 10, background: '#9333EA', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  aria-label="Send"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 13V3M4 7l4-4 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
```

---

## Change 5: Update layout — `src/app/layout.tsx`

Replace `ArcChat` with `OracleSheet`:

```tsx
// BEFORE
import { ArcChat } from '@/components/arc/ArcChat'
// ...
<ArcChat />

// AFTER
import { OracleSheet } from '@/components/OracleSheet'
// ...
<OracleSheet />
```

---

## Change 6: Remove Oracle FAB from dashboard — `src/app/dashboard/page.tsx`

The Oracle FAB is now rendered by `OracleSheet` in the layout and appears on every page. Remove the custom FAB block from the dashboard so it doesn't render twice:

```tsx
// DELETE this entire block from dashboard/page.tsx:
<div
  style={{
    position: 'fixed',
    bottom: 96,
    right: 20,
    width: 54,
    height: 54,
    ...
  }}
>
  {/* pulsing rings + oracle button */}
</div>
```

---

## Change 7: Tasks page — `src/app/tasks/page.tsx`

Create the full Tasks page with Today / Upcoming / Someday views.

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { getUserId } from '@/lib/user'

type TabView = 'today' | 'upcoming' | 'someday'

interface Task {
  id: string
  title: string
  dimension: string
  task_date: string | null
  completed: boolean
  xp_reward: number
}

const DIMENSION_ORDER = ['career', 'social', 'wealth'] as const

const DIMENSION_META = {
  career: { label: 'Forge · Career', color: '#EF9F27', dot: '#EF9F27' },
  social: { label: 'Echo · Social',  color: '#F0997B', dot: '#F0997B' },
  wealth: { label: 'Vault · Finances', color: '#1D9E75', dot: '#1D9E75' },
} as const

function getDaysFromNow(date: string): number {
  const d = new Date(date + 'T12:00:00')
  const now = new Date()
  return Math.ceil((d.getTime() - now.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
  const days = getDaysFromNow(dateStr)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 1 && days <= 7) return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function TasksPage() {
  const userId = getUserId()
  const [tab, setTab] = useState<TabView>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [completingId, setCompletingId] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    if (tab === 'today') {
      const res = await fetch(`/api/quests/tasks?userId=${encodeURIComponent(userId)}&date=${today}`)
      const data = await res.json()
      setTasks(data.tasks ?? [])
    } else if (tab === 'upcoming') {
      // Fetch next 14 days (excluding today)
      const upcoming: Task[] = []
      for (let i = 1; i <= 14; i++) {
        const d = new Date()
        d.setDate(d.getDate() + i)
        const ds = d.toISOString().split('T')[0]
        const res = await fetch(`/api/quests/tasks?userId=${encodeURIComponent(userId)}&date=${ds}`)
        const data = await res.json()
        upcoming.push(...(data.tasks ?? []))
      }
      setTasks(upcoming)
    } else {
      // Someday — no date
      const res = await fetch(`/api/quests/tasks?userId=${encodeURIComponent(userId)}&someday=true`)
      const data = await res.json()
      setTasks(data.tasks ?? [])
    }
    setLoading(false)
  }, [userId, tab])

  useEffect(() => { void loadTasks() }, [loadTasks])

  async function handleComplete(taskId: string, xpReward: number) {
    setCompletingId(taskId)
    await fetch(`/api/quests/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, completed: true } : t))
    setCompletingId(null)
  }

  // Group tasks by dimension
  const byDimension = DIMENSION_ORDER.reduce<Record<string, Task[]>>((acc, dim) => {
    acc[dim] = tasks.filter((t) => t.dimension === dim)
    return acc
  }, {} as Record<string, Task[]>)

  // For Upcoming, also group by date
  const byDate = tab === 'upcoming'
    ? Array.from(new Set(tasks.map((t) => t.task_date).filter(Boolean) as string[])).sort()
    : []

  return (
    <main
      className="dashboard-scroll"
      style={{
        background: '#0D0820',
        minHeight: '100dvh',
        paddingBottom: 100,
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '0 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 4px 16px' }}>
          <span style={{ fontSize: 22, fontWeight: 500, color: '#E8E0F0' }}>Tasks</span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('protagonist:open-oracle'))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#200A45', border: '1.5px solid #9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="#9333EA" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#140C28', borderRadius: 12, padding: 4, border: '0.5px solid #2D1B55' }}>
          {(['today', 'upcoming', 'someday'] as TabView[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px 4px',
                borderRadius: 9,
                border: 'none',
                background: tab === t ? '#2D1B55' : 'transparent',
                color: tab === t ? '#E8E0F0' : '#5A4A7A',
                fontSize: 12,
                fontWeight: tab === t ? 500 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#3D3358', fontSize: 13 }}>Loading...</div>
        ) : tab === 'upcoming' ? (
          /* Upcoming — grouped by date */
          byDate.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            byDate.map((date) => {
              const dateTasks = tasks.filter((t) => t.task_date === date)
              return (
                <div key={date} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: '#5A4A7A', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    {formatDate(date)}
                  </div>
                  {dateTasks.map((task) => (
                    <TaskRow key={task.id} task={task} onComplete={handleComplete} completingId={completingId} />
                  ))}
                </div>
              )
            })
          )
        ) : (
          /* Today & Someday — grouped by dimension */
          DIMENSION_ORDER.map((dim) => {
            const dimTasks = byDimension[dim] ?? []
            const meta = DIMENSION_META[dim]
            return (
              <div key={dim} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill={meta.dot} opacity={0.8}/></svg>
                  <span style={{ fontSize: 10, color: '#3D3358', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{meta.label}</span>
                </div>
                {dimTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onComplete={handleComplete} completingId={completingId} />
                ))}
                {/* Always show inline add */}
                <AddTaskRow dimension={dim} color={meta.color} onAdded={loadTasks} />
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}

function TaskRow({ task, onComplete, completingId }: {
  task: Task
  onComplete: (id: string, xp: number) => void
  completingId: string | null
}) {
  const color = DIMENSION_META[task.dimension as keyof typeof DIMENSION_META]?.color ?? '#9333EA'
  const isCompleting = completingId === task.id

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#140C28',
        borderRadius: 12,
        border: '0.5px solid #2D1B55',
        padding: '10px 12px 10px 14px',
        marginBottom: 6,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
      <button
        type="button"
        onClick={() => !task.completed && onComplete(task.id, task.xp_reward)}
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `1.5px solid ${task.completed ? '#34d399' : color}`,
          background: task.completed ? '#34d399' : 'transparent',
          flexShrink: 0,
          cursor: task.completed ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={task.completed ? 'Completed' : 'Mark complete'}
      >
        {isCompleting && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${color}`, borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
        )}
        {task.completed && !isCompleting && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2.5 5l2 2 3-3.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <span style={{
        flex: 1,
        fontSize: 13,
        color: task.completed ? '#3D3358' : '#C0B0E0',
        textDecoration: task.completed ? 'line-through' : 'none',
        lineHeight: 1.4,
      }}>
        {task.title}
      </span>
      {task.task_date && (
        <span style={{ fontSize: 10, color: '#5A4A7A', flexShrink: 0 }}>{formatDate(task.task_date)}</span>
      )}
    </div>
  )
}

function AddTaskRow({ dimension, color, onAdded }: { dimension: string; color: string; onAdded: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent('protagonist:open-oracle', {
            detail: { prefill: `add task for ${dimension} — ` },
          })
        )
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          window.dispatchEvent(
            new CustomEvent('protagonist:open-oracle', {
              detail: { prefill: `add task for ${dimension} — ` },
            })
          )
        }
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px', cursor: 'pointer' }}
    >
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px dashed ${color}`, opacity: 0.4, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: '#3D3358' }}>+ Add task</span>
    </div>
  )
}

function EmptyState({ tab }: { tab: TabView }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#3D3358', fontSize: 13 }}>
      {tab === 'upcoming' ? 'Nothing scheduled yet.' : 'No someday tasks yet.'}
    </div>
  )
}
```

---

## Change 8: Update BottomNav — `src/components/BottomNav.tsx`

Add Tasks as the 5th nav item. The icon is a small clipboard/checklist that fits the dark aesthetic.

```tsx
// Add to navItems array (after Vault):
{
  href: '/tasks',
  label: 'Tasks',
  icon: (active: boolean) => (
    <svg width="20" height="22" viewBox="0 0 24 26" fill="none">
      <rect x="3" y="3" width="18" height="20" rx="4"
        fill={active ? 'rgba(147,51,234,0.15)' : 'transparent'}
        stroke={active ? '#9333EA' : '#2D1B55'}
        strokeWidth="1.2"
      />
      {/* Top clip bar */}
      <rect x="8" y="1" width="8" height="4" rx="2"
        fill={active ? '#9333EA' : '#2D1B55'}
      />
      {/* Task lines */}
      <circle cx="7.5" cy="10" r="1.5" fill={active ? '#9333EA' : '#6A5A8A'}/>
      <line x1="10.5" y1="10" x2="18" y2="10"
        stroke={active ? '#9333EA' : '#6A5A8A'} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="7.5" cy="15" r="1.5" fill={active ? '#C084FC' : '#6A5A8A'} opacity={active ? 0.7 : 0.5}/>
      <line x1="10.5" y1="15" x2="16" y2="15"
        stroke={active ? '#C084FC' : '#6A5A8A'} strokeWidth="1.2" strokeLinecap="round" opacity={active ? 0.7 : 0.5}/>
      <circle cx="7.5" cy="20" r="1.5" fill={active ? '#C084FC' : '#6A5A8A'} opacity={active ? 0.4 : 0.3}/>
      <line x1="10.5" y1="20" x2="14" y2="20"
        stroke={active ? '#C084FC' : '#6A5A8A'} strokeWidth="1.2" strokeLinecap="round" opacity={active ? 0.4 : 0.3}/>
    </svg>
  ),
},
```

---

## Checklist for Cursor

### New files to create:
- `src/components/OracleSheet.tsx` — unified Oracle bottom sheet (full code above)
- `src/app/api/oracle/classify/route.ts` — AI intent classification endpoint
- `src/app/tasks/page.tsx` — Tasks page (full code above)

### Files to edit:

1. **`src/app/layout.tsx`**
   - Remove `import { ArcChat }` and `<ArcChat />`
   - Add `import { OracleSheet } from '@/components/OracleSheet'` and `<OracleSheet />`

2. **`src/app/dashboard/page.tsx`**
   - Remove the entire Oracle FAB `<div>` block (position:fixed, bottom:96, right:20) — `OracleSheet` now renders it
   - Add `!todayTask && <div onClick opens oracle...>+ Add task for today</div>` inside the filled MissionCard (see Change 1)

3. **`src/components/BottomNav.tsx`**
   - Add Tasks as the 5th nav item (see Change 8)

4. **`src/app/api/quests/tasks/route.ts`**
   - Change task_date default from `new Date()...` to `null` (Someday support)
   - Update GET to support `?someday=true` and `?dimension=` params (see Change 3)

### No changes needed:
- `src/app/api/quests/tasks/[id]/complete/route.ts` — existing task completion works as-is
- `src/app/globals.css` — all required keyframes already there from PRP-013
- `src/lib/supabase.ts` — no change
- `src/components/arc/ArcChat.tsx` — can be deleted after OracleSheet is confirmed working

### Commit:
```bash
git add . && git commit -m "feat: Oracle unified sheet + Tasks tab + dashboard task fix" && git push
```

---

## Design notes for Cursor

- **`OracleSheet` is the single source of truth for the Oracle FAB**. It renders everywhere via the layout. There should be no other Oracle FAB in any page component.
- **The `protagonist:open-oracle` custom event** is how any component opens the sheet programmatically. Pass `detail: { prefill: '...' }` to pre-fill the input.
- **Task intent detection**: the classify API uses Claude Haiku for speed and cost. It returns a JSON object — parse defensively with a try/catch.
- **Someday tasks have `task_date: null`** in the database. The existing tasks table already supports nullable `task_date` in Postgres — no migration needed, just stop defaulting to today.
- **The Tasks page uses the same `dashboard-scroll` CSS class** for scrollbar hiding — no new CSS needed.
- **Chat in OracleSheet** still calls `/api/arc` (the existing Oracle chat endpoint) for the actual reply — the classify endpoint only classifies intent and gives a short oracle reply for notes. For full conversation, wire the CHAT state to call `/api/arc` for subsequent messages.
- **ArcChat.tsx can be deleted** once OracleSheet is verified working in production. Keep it until the first deploy is stable.
