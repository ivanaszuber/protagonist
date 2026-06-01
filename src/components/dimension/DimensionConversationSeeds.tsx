'use client'

import React, { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Dimension } from '@/lib/character'

interface Props {
  dimension: Dimension
  userId: string
  accentColor: string
}

const font: CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" }

export function DimensionConversationSeeds({ dimension, userId, accentColor }: Props) {
  const [seeds, setSeeds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadSeeds(refresh = false) {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(
        `/api/dimension/conversation-seeds?userId=${encodeURIComponent(userId)}&dimensionId=${encodeURIComponent(dimension)}&refresh=${refresh}`
      )
      const data = await res.json() as { seeds: string[] }
      if (Array.isArray(data.seeds)) setSeeds(data.seeds)
    } catch { /* silent */ }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { void loadSeeds() }, [userId, dimension])

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14 }}>💬</span>
          <span style={{ ...font, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.04em' }}>
            Conversation Seeds
          </span>
        </div>
        <button
          type="button"
          onClick={() => void loadSeeds(true)}
          disabled={refreshing}
          style={{
            background: 'none', border: 'none',
            color: refreshing ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)',
            fontSize: 11, cursor: refreshing ? 'default' : 'pointer',
            fontFamily: 'inherit', padding: 0,
          }}
        >
          {refreshing ? 'loading…' : '↻ new seeds'}
        </button>
      </div>

      {loading ? (
        <div style={{ ...font, fontSize: 11, color: 'rgba(255,255,255,0.2)', padding: '8px 0' }}>Generating questions…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {seeds.map((seed, i) => (
            <div key={i} style={{
              background: '#100828', border: `0.5px solid ${accentColor}18`,
              borderRadius: 10, padding: '10px 13px',
              display: 'flex', alignItems: 'flex-start', gap: 9,
            }}>
              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>✨</span>
              <span style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.68)', lineHeight: 1.6 }}>{seed}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
