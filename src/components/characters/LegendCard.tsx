'use client'

import { openOracle } from '@/lib/oracle-events'

interface LegendCardProps {
  characterName: string
  dimensionLabel: string
  dimension: string
  vision: string | null
  accentColor: string
}

export function LegendCard({
  characterName,
  dimensionLabel,
  dimension,
  vision,
  accentColor,
}: LegendCardProps) {
  const hasQuest = Boolean(vision?.trim())

  function handleDefine() {
    openOracle(undefined, `legend:${dimension}`)
  }

  function handleEdit() {
    openOracle(undefined, `legend-edit:${dimension}`)
  }

  return (
    <div
      style={{
        background: '#140C1A',
        border: `0.5px solid ${accentColor}`,
        borderRadius: 12,
        padding: '14px 14px 14px 14px',
        marginBottom: 16,
        position: 'relative',
      }}
    >
      {hasQuest && (
        <button
          type="button"
          onClick={handleEdit}
          aria-label="Edit quest"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: '#7A5FA0',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          marginBottom: 8,
        }}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
          <path
            d="M5 1L6.2 3.8H9.2L6.8 5.6L7.8 8.5L5 6.8L2.2 8.5L3.2 5.6L0.8 3.8H3.8L5 1Z"
            fill={accentColor}
          />
        </svg>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: accentColor,
          }}
        >
          {hasQuest ? 'The Quest' : 'No Quest yet'}
        </span>
      </div>

      {hasQuest ? (
        <>
          <p
            style={{
              fontSize: 13,
              fontStyle: 'italic',
              color: '#F0E8D0',
              lineHeight: 1.5,
              margin: '0 0 6px',
              paddingRight: 24,
            }}
          >
            &ldquo;{vision}&rdquo;
          </p>
          <p style={{ fontSize: 10, color: '#7A5A2A', margin: 0 }}>
            Your defining quest. Everything else serves this.
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 11, color: '#7A5FA0', margin: '0 0 10px', lineHeight: 1.5 }}>
            Oracle will help you define your long-term quest for {dimensionLabel}.
          </p>
          <button
            type="button"
            onClick={handleDefine}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#1E0D40',
              border: `0.5px solid ${accentColor}`,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 11,
              color: accentColor,
              cursor: 'pointer',
            }}
          >
            <span>🔮</span>
            Define your Quest with Oracle ↗
          </button>
        </>
      )}
    </div>
  )
}
