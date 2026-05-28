/** Blaze — vitality/body */
function darkenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const dr = Math.round(r * factor).toString(16).padStart(2, '0')
  const dg = Math.round(g * factor).toString(16).padStart(2, '0')
  const db = Math.round(b * factor).toString(16).padStart(2, '0')
  return `#${dr}${dg}${db}`
}

export function BlazeCharacterLarge({ color = '#F43F5E' }: { color?: string } = {}) {
  const legs = darkenHex(color, 0.72)
  const eye = darkenHex(color, 0.12)
  return (
    <svg width="96" height="118" viewBox="0 0 44 54" fill="none">
      <path
        d="M18 8 C18 4 22 2 22 2 C22 2 26 4 26 8 C26 12 22 14 22 14 C22 14 18 12 18 8Z"
        fill={color}
        opacity={0.9}
      />
      <path
        d="M20 9 C20 6.5 22 5 22 5 C22 5 24 6.5 24 9 C24 11 22 12.5 22 12.5 C22 12.5 20 11 20 9Z"
        fill="white"
        opacity={0.2}
      />
      <rect x="3" y="12" width="30" height="24" rx="9" fill={color} />
      <circle cx="13" cy="24" r="6" fill={eye} />
      <circle cx="26" cy="24" r="6" fill={eye} />
      <circle cx="11" cy="22" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="22" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="38" width="22" height="16" rx="5" fill={legs} />
      <polyline
        points="9,47 12,47 14,43 16,51 18,45 20,47 23,47 25,47 27,47"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.7}
      />
    </svg>
  )
}
