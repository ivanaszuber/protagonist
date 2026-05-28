'use client'

import { useState, useRef, useEffect } from 'react'

interface LegendCardProps {
  characterName: string
  dimensionLabel: string
  dimension: string
  vision: string | null
  accentColor: string
  userId: string
  onQuestSaved?: (vision: string) => void
}

export function LegendCard({
  characterName,
  dimensionLabel,
  dimension,
  vision,
  accentColor,
  userId,
  onQuestSaved,
}: LegendCardProps) {
  const hasQuest = Boolean(vision?.trim())
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(vision ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Keep local text in sync if vision prop changes from outside
  useEffect(() => {
    if (!editing) setText(vision ?? '')
  }, [vision, editing])

  // Auto-focus textarea when editing opens
  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  async function handleSave() {
    const trimmed = text.trim()
    if (!trimmed) { setError('Write your quest first.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/quests/vision', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, dimension, vision: trimmed }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Something went wrong.')
        return
      }
      setEditing(false)
      onQuestSaved?.(trimmed)
      window.dispatchEvent(new CustomEvent('protagonist:quest-updated'))
    } catch {
      setError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSave()
    if (e.key === 'Escape') { setEditing(false); setText(vision ?? '') }
  }

  const font = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

  return (
    <div
      style={{
        background: '#140C1A',
        border: `0.5px solid ${accentColor}`,
        borderRadius: 12,
        padding: '14px',
        marginBottom: 16,
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
          <path
            d="M5 1L6.2 3.8H9.2L6.8 5.6L7.8 8.5L5 6.8L2.2 8.5L3.2 5.6L0.8 3.8H3.8L5 1Z"
            fill={accentColor}
          />
        </svg>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: accentColor }}>
          {hasQuest && !editing ? 'The Quest' : editing ? 'Edit Quest' : 'No Quest yet'}
        </span>

        {/* Edit pencil — only shown when quest exists and not editing */}
        {hasQuest && !editing && (
          <button
            type="button"
            onClick={() => { setEditing(true); setText(vision ?? '') }}
            aria-label="Edit quest"
            style={{
              marginLeft: 'auto',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 4, color: '#7A5FA0',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Display mode — quest set, not editing */}
      {hasQuest && !editing && (
        <>
          <p style={{ fontSize: 13, fontStyle: 'italic', color: '#F0E8D0', lineHeight: 1.5, margin: '0 0 6px', paddingRight: 4 }}>
            &ldquo;{vision}&rdquo;
          </p>
          <p style={{ fontSize: 10, color: '#7A5A2A', margin: 0 }}>
            Your defining quest. Everything else serves this.
          </p>
        </>
      )}

      {/* No quest yet — show direct write form */}
      {!hasQuest && !editing && (
        <>
          <p style={{ fontSize: 11, color: '#7A5FA0', margin: '0 0 10px', lineHeight: 1.5 }}>
            Write your long-term quest for {dimensionLabel}. One sentence, in your own words.
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#1E0D40', border: `0.5px solid ${accentColor}`,
              borderRadius: 8, padding: '8px 12px', fontSize: 11, color: accentColor,
              cursor: 'pointer', ...font,
            }}
          >
            <span>✦</span>
            Define your Quest
          </button>
        </>
      )}

      {/* Edit / create form */}
      {editing && (
        <div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => { setText(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder={`e.g. "Build a business that gives me complete freedom by 35"`}
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${accentColor}60`,
              borderRadius: 8, padding: '9px 10px',
              fontSize: 12, color: '#F0E8D0', lineHeight: 1.5,
              resize: 'none', outline: 'none',
              ...font,
            }}
          />
          {error && (
            <p style={{ fontSize: 11, color: '#ef4444', margin: '4px 0 0' }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none',
                background: accentColor, color: '#0D0820',
                fontSize: 11, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1, ...font,
              }}
            >
              {saving ? 'Saving…' : 'Save Quest'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setText(vision ?? ''); setError('') }}
              style={{
                padding: '8px 12px', borderRadius: 8,
                border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent',
                color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', ...font,
              }}
            >
              ×
            </button>
          </div>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', margin: '6px 0 0' }}>
            ⌘↵ to save · Esc to cancel
          </p>
        </div>
      )}
    </div>
  )
}
