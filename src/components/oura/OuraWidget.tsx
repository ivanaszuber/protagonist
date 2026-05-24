'use client'

import { useEffect, useState, useCallback } from 'react'
import { getUserId } from '@/lib/user'

interface OuraData {
  readiness_score: number | null
  sleep_score: number | null
  activity_score: number | null
  hrv_balance: number | null
  steps: number | null
  sleep_total_seconds: number | null
}

function ScoreRing({
  score,
  label,
  color,
}: {
  score: number | null
  label: string
  color: string
}) {
  if (score === null) return null

  const level =
    score >= 85 ? 'Optimal' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : 'Low'
  const circumference = 2 * Math.PI * 20
  const filled = (score / 100) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <svg width={56} height={56} style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 48 48">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="4"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - filled}
            strokeLinecap="round"
          />
        </svg>
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: '#F0ECFF',
          }}
        >
          {score}
        </span>
      </div>
      <span style={{ fontSize: 11, color: '#6B5E8C' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{level}</span>
    </div>
  )
}

export default function OuraWidget() {
  const [data, setData] = useState<OuraData | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [syncing, setSyncing] = useState(false)

  const checkAndSync = useCallback(async () => {
    const userId = getUserId()
    setSyncing(true)
    try {
      const statusRes = await fetch(`/api/oura/sync?userId=${encodeURIComponent(userId)}`)
      const status = await statusRes.json()

      if (!status.connected) {
        setConnected(false)
        setData(null)
        return
      }

      setConnected(true)

      const syncRes = await fetch('/api/oura/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const syncData = await syncRes.json()

      if (syncData.data) {
        setData(syncData.data)
      } else if (status.data) {
        setData(status.data)
      }
    } catch (err) {
      console.error('Oura widget error:', err)
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    void checkAndSync()
  }, [checkAndSync])

  function connectOura() {
    const userId = getUserId()
    window.location.href = `/api/oura/connect?userId=${encodeURIComponent(userId)}`
  }

  const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    marginBottom: 24,
  }

  if (connected === null || syncing) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>💍</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#9B8EC4' }}>Oura Ring</span>
          <span
            style={{
              fontSize: 11,
              color: '#6B5E8C',
              marginLeft: 'auto',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          >
            syncing...
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {['Readiness', 'Sleep', 'Activity'].map((label) => (
            <div
              key={label}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)',
                }}
              />
              <span style={{ fontSize: 11, color: '#6B5E8C' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>💍</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#9B8EC4' }}>Oura Ring</span>
        </div>
        <p style={{ fontSize: 12, color: '#6B5E8C', marginBottom: 12, lineHeight: 1.5 }}>
          Connect your ring to power the Oracle with real energy data.
        </p>
        <button
          type="button"
          onClick={connectOura}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(90deg, #7B3FE4, #FF7A65)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Connect Oura Ring
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>💍</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#F0ECFF' }}>Oura Ring</span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#6EE7A4',
              marginLeft: 'auto',
            }}
            title="Connected"
          />
        </div>
        <p style={{ fontSize: 12, color: '#6B5E8C', lineHeight: 1.5 }}>
          Connected — no data yet for today. Check back after you&apos;ve worn your ring.
        </p>
      </div>
    )
  }

  const sleepHours =
    data.sleep_total_seconds != null
      ? `${Math.floor(data.sleep_total_seconds / 3600)}h ${Math.round((data.sleep_total_seconds % 3600) / 60)}m`
      : null

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>💍</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#F0ECFF' }}>Oura Ring</span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#6EE7A4',
            marginLeft: 'auto',
          }}
          title="Connected"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <ScoreRing score={data.readiness_score} label="Readiness" color="#A87EF8" />
        <ScoreRing score={data.sleep_score} label="Sleep" color="#60a5fa" />
        <ScoreRing score={data.activity_score} label="Activity" color="#6EE7A4" />
      </div>

      {(data.hrv_balance !== null || sleepHours || data.steps !== null) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {data.hrv_balance !== null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#FF7A65' }}>
                {data.hrv_balance}
              </div>
              <div style={{ fontSize: 11, color: '#6B5E8C' }}>HRV</div>
            </div>
          )}
          {sleepHours && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{sleepHours}</div>
              <div style={{ fontSize: 11, color: '#6B5E8C' }}>Duration</div>
            </div>
          )}
          {data.steps !== null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6EE7A4' }}>
                {data.steps.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#6B5E8C' }}>Steps</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
