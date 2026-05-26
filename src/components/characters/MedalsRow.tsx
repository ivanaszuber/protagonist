'use client'

import type { MedalDefinition } from '@/lib/medals'

interface MedalsRowProps {
  definitions: MedalDefinition[]
  earned: string[]
  accentColor: string
}

function MedalIcon({ icon, earned }: { icon: MedalDefinition['icon']; earned: boolean }) {
  const stroke = earned ? 'currentColor' : 'currentColor'
  const fill = earned ? 'currentColor' : 'none'
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' as const }

  switch (icon) {
    case 'sword':
      return (
        <svg {...common}>
          <path d="M4 20L14 10M14 10L11 7L17 4L20 10L17 13L14 10Z" stroke={stroke} strokeWidth="1.5" fill={fill} />
        </svg>
      )
    case 'pulse':
      return (
        <svg {...common}>
          <path d="M4 12H8L10 6L14 18L16 12H20" stroke={stroke} strokeWidth="1.5" fill={fill} />
        </svg>
      )
    case 'skull':
      return (
        <svg {...common}>
          <circle cx="12" cy="10" r="5" stroke={stroke} strokeWidth="1.5" fill={fill} />
          <path d="M8 20V16M12 20V16M16 20V16" stroke={stroke} strokeWidth="1.5" />
        </svg>
      )
    case 'flame':
      return (
        <svg {...common}>
          <path
            d="M12 3C10 8 6 10 6 14C6 17.3 8.7 20 12 20C15.3 20 18 17.3 18 14C18 10 14 8 12 3Z"
            stroke={stroke}
            strokeWidth="1.5"
            fill={fill}
          />
        </svg>
      )
    case 'star':
      return (
        <svg {...common}>
          <path
            d="M12 4L14 9H19L15 12L16.5 17L12 14L7.5 17L9 12L5 9H10L12 4Z"
            stroke={stroke}
            strokeWidth="1.5"
            fill={fill}
          />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path
            d="M12 3L5 6V12C5 16 8 19 12 21C16 19 19 16 19 12V6L12 3Z"
            stroke={stroke}
            strokeWidth="1.5"
            fill={fill}
          />
        </svg>
      )
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M8 6H16V10C16 12 14 14 12 14C10 14 8 12 8 10V6Z" stroke={stroke} strokeWidth="1.5" fill={fill} />
          <path d="M12 14V17M9 20H15" stroke={stroke} strokeWidth="1.5" />
        </svg>
      )
    default:
      return null
  }
}

export function MedalsRow({ definitions, earned, accentColor }: MedalsRowProps) {
  return (
    <section style={{ marginBottom: 24 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#9B8EC4',
          letterSpacing: '0.06em',
          display: 'block',
          marginBottom: 10,
        }}
      >
        Medals
      </span>
      <div
        className="dashboard-scroll"
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 8,
          scrollbarWidth: 'none',
        }}
      >
        {definitions.map((medal) => {
          const isEarned = earned.includes(medal.key)
          return (
            <div
              key={medal.key}
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 72,
                opacity: isEarned ? 1 : 0.3,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: `1.5px solid ${isEarned ? accentColor : '#3D3358'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isEarned ? accentColor : '#6B5E8C',
                  marginBottom: 6,
                }}
              >
                <MedalIcon icon={medal.icon} earned={isEarned} />
              </div>
              <span
                style={{
                  fontSize: 9,
                  color: isEarned ? '#E8E0F0' : '#6B5E8C',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                {isEarned ? medal.label : medal.hint}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
