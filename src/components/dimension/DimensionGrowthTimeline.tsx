'use client'

import React, { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Dimension } from '@/lib/character'

interface PatternEntry {
  id: string
  content: string
  type: 'win' | 'shift' | 'hard'
  created_at: string
}

interface Props {
  dimension: Dimension
  userId: string
  accentColor: string
}

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

const TYPE_CONFIG = {
  win:   { dot: '#1D9E75', label: 'win',   labelColor: 'rgba(29,158,117,0.75)' },
  shift: { dot: '#A78BFA', label: 'shift', labelColor: 'rgba(167,139,250,0.75)' },
  hard:  { dot: '#F0882A', label: 'hard',  labelColor: 'rgba(240,136,42,0.75)' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
}

export function DimensionGrowthTimeline({ dimension, userId, accentColor }: Props) {
  const [entries, setEntries] = useState<PatternEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch(`/api/dimension/pattern-log?userId=${encodeURIComponent(userId)}&dimensionId=${encodeURIComponent(dimension)}`)
      .then(r => r.json())
      .then((data: PatternEntry[]) => { if (Array.isArray(data)) setEntries(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId, dimension])

  return (
    <div style={{ background: '#0F0B1F', border: '0.5px solid #1E1240', borderRadius: 12, padding: '13px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <span style={{ ...font, fontSize: 8, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.28)' }}>
          Growth timeline
        </span>
      </div>

      {loading ? (
        <div style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', lineHeight: 1.5 }}>
          Oracle will surface patterns here as you check in.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.slice(0, 6).map((entry) => {
            const cfg = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.shift
            return (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: cfg.dot, flexShrink: 0, marginTop: 3,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...font, fontSize: 10, color: 'rgba(255,255,255,0.62)', lineHeight: 1.45, marginBottom: 2 }}>
                    {entry.content}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ ...font, fontSize: 8, fontWeight: 600, color: cfg.labelColor }}>{cfg.label}</span>
                    <span style={{ ...font, fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>{timeAgo(entry.created_at)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
