'use client'

import { Quest } from '@/types'
import { DIMENSIONS } from '@/lib/dimensions'

interface QuestCardProps {
  quest: Quest
  isCompleted?: boolean
  onComplete: (quest: Quest) => void
}

export function QuestCard({ quest, isCompleted = false, onComplete }: QuestCardProps) {
  const dimension = DIMENSIONS[quest.dimensionId]

  return (
    <div
      style={{
        background: isCompleted ? 'rgba(110,231,164,0.04)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isCompleted ? 'rgba(110,231,164,0.25)' : `${dimension.color}30`}`,
        borderRadius: '16px',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        opacity: isCompleted ? 0.75 : 1,
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: isCompleted
            ? 'linear-gradient(90deg, #6EE7A4, #00D4B8)'
            : `linear-gradient(90deg, ${dimension.color}CC, ${dimension.color}40)`,
        }}
      />

      {isCompleted && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(110,231,164,0.15)',
            border: '1px solid rgba(110,231,164,0.3)',
            borderRadius: '100px',
            padding: '3px 10px',
            fontSize: '10px',
            fontWeight: 700,
            color: '#6EE7A4',
            letterSpacing: '0.5px',
          }}
        >
          ✦ COMPLETE
        </div>
      )}

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: `${dimension.color}15`,
          border: `1px solid ${dimension.color}30`,
          borderRadius: '100px',
          padding: '4px 12px',
          fontSize: '11px',
          fontWeight: 700,
          color: dimension.color,
          marginBottom: '14px',
        }}
      >
        {dimension.emoji} {dimension.name}
        <span style={{ color: '#6B5E8C', fontWeight: 400 }}>· {quest.championName}</span>
      </div>

      <div
        style={{
          fontSize: '17px',
          fontWeight: 700,
          color: '#F0ECFF',
          marginBottom: '8px',
          lineHeight: 1.25,
          textDecoration: isCompleted ? 'line-through' : 'none',
          textDecorationColor: 'rgba(255,255,255,0.2)',
        }}
      >
        {quest.title}
      </div>

      <div
        style={{
          fontSize: '14px',
          color: '#9B8EC4',
          lineHeight: 1.65,
          marginBottom: '20px',
        }}
      >
        {quest.description}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: dimension.color,
          }}
        >
          +{quest.xpReward} XP
        </div>

        {!isCompleted && (
          <button
            type="button"
            onClick={() => onComplete(quest)}
            style={{
              background: dimension.color,
              color: 'white',
              border: 'none',
              borderRadius: '100px',
              padding: '10px 22px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: `0 4px 16px ${dimension.color}40`,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = `0 8px 24px ${dimension.color}50`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = `0 4px 16px ${dimension.color}40`
            }}
          >
            Complete Quest →
          </button>
        )}
      </div>
    </div>
  )
}
