'use client'

import { useCallback, useEffect, useState } from 'react'
import { VaultCharacterLarge } from '@/components/characters/CharacterHeroArt'
import { coinFillColor, formatGbp } from '@/lib/vault'

interface VaultApiResponse {
  settings: {
    invested: number
    cash: number
    nw_goal: number
    fire_number: number
    fire_target_year: number
    shadow_gap: number
    shadow_interest_rate: number
    monthly_income: number
    budget_categories: { budget: number }[]
  }
  totalNetWorth: number
  monthlySurplus: number
  shadow5yr: number
  fireProgressPct: number
  coinsFilled: number
  coinsPartialPct: number
  coinsToGoal: number
  goalCoinIndex: number
}

interface VaultNetWorthCardProps {
  userId: string
  accentColor: string
}

function CoinSlot({
  index,
  coinsFilled,
  coinsPartialPct,
  goalCoinIndex,
}: {
  index: number
  coinsFilled: number
  coinsPartialPct: number
  goalCoinIndex: number
}) {
  const isFilled = index <= coinsFilled
  const isPartial = index === coinsFilled + 1
  const isGoalMarker = index === goalCoinIndex
  const isGoalGap = index > coinsFilled + 1 && index < goalCoinIndex

  if (isGoalMarker) {
    return (
      <div
        style={{
          width: 28,
          height: 7,
          borderRadius: 3,
          border: '1px dashed rgba(147,51,234,0.5)',
          background: 'rgba(147,51,234,0.08)',
        }}
      />
    )
  }

  if (isPartial) {
    return (
      <div
        style={{
          width: 28,
          height: 7,
          borderRadius: 3,
          background: '#0A0718',
          border: '0.5px solid rgba(29,158,117,0.5)',
          position: 'relative',
          overflow: 'hidden',
          animation: 'vault-pulse-glow 2s ease-in-out infinite',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${coinsPartialPct}%`,
            background: '#1D9E75',
            borderRadius: 3,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
            animation: 'vault-shimmer 2.5s infinite',
          }}
        />
      </div>
    )
  }

  if (isGoalGap) {
    return (
      <div
        style={{
          width: 28,
          height: 7,
          borderRadius: 3,
          border: '1px dashed rgba(61,32,112,0.6)',
          background: 'rgba(61,32,112,0.06)',
        }}
      />
    )
  }

  if (isFilled) {
    const isTop = index === coinsFilled
    return (
      <div
        style={{
          width: 28,
          height: 7,
          borderRadius: 3,
          background: coinFillColor(index),
          position: 'relative',
          animation: `vault-coin-drop 0.35s ease-out ${index * 50}ms both`,
        }}
      >
        {isTop && (
          <div
            style={{
              position: 'absolute',
              top: 1,
              left: 4,
              right: 4,
              height: 2,
              borderRadius: 1,
              background: 'rgba(255,255,255,0.18)',
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        width: 28,
        height: 7,
        borderRadius: 3,
        background: 'rgba(61,32,112,0.04)',
        border: '0.5px solid rgba(61,32,112,0.15)',
      }}
    />
  )
}

export function VaultNetWorthCard({ userId, accentColor }: VaultNetWorthCardProps) {
  const [data, setData] = useState<VaultApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [shadowExpanded, setShadowExpanded] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)
  const [slipAmount, setSlipAmount] = useState('')
  const [slipSad, setSlipSad] = useState(false)
  const [slipSaving, setSlipSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/vault/settings?userId=${encodeURIComponent(userId)}`)
      const json = (await res.json()) as VaultApiResponse
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    function onVaultUpdated() {
      void load()
    }
    window.addEventListener('protagonist:vault-updated', onVaultUpdated)
    return () => window.removeEventListener('protagonist:vault-updated', onVaultUpdated)
  }, [load])

  async function handleSlipConfirm() {
    const amount = parseFloat(slipAmount)
    if (!data || !Number.isFinite(amount) || amount <= 0) return
    setSlipSaving(true)
    try {
      await fetch('/api/vault/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          patch: { shadow_gap: data.settings.shadow_gap + amount },
        }),
      })
      setSlipOpen(false)
      setSlipAmount('')
      setSlipSad(true)
      setTimeout(() => setSlipSad(false), 2000)
      void load()
    } finally {
      setSlipSaving(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          background: '#140C28',
          borderRadius: 14,
          border: '0.5px solid #2D1B55',
          padding: 16,
          marginBottom: 8,
          fontSize: 11,
          color: '#5A4A7A',
        }}
      >
        Loading vault...
      </div>
    )
  }

  if (!data) return null

  const { settings } = data
  const toGo = Math.max(0, settings.nw_goal - data.totalNetWorth)
  const goalPct = settings.nw_goal > 0 ? Math.min(100, (data.totalNetWorth / settings.nw_goal) * 100) : 0
  const shadowGap = settings.shadow_gap
  const behind = shadowGap > 0
  const ahead = shadowGap < 0
  const budgetTotal = settings.budget_categories.reduce((s, c) => s + c.budget, 0)
  const actualSurplus = data.monthlySurplus

  const leftCoins = Array.from({ length: 10 }, (_, i) => i + 1)
  const rightCoins = Array.from({ length: 10 }, (_, i) => i + 11)

  return (
    <div
      style={{
        background: '#140C28',
        borderRadius: 14,
        border: '0.5px solid #2D1B55',
        padding: '14px 14px 14px 17px',
        marginBottom: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: accentColor,
        }}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              fontSize: 7,
              color: '#4A2878',
              textAlign: 'center',
              marginBottom: 4,
            }}
          >
            £{Math.round(settings.nw_goal / 1000)}k goal
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 2 }}>
              {leftCoins.map((i) => (
                <CoinSlot
                  key={i}
                  index={i}
                  coinsFilled={data.coinsFilled}
                  coinsPartialPct={data.coinsPartialPct}
                  goalCoinIndex={data.goalCoinIndex}
                />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 2 }}>
              {rightCoins.map((i) => (
                <CoinSlot
                  key={i}
                  index={i}
                  coinsFilled={data.coinsFilled}
                  coinsPartialPct={data.coinsPartialPct}
                  goalCoinIndex={data.goalCoinIndex}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              animation: 'vault-float-coin 3s ease-in-out infinite',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
              <circle cx="16" cy="16" r="14" fill="#EF9F27" opacity="0.12" />
              <circle cx="16" cy="16" r="11" stroke="#BA7517" strokeWidth="1" fill="none" opacity="0.4" />
              <text x="16" y="20" textAnchor="middle" fill="#BA7517" fontSize="13" opacity="0.7">
                £
              </text>
            </svg>
          </div>

          <div
            style={{
              fontSize: 10,
              color: '#4A3870',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            Net worth
          </div>
          <div style={{ fontSize: 34, fontWeight: 500, color: '#E8E0F0', lineHeight: 1.1 }}>
            {formatGbp(data.totalNetWorth)}
          </div>
          <div style={{ fontSize: 10, color: '#2D5A44', marginTop: 4, marginBottom: 8 }}>
            {formatGbp(toGo, true)} to go
          </div>
          <div
            style={{
              height: 4,
              background: '#0A1F17',
              borderRadius: 2,
              overflow: 'hidden',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${goalPct}%`,
                background: accentColor,
                borderRadius: 2,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div
              style={{
                flex: 1,
                background: '#0A1F17',
                borderRadius: 8,
                padding: '6px 8px',
              }}
            >
              <div style={{ fontSize: 9, color: '#2D5A44' }}>Invested</div>
              <div style={{ fontSize: 12, color: accentColor }}>{formatGbp(settings.invested, true)}</div>
            </div>
            <div
              style={{
                flex: 1,
                background: '#100820',
                borderRadius: 8,
                padding: '6px 8px',
              }}
            >
              <div style={{ fontSize: 9, color: '#4A2878' }}>Cash</div>
              <div style={{ fontSize: 12, color: '#A87EF8' }}>{formatGbp(settings.cash, true)}</div>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: '#2D5A44' }}>
                FIRE {settings.fire_target_year}
              </span>
              <span style={{ fontSize: 9, color: '#2D5A44' }}>
                {data.fireProgressPct.toFixed(1)}%
              </span>
            </div>
            <div
              style={{
                height: 2,
                background: '#0A1F17',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, data.fireProgressPct)}%`,
                  background: '#2D5A44',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '0.5px solid #1E0D40', paddingTop: 10 }}>
        <button
          type="button"
          onClick={() => setShadowExpanded((v) => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: 20,
            border: behind
              ? '0.5px solid rgba(186,117,23,0.35)'
              : ahead
                ? '0.5px solid rgba(29,158,117,0.3)'
                : '0.5px solid rgba(29,158,117,0.2)',
            background: behind
              ? 'rgba(186,117,23,0.12)'
              : ahead
                ? 'rgba(29,158,117,0.10)'
                : 'rgba(29,158,117,0.06)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 10, flex: 1, textAlign: 'left' }}>
            {behind ? (
              <>
                <span style={{ color: '#BA7517' }}>⚠ Behind shadow </span>
                <span style={{ color: '#EF9F27' }}>−{formatGbp(Math.abs(shadowGap))}</span>
                <span style={{ color: '#7A5520' }}>
                  {' '}
                  → −{formatGbp(Math.abs(data.shadow5yr))} in 5yr
                </span>
              </>
            ) : ahead ? (
              <>
                <span style={{ color: '#1D9E75' }}>✓ Ahead of shadow </span>
                <span style={{ color: '#1D9E75' }}>+{formatGbp(Math.abs(shadowGap))}</span>
                <span style={{ color: '#2D5A44' }}>
                  {' '}
                  → +{formatGbp(Math.abs(data.shadow5yr))} in 5yr
                </span>
              </>
            ) : (
              <span style={{ color: '#2D5A44' }}>On track with shadow</span>
            )}
          </span>
          <span style={{ color: '#4A2878', fontSize: 10 }}>{shadowExpanded ? '▴' : '▾'}</span>
        </button>

        <div
          style={{
            maxHeight: shadowExpanded ? 320 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.3s ease',
          }}
        >
          <p style={{ fontSize: 11, color: '#6B5E8C', margin: '10px 0 8px', lineHeight: 1.5 }}>
            Shadow tracks whether your net worth grew as much as your budget surplus suggests it
            should.
          </p>
          <div
            style={{
              background: '#100818',
              border: '0.5px solid #1E0D40',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 11,
              color: '#9B8EC4',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Budget surplus (monthly)</span>
              <span style={{ color: '#C0B0E0' }}>{formatGbp(actualSurplus)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Total budget</span>
              <span>{formatGbp(budgetTotal)}</span>
            </div>
            <div style={{ height: '0.5px', background: '#1E0D40', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Gap now</span>
              <span style={{ color: behind ? '#ef4444' : ahead ? '#1D9E75' : '#C0B0E0' }}>
                {behind ? '−' : ahead ? '+' : ''}
                {formatGbp(Math.abs(shadowGap))}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>In 5yr at {settings.shadow_interest_rate}%</span>
              <span style={{ color: behind ? '#ef4444' : ahead ? '#1D9E75' : '#C0B0E0' }}>
                {behind ? '−' : ahead ? '+' : ''}
                {formatGbp(Math.abs(data.shadow5yr))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {slipOpen ? (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <input
              type="number"
              placeholder="Amount £"
              value={slipAmount}
              onChange={(e) => setSlipAmount(e.target.value)}
              style={{
                flex: 1,
                background: '#0D0820',
                border: '0.5px solid #3D2070',
                borderRadius: 8,
                padding: '8px 10px',
                color: '#E8E0F0',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onClick={() => void handleSlipConfirm()}
              disabled={slipSaving}
              style={{
                padding: '8px 12px',
                background: '#7F1D1D',
                border: '0.5px solid #ef4444',
                borderRadius: 8,
                color: '#fca5a5',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Log slip
            </button>
            <button
              type="button"
              onClick={() => setSlipOpen(false)}
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                color: '#5A4A7A',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setSlipOpen((v) => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 12,
            border: slipSad
              ? '0.5px solid rgba(224,82,82,0.4)'
              : '0.5px solid rgba(29,158,117,0.35)',
            background: slipSad ? 'rgba(90,20,20,0.2)' : 'rgba(10,31,23,0.5)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              transform: slipSad ? 'scale(0.9)' : 'scale(1)',
              opacity: slipSad ? 0.85 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {slipSad ? (
              <svg width="36" height="40" viewBox="0 0 36 40" aria-hidden>
                <ellipse cx="18" cy="22" rx="14" ry="16" fill="#0F6E56" />
                <circle cx="13" cy="18" r="2" fill="white" opacity="0.15" />
                <circle cx="23" cy="18" r="2" fill="white" opacity="0.15" />
                <path d="M13 32 Q18 29 24 32" stroke="#012A1E" strokeWidth="1.5" fill="none" />
              </svg>
            ) : (
              <div style={{ transform: 'scale(0.45)', transformOrigin: 'top left' }}>
                <VaultCharacterLarge />
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: slipSad ? '#fca5a5' : '#2D5A44' }}>
            {slipSad ? 'Noted — shadow updated' : 'I slipped'}
          </span>
        </button>
      </div>
    </div>
  )
}
