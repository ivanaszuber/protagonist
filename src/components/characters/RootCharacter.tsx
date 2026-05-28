/** Root — family */
function darkenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const dr = Math.round(r * factor).toString(16).padStart(2, '0')
  const dg = Math.round(g * factor).toString(16).padStart(2, '0')
  const db = Math.round(b * factor).toString(16).padStart(2, '0')
  return `#${dr}${dg}${db}`
}

export function RootCharacterLarge({ color = '#4ADE80' }: { color?: string } = {}) {
  const legs = darkenHex(color, 0.72)
  const eye = darkenHex(color, 0.12)
  return (
    <svg width="96" height="118" viewBox="0 0 44 54" fill="none">
      <path
        d="M22 10 C22 10 18 6 18 3 C18 1 20 0 22 2 C24 0 26 1 26 3 C26 6 22 10 22 10Z"
        fill={color}
        opacity={0.9}
      />
      <line x1="22" y1="10" x2="22" y2="13" stroke={color} strokeWidth="1.2" opacity={0.6} />
      <path
        d="M22 11 C22 11 20 9 19 10"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
      <rect x="3" y="12" width="30" height="24" rx="9" fill={color} />
      <circle cx="13" cy="24" r="6" fill={eye} />
      <circle cx="26" cy="24" r="6" fill={eye} />
      <circle cx="11" cy="22" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="22" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="38" width="22" height="16" rx="5" fill={legs} />
      <rect x="11" y="41" width="6" height="8" rx="2" fill={color} opacity={0.5} />
      <circle cx="14" cy="40" r="2.5" fill={color} opacity={0.6} />
      <rect x="20" y="44" width="4" height="6" rx="1.5" fill={color} opacity={0.4} />
      <circle cx="22" cy="43" r="1.8" fill={color} opacity={0.5} />
    </svg>
  )
}
