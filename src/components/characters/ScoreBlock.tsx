'use client'

import { useEffect, useState } from 'react'
import { getLevel, getLevelProgress } from '@/lib/xp'
import type { Dimension } from '@/lib/character'

const CATEGORY_LABELS: Record<Dimension, string> = {
  career:   'Career',
  social:   'Friends',
  wealth:   'Finances',
  vitality: 'Body',
  mind:     'Mind',
  love:     'Relationship',
  family:   'Family',
}

/** Derive 1–10 score from XP alone */
function xpScore(xp: number): number {
  const level = getLevel(xp)
  const progress = getLevelProgress(xp)
  return Math.min(10, Math.max(1, Math.round(level * 1.5 + progress)))
}

/** Returns user-set baseline if available, otherwise XP-derived score */
export function blendScore(baseline: number | null, xp: number): number {
  if (baseline != null) return baseline
  return xpScore(xp)
}

interface ScoreBlockProps {
  dimension: Dimension
  xp: number
  userId: string
  accentColor: string
}

export function ScoreBlock({ dimension, xp, userId, accentColor }: ScoreBlockProps) {
  const [baseline, setBaseline]   = useState<number | null>(null)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [loading, setLoading]     = useState(true)

  const categoryLabel = CATEGORY_LABELS[dimension]
  const xs  = xpScore(xp)
  const displayed = blendScore(baseline, xp)

  useEffect(() => {
    fetch(`/api/dimension-score?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data: { scores?: Record<string, number> }) => {
        const b = data.scores?.[dimension]
        setBaseline(b ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userId, dimension])

  async function handleSelect(value: number) {
    setBaseline(value)
    setSaving(true)
    setSaved(false)
    await fetch('/api/dimension-score', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, dimension, baseline: value }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return null

  return (
    <div
      style={{
        background: '#140C28',
        borderRadius: 14,
        border: '0.5px solid #2D1B55',
        padding: '14px 14px 14px 17px',
        marginBottom: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: accentColor,
        }}
      />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px',
          color: 'rgba(255,255,255,0.55)', fontWeight: 500,
        }}>
          My score
        </span>
        {saved && (
          <span style={{ fontSize: 11, color: accentColor }}>Saved</span>
        )}
        {saving && !saved && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Saving…</span>
        )}
      </div>

      {/* Score + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span style={{
          fontSize: 42, fontWeight: 700, color: accentColor, lineHeight: 1,
        }}>
          {displayed}
        </span>
        <div>
          <div style={{ fontSize: 13, color: '#E8E0F0', fontWeight: 500, marginBottom: 2 }}>
            {categoryLabel}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {baseline != null
              ? `Your score · XP rank: ${xs}`
              : `Set your score below`}
          </div>
        </div>
      </div>

      {/* 1–10 selector */}
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const isSelected = baseline === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => void handleSelect(n)}
              style={{
                flex: 1, height: 32, borderRadius: 7,
                background: isSelected ? accentColor : 'rgba(255,255,255,0.05)',
                border: isSelected
                  ? 'none'
                  : n <= displayed
                    ? `0.5px solid ${accentColor}50`
                    : '0.5px solid rgba(255,255,255,0.08)',
                color: isSelected ? '#0D0820' : n <= displayed ? accentColor : 'rgba(255,255,255,0.38)',
                fontSize: 12, fontWeight: isSelected ? 700 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}
            >
              {n}
            </button>
          )
        })}
      </div>

      {/* Hint */}
      <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>
        How would you honestly rate this area of your life right now?
      </div>
    </div>
  )
}
