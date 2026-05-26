export function BossSvg({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <ellipse cx="32" cy="38" rx="22" ry="18" fill="#2A0808" />
      <path d="M18 28C22 18 28 14 32 14C36 14 42 18 46 28" fill="#1A0505" />
      <circle cx="24" cy="32" r="3" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 4px #ef4444)' }} />
      <circle cx="40" cy="32" r="3" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 4px #ef4444)' }} />
      <path d="M26 42C28 46 36 46 38 42" stroke="#6B1A1A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
