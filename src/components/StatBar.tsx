interface StatBarProps {
  label: string
  value: number | null
  color: string
}

export function StatBar({ label, value, color }: StatBarProps) {
  const pct = value ?? 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: '#5A4A7A' }}>{label}</span>
        <span style={{ fontSize: 10, color: '#7A5FA0' }}>{value ?? '—'}</span>
      </div>
      <div style={{ height: 6, background: '#1E0D40', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: 'width 1s ease',
          }}
        />
      </div>
    </div>
  )
}
