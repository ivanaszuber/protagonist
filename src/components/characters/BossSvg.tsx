export function BossSvg({ size = 52, color = '#818CF8' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" aria-hidden>
      {/* Shield */}
      <path
        d="M26 5L9 13V27C9 37.5 17 44.5 26 47C35 44.5 43 37.5 43 27V13L26 5Z"
        fill="#1A0D3A"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Star */}
      <path
        d="M26 17L28.2 23H35L29.4 27L31.6 33L26 29L20.4 33L22.6 27L17 23H23.8L26 17Z"
        fill={color}
        opacity="0.9"
      />
    </svg>
  )
}
