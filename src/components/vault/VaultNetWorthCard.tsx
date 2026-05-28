'use client'

import { useCallback, useEffect, useState } from 'react'
import { VaultCharacterLarge } from '@/components/characters/CharacterHeroArt'
import { coinFillColor, formatGbp } from '@/lib/vault'

const SLIP_CATEGORIES = [
  { key: 'shopping',    emoji: '🛍',  label: 'Shopping'    },
  { key: 'restaurants', emoji: '🍽',  label: 'Restaurants' },
  { key: 'going_out',   emoji: '🎉',  label: 'Going out'   },
  { key: 'beauty',      emoji: '💄',  label: 'Beauty'      },
  { key: 'other',       emoji: '❓',  label: 'Other'       },
]

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
    last_slip_at: string | null
    last_slip_amount: number | null
    last_slip_category: string | null
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
  accentColor,
}: {
  index: number
  coinsFilled: number
  coinsPartialPct: number
  goalCoinIndex: number
  accentColor: string
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
          border: '1px dashed rgba(255,212,122,0.55)',
          background: 'rgba(255,212,122,0.07)',
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
          background: '#040F18',
          border: `0.5px solid ${accentColor}55`,
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
            background: accentColor,
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
          border: '1px dashed rgba(77,196,255,0.18)',
          background: 'rgba(77,196,255,0.04)',
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
        background: 'rgba(77,196,255,0.04)',
        border: '0.5px solid rgba(77,196,255,0.12)',
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
  const [slipCat, setSlipCat] = useState('shopping')
  const [slipNote, setSlipNote] = useState('')
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
          patch: {
            shadow_gap: data.settings.shadow_gap + amount,
            last_slip_at: new Date().toISOString(),
            last_slip_amount: amount,
            last_slip_category: slipCat,
            last_slip_note: slipNote || null,
          },
        }),
      })
      // Silently create personalised recovery task
      void fetch('/api/oracle/create-slip-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, category: slipCat, amount }),
      })
      setSlipOpen(false)
      setSlipAmount('')
      setSlipNote('')
      void load()
    } finally {
      setSlipSaving(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          background: '#070E18',
          borderRadius: 14,
          border: '0.5px solid #0D2030',
          padding: 16,
          marginBottom: 8,
          fontSize: 11,
          color: 'rgba(77,196,255,0.3)',
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
        background: '#070E18',
        borderRadius: 14,
        border: '0.5px solid #0D2030',
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
              color: 'rgba(77,196,255,0.35)',
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
                  accentColor={accentColor}
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
                  accentColor={accentColor}
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
              color: 'rgba(77,196,255,0.45)',
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
          <div style={{ fontSize: 10, color: 'rgba(77,196,255,0.5)', marginTop: 4, marginBottom: 8 }}>
            {formatGbp(toGo, true)} to go
          </div>
          <div
            style={{
              height: 4,
              background: 'rgba(77,196,255,0.08)',
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
                background: 'rgba(77,196,255,0.07)',
                border: '0.5px solid rgba(77,196,255,0.15)',
                borderRadius: 8,
                padding: '6px 8px',
              }}
            >
              <div style={{ fontSize: 9, color: 'rgba(77,196,255,0.45)' }}>Invested</div>
              <div style={{ fontSize: 12, color: accentColor }}>{formatGbp(settings.invested, true)}</div>
            </div>
            <div
              style={{
                flex: 1,
                background: 'rgba(168,126,248,0.07)',
                border: '0.5px solid rgba(168,126,248,0.15)',
                borderRadius: 8,
                padding: '6px 8px',
              }}
            >
              <div style={{ fontSize: 9, color: 'rgba(168,126,248,0.45)' }}>Cash</div>
              <div style={{ fontSize: 12, color: '#A87EF8' }}>{formatGbp(settings.cash, true)}</div>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,212,122,0.7)' }}>
                FIRE {settings.fire_target_year}
              </span>
              <span style={{ fontSize: 9, color: 'rgba(255,212,122,0.7)' }}>
                {data.fireProgressPct.toFixed(1)}%
              </span>
            </div>
            <div
              style={{
                height: 2,
                background: 'rgba(255,212,122,0.1)',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, data.fireProgressPct)}%`,
                  background: '#FFD47A',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '0.5px solid rgba(77,196,255,0.08)', paddingTop: 10 }}>
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
                ? `0.5px solid ${accentColor}40`
                : `0.5px solid ${accentColor}25`,
            background: behind
              ? 'rgba(186,117,23,0.12)'
              : ahead
                ? 'rgba(77,196,255,0.06)'
                : 'rgba(77,196,255,0.03)',
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
                <span style={{ color: accentColor }}>✓ Ahead of shadow </span>
                <span style={{ color: accentColor }}>+{formatGbp(Math.abs(shadowGap))}</span>
                <span style={{ color: 'rgba(77,196,255,0.45)' }}>
                  {' '}
                  → +{formatGbp(Math.abs(data.shadow5yr))} in 5yr
                </span>
              </>
            ) : (
              <span style={{ color: 'rgba(77,196,255,0.4)' }}>On track with shadow</span>
            )}
          </span>
          <span style={{ color: 'rgba(77,196,255,0.35)', fontSize: 10 }}>{shadowExpanded ? '▴' : '▾'}</span>
        </button>

        <div
          style={{
            maxHeight: shadowExpanded ? 320 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.3s ease',
          }}
        >
          <p style={{ fontSize: 11, color: 'rgba(77,196,255,0.4)', margin: '10px 0 8px', lineHeight: 1.5 }}>
            Shadow tracks whether your net worth grew as much as your budget surplus suggests it
            should.
          </p>
          <div
            style={{
              background: '#040E18',
              border: '0.5px solid rgba(77,196,255,0.1)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 11,
              color: 'rgba(77,196,255,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Budget surplus (monthly)</span>
              <span style={{ color: 'rgba(77,196,255,0.75)' }}>{formatGbp(actualSurplus)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Total budget</span>
              <span>{formatGbp(budgetTotal)}</span>
            </div>
            <div style={{ height: '0.5px', background: 'rgba(77,196,255,0.08)', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>Gap now</span>
              <span style={{ color: behind ? '#ef4444' : ahead ? accentColor : 'rgba(77,196,255,0.75)' }}>
                {behind ? '−' : ahead ? '+' : ''}
                {formatGbp(Math.abs(shadowGap))}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>In 5yr at {settings.shadow_interest_rate}%</span>
              <span style={{ color: behind ? '#ef4444' : ahead ? accentColor : 'rgba(77,196,255,0.75)' }}>
                {behind ? '−' : ahead ? '+' : ''}
                {formatGbp(Math.abs(data.shadow5yr))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* "I slipped" trigger button — small, red, bottom-right */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button
          type="button"
          onClick={() => setSlipOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: '#2A0808',
            border: '0.5px solid #8B2020',
            borderRadius: 20,
            padding: '5px 12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 3C10 8 6 10 6 14C6 17.3 8.7 20 12 20C15.3 20 18 17.3 18 14C18 10 14 8 12 3Z"
              stroke="#E05050"
              strokeWidth="1.5"
            />
          </svg>
          <span style={{ fontSize: 11, color: '#E05050', fontWeight: 500 }}>I slipped</span>
        </button>
      </div>

      {/* Inline confession form — slides down */}
      <div
        style={{
          maxHeight: slipOpen ? 480 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s ease',
        }}
      >
        <div style={{ marginTop: 14, borderTop: '0.5px solid rgba(77,196,255,0.08)', paddingTop: 14 }}>
          {/* Sad animated robot + message */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                flexShrink: 0,
                position: 'relative',
                width: 64,
                height: 80,
                animation: 'vault-slip-wobble 1.4s ease-in-out infinite',
                transformOrigin: 'bottom center',
              }}
            >
              {/* Sad vault robot — CYAN, sad brows (inner corners UP) */}
              <svg width="64" height="80" viewBox="0 0 42 56" fill="none" aria-hidden>
                <circle cx="18" cy="7" r="5.5" fill="#FAC775" opacity="0.85" />
                <circle cx="18" cy="7" r="3.5" fill="#EF9F27" />
                <path d="M17.5 4.5V9.5M15.5 7H21" stroke="#FAC775" strokeWidth="1.2" strokeLinecap="round" />
                <rect x="3" y="12" width="30" height="24" rx="9" fill="#0D5C78" />
                <circle cx="13" cy="24" r="6" fill="#021420" />
                <circle cx="26" cy="24" r="6" fill="#021420" />
                {/* pupils down-center — sad look */}
                <circle cx="13" cy="25" r="2.5" fill="white" opacity="0.55" />
                <circle cx="26" cy="25" r="2.5" fill="white" opacity="0.55" />
                {/* sad brows: inner corners UP, outer corners DOWN */}
                <path d="M8 22L13 20" stroke="rgba(77,196,255,0.6)" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M23 20L28 22" stroke="rgba(77,196,255,0.6)" strokeWidth="1.2" strokeLinecap="round" />
                {/* frown */}
                <path d="M10 33Q18 30 26 33" stroke="#021420" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <rect x="7" y="38" width="22" height="16" rx="5" fill="#073D52" />
                <path d="M11 51L16 47L20 49L26 44" stroke="#1A9EC7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.75" />
              </svg>
              {/* Animated tears */}
              <div
                style={{
                  position: 'absolute',
                  left: 17,
                  top: 46,
                  width: 4,
                  height: 8,
                  background: 'rgba(77,196,255,0.5)',
                  borderRadius: '0 0 4px 4px',
                  animation: 'vault-tear-fall 1.1s ease-in infinite',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 37,
                  top: 46,
                  width: 4,
                  height: 8,
                  background: 'rgba(77,196,255,0.5)',
                  borderRadius: '0 0 4px 4px',
                  animation: 'vault-tear-fall 1.1s ease-in 0.45s infinite',
                }}
              />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#E8824A', margin: '0 0 4px' }}>
                Vault is hurt 🥺
              </p>
              <p style={{ fontSize: 11, color: '#7A6A8A', lineHeight: 1.55, margin: 0 }}>
                Shadow gap widened.<br />
                Auto-recovers tomorrow.
              </p>
            </div>
          </div>

          {/* What did you spend on */}
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'rgba(77,196,255,0.4)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: '0 0 8px',
            }}
          >
            What did you spend on?
          </p>

          {/* Category chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {SLIP_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSlipCat(cat.key)}
                style={{
                  background: slipCat === cat.key ? '#1E1A34' : '#12101E',
                  border: `0.5px solid ${slipCat === cat.key ? '#5A40A0' : '#2A2040'}`,
                  borderRadius: 18,
                  padding: '5px 11px',
                  fontSize: 11,
                  color: slipCat === cat.key ? '#C8B8F0' : '#8A7AAA',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* Amount — underline style */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'rgba(77,196,255,0.4)', marginBottom: 4, letterSpacing: '0.04em' }}>
              Amount
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderBottom: '0.5px solid rgba(77,196,255,0.15)',
                paddingBottom: 6,
              }}
            >
              <span style={{ fontSize: 12, color: 'rgba(77,196,255,0.4)' }}>£</span>
              <input
                type="number"
                placeholder="0"
                value={slipAmount}
                onChange={(e) => setSlipAmount(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#E8E0F0',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* Note — underline style */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'rgba(77,196,255,0.4)', marginBottom: 4, letterSpacing: '0.04em' }}>
              Note (optional)
            </div>
            <div style={{ borderBottom: '0.5px solid rgba(77,196,255,0.08)', paddingBottom: 6 }}>
              <input
                type="text"
                placeholder="What was it?"
                value={slipNote}
                onChange={(e) => setSlipNote(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 11,
                  color: '#9B8EC4',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={() => void handleSlipConfirm()}
            disabled={slipSaving || !slipAmount}
            style={{
              width: '100%',
              background: '#2A0E0E',
              border: '0.5px solid #7A2020',
              borderRadius: 10,
              padding: 10,
              fontSize: 12,
              fontWeight: 500,
              color: '#E05050',
              cursor: slipSaving || !slipAmount ? 'default' : 'pointer',
              opacity: slipSaving || !slipAmount ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {slipSaving ? 'Logging...' : 'I know, I know... log it'}
          </button>
        </div>
      </div>
    </div>
  )
}
