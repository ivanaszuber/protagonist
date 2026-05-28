/** Darken a hex color by multiplying RGB channels by `factor` (0–1) */
function darkenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const dr = Math.round(r * factor).toString(16).padStart(2, '0')
  const dg = Math.round(g * factor).toString(16).padStart(2, '0')
  const db = Math.round(b * factor).toString(16).padStart(2, '0')
  return `#${dr}${dg}${db}`
}

export function ForgeCharacterLarge({ color = '#EF9F27' }: { color?: string } = {}) {
  const legs = darkenHex(color, 0.72)
  const eye = darkenHex(color, 0.12)
  return (
    <svg width="96" height="118" viewBox="0 0 44 54" fill="none">
      <circle cx="39" cy="10" r="3.5" fill={color} opacity={0.85} />
      <circle cx="35" cy="5" r="1.8" fill={color} opacity={0.55} />
      <rect x="3" y="8" width="30" height="24" rx="9" fill={color} />
      <circle cx="13" cy="20" r="6" fill={eye} />
      <circle cx="26" cy="20" r="6" fill={eye} />
      <circle cx="11" cy="18" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="18" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="34" width="22" height="16" rx="5" fill={legs} />
      <line x1="11" y1="41" x2="25" y2="41" stroke={color} strokeWidth="1.5" opacity={0.45} />
      <line x1="11" y1="46" x2="25" y2="46" stroke={color} strokeWidth="1" opacity={0.25} />
    </svg>
  )
}

export function EchoCharacterLarge({ color = '#F0997B' }: { color?: string } = {}) {
  const legs = darkenHex(color, 0.72)
  const eye = darkenHex(color, 0.12)
  return (
    <svg width="100" height="118" viewBox="0 0 46 54" fill="none">
      <circle cx="38" cy="10" r="3" fill={color} opacity={0.8} />
      <rect x="3" y="8" width="30" height="24" rx="9" fill={color} />
      <circle cx="13" cy="20" r="6" fill={eye} />
      <circle cx="26" cy="20" r="6" fill={eye} />
      <circle cx="11" cy="18" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="18" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="34" width="22" height="16" rx="5" fill={legs} />
      <path
        d="M33 30Q37 35 33 40"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      <path
        d="M36 27Q42 35 36 43"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.4}
      />
    </svg>
  )
}

export function VaultCharacterLarge({ color = '#1D9E75' }: { color?: string } = {}) {
  const legs = darkenHex(color, 0.72)
  const eye = darkenHex(color, 0.12)
  return (
    <svg width="92" height="123" viewBox="0 0 42 56" fill="none">
      <circle cx="18" cy="7" r="5.5" fill={color} opacity={0.95} />
      <circle cx="18" cy="7" r="3.5" fill={darkenHex(color, 0.8)} />
      <path
        d="M17.5 4.5V9.5M15.5 7H21"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <rect x="3" y="12" width="30" height="24" rx="9" fill={color} />
      <circle cx="13" cy="24" r="6" fill={eye} />
      <circle cx="26" cy="24" r="6" fill={eye} />
      <circle cx="11" cy="22" r="2" fill="white" opacity={0.6} />
      <circle cx="24" cy="22" r="2" fill="white" opacity={0.6} />
      <rect x="7" y="38" width="22" height="16" rx="5" fill={legs} />
      <path
        d="M11 51L16 47L20 49L26 44"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.75}
      />
    </svg>
  )
}

export { BlazeCharacterLarge } from './BlazeCharacter'
export { SageCharacterLarge } from './SageCharacter'
export { SolCharacterLarge } from './SolCharacter'
export { RootCharacterLarge } from './RootCharacter'
