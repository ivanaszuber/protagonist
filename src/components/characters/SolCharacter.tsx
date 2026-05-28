/** Sol — love */
function darkenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const dr = Math.round(r * factor).toString(16).padStart(2, '0')
  const dg = Math.round(g * factor).toString(16).padStart(2, '0')
  const db = Math.round(b * factor).toString(16).padStart(2, '0')
  return `#${dr}${dg}${db}`
}

export function SolCharacterLarge({ color = '#F472B6' }: { color?: string } = {}) {
  const legs = darkenHex(color, 0.72)
  const eye = darkenHex(color, 0.12)
  return (
    <svg width="96" height="118" viewBox="0 0 44 54" fill="none">
      <path
        d="M22 10 C22 10 17 5 17 3 C17 1 19 0 20.5 1 C21.2 1.5 22 2.5 22 2.5 C22 2.5 22.8 1.5 23.5 1 C25 0 27 1 27 3 C27 5 22 10 22 10Z"
        fill={color}
        opacity={0.9}
      />
      <rect x="3" y="11" width="30" height="24" rx="9" fill={color} />
      <circle cx="13" cy="23" r="6" fill={eye} />
      <circle cx="26" cy="23" r="6" fill={eye} />
      <circle cx="11" cy="21" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="21" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="37" width="22" height="16" rx="5" fill={legs} />
      <circle cx="15" cy="45" r="4.5" fill="none" stroke={color} strokeWidth="1.5" opacity={0.7} />
      <circle cx="21" cy="45" r="4.5" fill="none" stroke={color} strokeWidth="1.5" opacity={0.7} />
    </svg>
  )
}
