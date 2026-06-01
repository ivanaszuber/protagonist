'use client'

import React, { useEffect, useState, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Dimension } from '@/lib/character'

interface Pillar {
  id: string
  text: string
  emoji: string
  sort_order: number
}

interface Props {
  dimension: Dimension
  userId: string
  accentColor: string
}

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

const DIMENSION_LABELS: Record<string, string> = {
  love:     'My non-negotiables',
  vitality: 'My commitments',
  mind:     'My anchors',
  career:   'My principles',
  social:   'My standards',
  wealth:   'My principles',
  family:   'My values',
}

const DIMENSION_SUBLABEL: Record<string, string> = {
  love:     'must-have',
  vitality: 'commitment',
  mind:     'anchor',
  career:   'principle',
  social:   'standard',
  wealth:   'principle',
  family:   'value',
}

const LAYOUT_GRID = new Set(['love', 'family'])  // 2-col grid; others use chip row

export function DimensionPillars({ dimension, userId, accentColor }: Props) {
  const [pillars, setPillars] = useState<Pillar[]>([])
  const [editing, setEditing] = useState(false)
  const [newText, setNewText] = useState('')
  const [newEmoji, setNewEmoji] = useState('⭐')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const label = DIMENSION_LABELS[dimension] ?? 'My pillars'
  const sublabel = DIMENSION_SUBLABEL[dimension] ?? 'pillar'
  const useGrid = LAYOUT_GRID.has(dimension)

  useEffect(() => {
    void fetch(`/api/dimension/pillars?userId=${encodeURIComponent(userId)}&dimensionId=${encodeURIComponent(dimension)}`)
      .then(r => r.json())
      .then((data: Pillar[]) => { if (Array.isArray(data)) setPillars(data) })
      .catch(() => {})
  }, [userId, dimension])

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 50)
  }, [editing])

  async function addPillar() {
    if (!newText.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/dimension/pillars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, dimensionId: dimension, text: newText.trim(), emoji: newEmoji }),
      })
      const created = await res.json() as Pillar
      setPillars(prev => [...prev, created])
      setNewText('')
      setNewEmoji('⭐')
      setEditing(false)
    } catch { /* silent */ }
    setSaving(false)
  }

  async function deletePillar(id: string) {
    await fetch(`/api/dimension/pillars?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    setPillars(prev => prev.filter(p => p.id !== id))
  }

  const card: CSSProperties = {
    background: '#140C28',
    border: '0.5px solid #2D1B55',
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 14,
  }

  const accentBar: CSSProperties = {
    width: 3, height: 14, borderRadius: 2,
    background: accentColor, flexShrink: 0,
  }

  const addBtn: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: accentColor,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: 0,
    opacity: 0.8,
  }

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={accentBar} />
          <span style={{ ...font, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '1.4px', textTransform: 'uppercase' as const }}>
            {label}
          </span>
          <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>· {dimension}</span>
        </div>
        {!editing && (
          <button type="button" style={addBtn} onClick={() => setEditing(true)}>
            {pillars.length === 0 ? '+ add' : 'edit'}
          </button>
        )}
      </div>

      {/* Empty state */}
      {pillars.length === 0 && !editing && (
        <div style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', padding: '4px 0' }}>
          Add your {label.toLowerCase()} — Oracle will use them to personalise advice.
        </div>
      )}

      {/* Grid layout (love/family) */}
      {useGrid && pillars.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: editing ? 10 : 0 }}>
          {pillars.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: `${accentColor}07`, border: `0.5px solid ${accentColor}22`,
              borderRadius: 10, padding: '9px 12px', position: 'relative', minWidth: 0,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: `${accentColor}12`, border: `0.5px solid ${accentColor}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, flexShrink: 0,
              }}>{p.emoji}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...font, fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.82)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {p.text}
                </div>
                <div style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>{sublabel}</div>
              </div>
              {editing && (
                <button type="button" onClick={() => void deletePillar(p.id)} style={{
                  position: 'absolute', top: 4, right: 4, background: 'none', border: 'none',
                  color: 'rgba(255,100,100,0.5)', cursor: 'pointer', fontSize: 10, padding: '2px 4px',
                }}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chip layout (other dimensions) */}
      {!useGrid && pillars.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: editing ? 10 : 0 }}>
          {pillars.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: `${accentColor}07`, border: `0.5px solid ${accentColor}20`,
              borderRadius: 8, padding: '6px 11px', position: 'relative',
            }}>
              <span style={{ fontSize: 12 }}>{p.emoji}</span>
              <span style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>{p.text}</span>
              {editing && (
                <button type="button" onClick={() => void deletePillar(p.id)} style={{
                  background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)',
                  cursor: 'pointer', fontSize: 10, padding: '0 0 0 4px',
                }}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {editing && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={`New ${sublabel}...`}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void addPillar(); if (e.key === 'Escape') setEditing(false) }}
            style={{
              ...font, flex: 1, background: '#0D0820', border: `0.5px solid ${accentColor}40`,
              borderRadius: 8, color: '#E8E0F0', fontSize: 12, padding: '7px 10px', outline: 'none',
            }}
          />
          <input
            type="text"
            maxLength={2}
            value={newEmoji}
            onChange={e => setNewEmoji(e.target.value)}
            style={{
              ...font, width: 36, background: '#0D0820', border: `0.5px solid ${accentColor}40`,
              borderRadius: 8, color: '#E8E0F0', fontSize: 14, padding: '7px 6px',
              textAlign: 'center', outline: 'none',
            }}
          />
          <button type="button" onClick={() => void addPillar()} disabled={saving || !newText.trim()} style={{
            background: `${accentColor}18`, border: `0.5px solid ${accentColor}40`,
            borderRadius: 8, color: accentColor, fontSize: 11, padding: '7px 12px',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          }}>
            {saving ? '…' : 'Add'}
          </button>
          <button type="button" onClick={() => setEditing(false)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
          }}>cancel</button>
        </div>
      )}

      {/* Oracle info line */}
      {pillars.length > 0 && !editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', background: 'rgba(29,158,117,0.06)', border: '0.5px solid rgba(29,158,117,0.18)', borderRadius: 8, marginTop: 10 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#1D9E75" strokeWidth="2"/>
            <path d="M8 12l3 3 5-5" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ ...font, fontSize: 10, color: 'rgba(29,158,117,0.85)', lineHeight: 1.4 }}>
            Oracle uses these to personalise advice and flag alignment gaps
          </span>
        </div>
      )}
    </div>
  )
}
