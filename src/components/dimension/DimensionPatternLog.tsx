'use client'

import React, { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Dimension } from '@/lib/character'

interface LogEntry {
  id: string
  type: 'win' | 'shift' | 'hard'
  text: string
  created_at: string
}

interface Props {
  dimension: Dimension
  userId: string
  accentColor: string
}

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

const TYPE_CONFIG = {
  win:   { bg: '#0A2010', color: '#1D9E75', dot: '#1D9E75',  label: 'win' },
  shift: { bg: '',        color: '',        dot: '#FF6B9D',   label: 'shift' },
  hard:  { bg: '#2A0808', color: '#F05050', dot: '#F0882A',  label: 'hard' },
}

function fmtRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function DimensionPatternLog({ dimension, userId, accentColor }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [adding, setAdding] = useState(false)
  const [newType, setNewType] = useState<'win' | 'shift' | 'hard'>('win')
  const [newText, setNewText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetch(`/api/dimension/pattern-log?userId=${encodeURIComponent(userId)}&dimensionId=${encodeURIComponent(dimension)}`)
      .then(r => r.json())
      .then((data: LogEntry[]) => { if (Array.isArray(data)) setEntries(data) })
      .catch(() => {})
  }, [userId, dimension])

  async function addEntry() {
    if (!newText.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/dimension/pattern-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, dimensionId: dimension, type: newType, text: newText.trim() }),
      })
      const created = await res.json() as LogEntry
      setEntries(prev => [created, ...prev])
      setNewText('')
      setAdding(false)
    } catch { /* silent */ }
    setSaving(false)
  }

  async function deleteEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id))
    await fetch(`/api/dimension/pattern-log?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  return (
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span style={{ ...font, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.04em' }}>
            Pattern Log
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAdding(a => !a)}
          style={{
            background: 'transparent', border: 'none',
            color: accentColor, fontSize: 11, cursor: 'pointer',
            fontFamily: 'inherit', padding: 0, opacity: 0.8,
          }}
        >
          {adding ? 'cancel' : '+ log moment'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div style={{ marginBottom: 12, padding: '12px', background: '#0D0820', borderRadius: 10, border: `0.5px solid ${accentColor}30` }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['win', 'shift', 'hard'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setNewType(t)}
                style={{
                  ...font, fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                  background: newType === t
                    ? (t === 'win' ? '#0A2010' : t === 'hard' ? '#2A0808' : `${accentColor}18`)
                    : 'rgba(255,255,255,0.04)',
                  border: newType === t
                    ? `0.5px solid ${t === 'win' ? '#1D9E75' : t === 'hard' ? '#F05050' : accentColor}60`
                    : '0.5px solid rgba(255,255,255,0.08)',
                  color: newType === t
                    ? (t === 'win' ? '#1D9E75' : t === 'hard' ? '#F05050' : accentColor)
                    : 'rgba(255,255,255,0.3)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            placeholder="What happened?"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            rows={2}
            style={{
              ...font, width: '100%', background: '#140C28', border: `0.5px solid ${accentColor}35`,
              borderRadius: 8, color: '#E8E0F0', fontSize: 12, padding: '8px 10px',
              outline: 'none', resize: 'none', lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              onClick={() => void addEntry()}
              disabled={saving || !newText.trim()}
              style={{
                background: `${accentColor}18`, border: `0.5px solid ${accentColor}40`,
                borderRadius: 8, color: accentColor, fontSize: 11, padding: '7px 16px',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              }}
            >
              {saving ? '…' : 'Log it'}
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !adding && (
        <div style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', padding: '4px 0' }}>
          Log moments — wins, shifts, and hard days — to see your patterns over time.
        </div>
      )}

      {entries.map((entry, idx) => {
        const cfg = TYPE_CONFIG[entry.type]
        const isShift = entry.type === 'shift'
        return (
          <div key={entry.id} style={{
            padding: '9px 0',
            borderBottom: idx < entries.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
              <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.28)' }}>{fmtRelTime(entry.created_at)}</span>
              <span style={{
                ...font, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                background: isShift ? `${accentColor}12` : cfg.bg,
                color: isShift ? accentColor : cfg.color,
                border: `0.5px solid ${isShift ? `${accentColor}30` : 'transparent'}`,
              }}>
                {cfg.label}
              </span>
              <button type="button" onClick={() => void deleteEntry(entry.id)} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.1)',
                cursor: 'pointer', fontSize: 10, padding: 0, marginLeft: 'auto',
              }}>✕</button>
            </div>
            <p style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, margin: 0, paddingLeft: 13 }}>
              {entry.text}
            </p>
          </div>
        )
      })}
    </div>
  )
}
