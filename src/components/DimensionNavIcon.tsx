import { CHARACTERS, type Dimension } from '@/lib/character'

interface DimensionNavIconProps {
  dimension: Dimension
  active: boolean
}

export function DimensionNavIcon({ dimension, active }: DimensionNavIconProps) {
  const color = CHARACTERS[dimension].color
  const body = active ? color : '#2D1B55'
  const accent = active ? color : '#6A5A8A'
  const eye = active ? '#1A0800' : '#1A0D30'

  if (dimension === 'career') {
    return (
      <svg width="24" height="22" viewBox="0 0 28 26" fill="none">
        <circle cx="24" cy="5" r="2.8" fill={accent} opacity={active ? 0.7 : 0.4} />
        <circle cx="21" cy="2" r="1.4" fill={accent} opacity={active ? 0.45 : 0.25} />
        <rect x="2" y="5" width="20" height="16" rx="6" fill={body} />
        <circle cx="8.5" cy="13" r="4" fill={eye} />
        <circle cx="15.5" cy="13" r="4" fill={eye} />
        <circle cx="7.2" cy="11.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
        <circle cx="14.2" cy="11.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
      </svg>
    )
  }

  if (dimension === 'social') {
    return (
      <svg width="26" height="22" viewBox="0 0 30 26" fill="none">
        <circle cx="25" cy="8" r="2.2" fill={accent} opacity={active ? 0.7 : 0.4} />
        <rect x="2" y="5" width="20" height="16" rx="6" fill={body} />
        <circle cx="8.5" cy="13" r="4" fill={eye} />
        <circle cx="15.5" cy="13" r="4" fill={eye} />
        <circle cx="7.2" cy="11.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
        <circle cx="14.2" cy="11.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
        <path
          d="M24 9Q28 13 24 17"
          stroke={accent}
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    )
  }

  if (dimension === 'wealth') {
    return (
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
        <circle cx="12" cy="4" r="4" fill={active ? '#FAC775' : accent} opacity={active ? 0.95 : 0.4} />
        <circle cx="12" cy="4" r="2.5" fill={active ? '#EF9F27' : '#3D2878'} />
        <path
          d="M11.5 2V6M10 4H14.5"
          stroke={active ? '#FAC775' : accent}
          strokeWidth="1"
          strokeLinecap="round"
        />
        <rect x="2" y="8" width="20" height="16" rx="6" fill={body} />
        <circle cx="8.5" cy="16" r="4" fill={eye} />
        <circle cx="15.5" cy="16" r="4" fill={eye} />
        <circle cx="7.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
        <circle cx="14.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
      </svg>
    )
  }

  if (dimension === 'vitality') {
    return (
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
        <path
          d="M14 3 C14 3 11 6 11 8 C11 10 14 11 14 11 C14 11 17 10 17 8 C17 6 14 3 14 3Z"
          fill={accent}
          opacity={active ? 0.9 : 0.45}
        />
        <rect x="2" y="8" width="20" height="16" rx="6" fill={body} />
        <circle cx="8.5" cy="16" r="4" fill={eye} />
        <circle cx="15.5" cy="16" r="4" fill={eye} />
        <circle cx="7.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
        <circle cx="14.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
      </svg>
    )
  }

  if (dimension === 'mind') {
    return (
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="4" r="2.2" fill={accent} opacity={active ? 0.85 : 0.4} />
        <circle cx="17" cy="2" r="1.5" fill={accent} opacity={active ? 0.55 : 0.3} />
        <circle cx="19" cy="1" r="1" fill={accent} opacity={active ? 0.35 : 0.2} />
        <rect x="2" y="8" width="20" height="16" rx="6" fill={body} />
        <circle cx="8.5" cy="16" r="4" fill={eye} />
        <circle cx="15.5" cy="16" r="4" fill={eye} />
        <circle cx="7.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
        <circle cx="14.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
      </svg>
    )
  }

  if (dimension === 'love') {
    return (
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
        <path
          d="M14 6 C14 6 11 3 11 2 C11 1 12 0 13 1 C13.5 1.5 14 2 14 2 C14 2 14.5 1.5 15 1 C16 0 17 1 17 2 C17 3 14 6 14 6Z"
          fill={accent}
          opacity={active ? 0.9 : 0.45}
        />
        <rect x="2" y="8" width="20" height="16" rx="6" fill={body} />
        <circle cx="8.5" cy="16" r="4" fill={eye} />
        <circle cx="15.5" cy="16" r="4" fill={eye} />
        <circle cx="7.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
        <circle cx="14.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
      </svg>
    )
  }

  // family — root
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
      <path
        d="M14 5 C14 5 12 2 12 1 C12 0 13 0 14 1.5 C15 0 16 0 16 1 C16 2 14 5 14 5Z"
        fill={accent}
        opacity={active ? 0.9 : 0.45}
      />
      <line x1="14" y1="5" x2="14" y2="7" stroke={accent} strokeWidth="1" opacity={0.5} />
      <rect x="2" y="8" width="20" height="16" rx="6" fill={body} />
      <circle cx="8.5" cy="16" r="4" fill={eye} />
      <circle cx="15.5" cy="16" r="4" fill={eye} />
      <circle cx="7.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
      <circle cx="14.2" cy="14.8" r="1.3" fill="white" opacity={active ? 0.6 : 0.2} />
    </svg>
  )
}
