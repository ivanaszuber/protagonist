'use client'

import React, { useEffect, useState, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Dimension } from '@/lib/character'

interface Item {
  id: string
  text: string
  completed: boolean
  sort_order: number
}

interface Props {
  dimension: Dimension
  userId: string
  accentColor: string
}

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

export function DimensionTopOfMind({ dimension, userId, accentColor }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetch(`/api/dimension/top-of-mind?userId=${encodeURIComponent(userId)}&dimensionId=${encodeURIComponent(dimension)}`)
      .then(r => r.json())
      .then((data: Item[]) => { if (Array.isArray(data)) setItems(data) })
      .catch(() => {})
  }, [userId, dimension])

  useEffect(() => {
    if (adding) setTimeout(() => inputRef.current?.focus(), 50)
  }, [adding])

  async function addItem() {
    if (!newText.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/dimension/top-of-mind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, dimensionId: dimension, text: newText.trim() }),
      })
      const created = await res.json() as Item
      setItems(prev => [...prev, created])
      setNewText('')
      setAdding(false)
    } catch { /* silent */ }
    setSaving(false)
  }

  async function toggleItem(item: Item) {
    const updated = { ...item, completed: !item.completed }
    setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    await fetch('/api/dimension/top-of-mind', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, completed: updated.completed }),
    })
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/dimension/top-of-mind?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  const open   = items.filter(i => !i.completed)
  const done   = items.filter(i => i.completed)

  return (
    <div style={{ background: '#140C28', border: '0.5px solid #2D1B55', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14 }}>🎯</span>
          <span style={{ ...font, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.04em' }}>
            Top of Mind
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
          {adding ? 'cancel' : '+ intention'}
        </button>
      </div>

      {items.length === 0 && !adding && (
        <div style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
          What's on your mind for this dimension right now?
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="What's on your mind?"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void addItem(); if (e.key === 'Escape') setAdding(false) }}
            style={{
              ...font, flex: 1, background: '#0D0820', border: `0.5px solid ${accentColor}40`,
              borderRadius: 8, color: '#E8E0F0', fontSize: 12, padding: '7px 10px', outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void addItem()}
            disabled={saving || !newText.trim()}
            style={{
              background: `${accentColor}18`, border: `0.5px solid ${accentColor}40`,
              borderRadius: 8, color: accentColor, fontSize: 11, padding: '7px 12px',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            {saving ? '…' : 'Add'}
          </button>
        </div>
      )}

      {/* Open items */}
      {open.map((item, idx) => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0',
          borderBottom: idx < open.length - 1 || done.length > 0 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
        }}>
          <button
            type="button"
            onClick={() => void toggleItem(item)}
            style={{
              width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
              border: `1.5px solid ${accentColor}50`, background: 'none', cursor: 'pointer', padding: 0,
            }}
          />
          <span style={{ ...font, flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>{item.text}</span>
          <button type="button" onClick={() => void deleteItem(item.id)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)',
            cursor: 'pointer', fontSize: 10, padding: '0 0 0 4px',
          }}>✕</button>
        </div>
      ))}

      {/* Completed items */}
      {done.map((item, idx) => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0',
          borderBottom: idx < done.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
        }}>
          <button
            type="button"
            onClick={() => void toggleItem(item)}
            style={{
              width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
              border: 'none', background: `${accentColor}20`,
              cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <polyline points="2,5 4,7.5 8,3" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span style={{ ...font, flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.28)', textDecoration: 'line-through' }}>{item.text}</span>
          <button type="button" onClick={() => void deleteItem(item.id)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.1)',
            cursor: 'pointer', fontSize: 10, padding: '0 0 0 4px',
          }}>✕</button>
        </div>
      ))}
    </div>
  )
}
