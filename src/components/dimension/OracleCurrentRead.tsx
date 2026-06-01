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

export function OracleCurrentRead({ dimension, userId, accentColor }: Props) {
  const [read, setRead]           = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  async function load(refresh = false) {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ userId, dimensionId: dimension })
      if (refresh) params.set('refresh', 'true')
      const res = await fetch(`/api/quests/character-insight?userId=${encodeURIComponent(userId)}&dimension=${encodeURIComponent(dimension)}`)
      const data = await res.json() as { narrative?: string }
      if (data.narrative) {
        setRead(data.narrative)
        setGeneratedAt(new Date().toISOString())
      }
    } catch { /* silent */ }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { void load() }, [userId, dimension])

  function fmtAge(iso: string | null): string {
    if (!iso) return ''
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 2) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div style={{
      background: `${accentColor}05`,
      border: `1px solid ${accentColor}18`,
      borderRadius: 14, padding: '14px 16px', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill={accentColor}>
            <path d="M12 2l2.4 7.6H22l-6.4 4.6 2.4 7.6L12 17.2l-6 4.6 2.4-7.6L2 9.6h7.6L12 2z"/>
          </svg>
          <span style={{ ...font, fontSize: 9, fontWeight: 700, color: accentColor, letterSpacing: '1.4px', textTransform: 'uppercase' as const }}>
            Oracle&apos;s Current Read
          </span>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          style={{
            background: 'none', border: 'none',
            color: refreshing ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)',
            fontSize: 11, cursor: refreshing ? 'default' : 'pointer',
            fontFamily: 'inherit', padding: 0,
          }}
        >
          {refreshing ? 'loading…' : '↻ refresh'}
        </button>
      </div>

      {loading ? (
        <div style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Reading your patterns…</div>
      ) : read ? (
        <>
          <p style={{ ...font, fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
            &ldquo;{read}&rdquo;
          </p>
          <span style={{ ...font, fontSize: 9, color: 'rgba(255,255,255,0.2)', display: 'block', marginTop: 7 }}>
            {generatedAt ? `Updated ${fmtAge(generatedAt)} · based on your check-ins` : 'Based on your recent check-ins'}
          </span>
        </>
      ) : (
        <p style={{ ...font, fontSize: 12, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
          Check in more to unlock Oracle&apos;s read on this dimension.
        </p>
      )}
    </div>
  )
}
