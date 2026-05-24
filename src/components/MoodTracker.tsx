'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface MoodEntry {
  mood_score: number
  mood_label: string
  created_at: string
}

interface MoodTrackerProps {
  userId: string
  onMoodChange?: (score: number) => void
}

const MOODS = [
  { score: 1, label: 'Depleted', color: '#ef4444' },
  { score: 2, label: 'Drained', color: '#fb923c' },
  { score: 3, label: 'Steady', color: '#60a5fa' },
  { score: 4, label: 'Charged', color: '#34d399' },
  { score: 5, label: 'Transcendent', color: '#a855f7' },
] as const

export default function MoodTracker({ userId, onMoodChange }: MoodTrackerProps) {
  const [currentMood, setCurrentMood] = useState<MoodEntry | null>(null)
  const [hoveredScore, setHoveredScore] = useState<number | null>(null)
  const [logging, setLogging] = useState(false)

  useEffect(() => {
    fetch(`/api/mood?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => setCurrentMood(d.mood ?? null))
      .catch(() => {})
  }, [userId])

  async function logMood(score: number) {
    if (logging) return
    setLogging(true)
    try {
      const res = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood_score: score, userId }),
      })
      const data = await res.json()
      if (res.ok) {
        setCurrentMood(data.mood)
        onMoodChange?.(score)
      }
    } finally {
      setLogging(false)
    }
  }

  const displayScore = hoveredScore ?? currentMood?.mood_score ?? null
  const displayMood = MOODS.find((m) => m.score === displayScore)

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', marginBottom: 10 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            color: displayMood ? displayMood.color : '#5A5070',
            minWidth: 80,
            transition: 'color 0.2s',
          }}
        >
          {displayMood ? displayMood.label : 'How are you?'}
        </span>

        <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'center' }}>
          {MOODS.map((mood) => {
            const isActive = currentMood?.mood_score === mood.score
            const isHovered = hoveredScore === mood.score
            return (
              <motion.button
                key={mood.score}
                type="button"
                onClick={() => void logMood(mood.score)}
                onMouseEnter={() => setHoveredScore(mood.score)}
                onMouseLeave={() => setHoveredScore(null)}
                onTouchStart={() => setHoveredScore(mood.score)}
                onTouchEnd={() => setHoveredScore(null)}
                whileTap={{ scale: 0.85 }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: `1.5px solid ${mood.color}`,
                  background: isActive || isHovered ? mood.color : `${mood.color}22`,
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.15s, transform 0.1s',
                  position: 'relative',
                }}
                aria-label={mood.label}
              >
                {isActive && (
                  <motion.div
                    layoutId="mood-indicator"
                    style={{
                      position: 'absolute',
                      inset: -3,
                      borderRadius: '50%',
                      border: `1px solid ${mood.color}`,
                      opacity: 0.4,
                    }}
                  />
                )}
              </motion.button>
            )
          })}
        </div>

        {currentMood && (
          <span style={{ fontSize: 10, color: '#3D3358', minWidth: 30, textAlign: 'right' }}>
            {new Date(currentMood.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    </div>
  )
}
