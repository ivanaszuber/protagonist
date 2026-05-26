'use client'

import type { BossKillRow } from '@/lib/bosses'

interface HallOfKillsProps {
  kills: BossKillRow[]
  stats: { slain: number; escaped: number }
}

function formatMonth(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export function HallOfKills({ kills, stats }: HallOfKillsProps) {
  return (
    <section style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#9B8EC4', letterSpacing: '0.06em' }}>
          Hall of Victories
        </span>
        {kills.length > 0 && (
          <span style={{ fontSize: 10, color: '#6B5E8C' }}>
            {stats.slain} conquered · {stats.escaped} abandoned
          </span>
        )}
      </div>

      {kills.length === 0 && (
        <p style={{ fontSize: 11, color: '#3D3358', margin: 0 }}>
          Complete your first challenge to begin your Hall of Victories.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {kills.map((kill) => {
          const slain = kill.outcome === 'slain'
          return (
            <div
              key={kill.id}
              style={{
                padding: '10px 12px',
                background: '#140C28',
                borderRadius: 10,
                border: '0.5px solid #1E1040',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12 }}>{slain ? '★' : '○'}</span>
                <span
                  style={{
                    fontSize: 12,
                    color: slain ? '#9B8EC4' : '#6B5E8C',
                    flex: 1,
                  }}
                >
                  {kill.boss_name}
                </span>
                <span style={{ fontSize: 10, color: '#6B5E8C' }}>
                  {slain ? 'Conquered' : 'Abandoned'}
                  {slain && kill.days_taken != null ? ` · ${kill.days_taken}d` : ''}
                  {' · '}
                  {formatMonth(kill.killed_at)}
                </span>
              </div>
              {kill.quest_name && (
                <p style={{ fontSize: 10, color: '#3D3358', margin: '4px 0 0 22px' }}>
                  {kill.quest_name}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
