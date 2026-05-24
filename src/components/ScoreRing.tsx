'use client'

import { useEffect, useState } from 'react'

interface ScoreRingProps {
  value: number
  color: string
  label: string
  size?: number
}

const RADIUS = 25
const CIRC = 2 * Math.PI * RADIUS

export default function ScoreRing({ value, color, label, size = 66 }: ScoreRingProps) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setDisplayed(value ?? 0), 100)
    return () => clearTimeout(timer)
  }, [value])

  const offset = CIRC * (1 - Math.min(displayed, 100) / 100)

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 66 66">
        <circle
          cx="33"
          cy="33"
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="6"
        />
        <circle
          cx="33"
          cy="33"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 33 33)"
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)' }}
        />
        <text
          x="33"
          y="38"
          textAnchor="middle"
          style={{ fontSize: 14, fontWeight: 500, fill: '#E8E0F0' }}
        >
          {displayed > 0 ? displayed : '—'}
        </text>
      </svg>
      <div style={{ fontSize: 11, color: '#5A5070', marginTop: 4 }}>{label}</div>
    </div>
  )
}
