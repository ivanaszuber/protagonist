export interface XpToast {
  amount: number
  dimension: string
}

export interface LevelUpToast {
  level: number
  dimension: string
}

const DIM_COLORS: Record<string, string> = {
  career: '#EF9F27',
  social: '#F0997B',
  wealth: '#1D9E75',
}

const DIM_LABELS: Record<string, string> = {
  career: 'Forge',
  social: 'Echo',
  wealth: 'Vault',
}

export function XpToastOverlay({
  xpToast,
  levelUpToast,
}: {
  xpToast: XpToast | null
  levelUpToast: LevelUpToast | null
}) {
  const dimColor = levelUpToast
    ? (DIM_COLORS[levelUpToast.dimension] ?? '#9333EA')
    : '#9333EA'
  const dimLabel = levelUpToast
    ? (DIM_LABELS[levelUpToast.dimension] ?? 'Champion')
    : ''

  return (
    <>
      {xpToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 110,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(52,211,153,0.12)',
            border: '1px solid rgba(52,211,153,0.35)',
            borderRadius: 100,
            padding: '8px 20px',
            fontSize: 14,
            fontWeight: 600,
            color: '#34d399',
            zIndex: 60,
            pointerEvents: 'none',
            animation: 'xp-float 2.5s ease-out forwards',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ✦ +{xpToast.amount} XP
        </div>
      )}

      {levelUpToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 110,
            left: '50%',
            transform: 'translateX(-50%)',
            background: `${dimColor}18`,
            border: `1px solid ${dimColor}55`,
            borderRadius: 14,
            padding: '12px 20px',
            fontSize: 13,
            color: dimColor,
            zIndex: 60,
            pointerEvents: 'none',
            animation: 'xp-float 3s ease-out forwards',
            textAlign: 'center',
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: 18, marginBottom: 4 }}>⬆</div>
          <div style={{ fontWeight: 600 }}>
            {dimLabel} Level {levelUpToast.level}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Level up!</div>
        </div>
      )}
    </>
  )
}

export function showXpFeedback(
  task: { dimension: string },
  data: { xp_earned?: number; leveled_up?: boolean; new_level?: number },
  setXpToast: (t: XpToast | null) => void,
  setLevelUpToast: (t: LevelUpToast | null) => void
) {
  if (data.xp_earned) {
    setXpToast({ amount: data.xp_earned, dimension: task.dimension })
    setTimeout(() => setXpToast(null), 2500)
  }
  if (data.leveled_up && data.new_level) {
    setTimeout(() => {
      setLevelUpToast({ level: data.new_level!, dimension: task.dimension })
      setTimeout(() => setLevelUpToast(null), 3000)
    }, 600)
  }
}
