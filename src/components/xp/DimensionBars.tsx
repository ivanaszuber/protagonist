'use client'

import { DimensionXPState } from '@/types'
import { DIMENSIONS } from '@/lib/dimensions'
import { getDimensionLevel, getDimensionXPPercent } from '@/lib/xp'

interface DimensionBarsProps {
  xp: DimensionXPState
  highlightDimension?: string | null
}

const DIMENSION_ORDER = [
  'vitality',
  'mind',
  'create',
  'social',
  'love',
  'family',
  'wealth',
] as const

export function DimensionBars({ xp, highlightDimension }: DimensionBarsProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '32px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          color: '#6B5E8C',
          marginBottom: '16px',
        }}
      >
        Life Force
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {DIMENSION_ORDER.map((dimId) => {
          const dim = DIMENSIONS[dimId]
          const dimXP = xp[dimId] || 0
          const level = getDimensionLevel(dimXP)
          const percent = getDimensionXPPercent(dimXP)
          const isHighlighted = highlightDimension === dimId

          return (
            <div
              key={dimId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: isHighlighted ? '8px 10px' : '0',
                borderRadius: '10px',
                background: isHighlighted ? `${dim.color}10` : 'transparent',
                border: isHighlighted
                  ? `1px solid ${dim.color}25`
                  : '1px solid transparent',
                transition: 'all 0.4s ease',
              }}
            >
              <div style={{ fontSize: '16px', flexShrink: 0 }}>{dim.emoji}</div>
              <div style={{ width: '52px', flexShrink: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: dim.color }}>
                  {dim.name}
                </div>
                <div style={{ fontSize: '10px', color: '#6B5E8C' }}>LVL {level}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${percent}%`,
                      borderRadius: '3px',
                      background: `linear-gradient(90deg, ${dim.color}CC, ${dim.color})`,
                      boxShadow: isHighlighted ? `0 0 8px ${dim.color}80` : 'none',
                      transition: 'width 0.6s ease, box-shadow 0.4s ease',
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#6B5E8C',
                  width: '52px',
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                {dimXP} XP
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
