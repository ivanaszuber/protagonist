'use client'

import { motion } from 'framer-motion'

interface ForgeCharacterProps {
  tier?: 1 | 2 | 3
  size?: number
  delay?: number
}

export default function ForgeCharacter({
  tier = 1,
  size = 48,
  delay = 0,
}: ForgeCharacterProps) {
  return (
    <motion.svg
      width={size}
      height={Math.round(size * 1.125)}
      viewBox="0 0 48 54"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <circle cx="24" cy="16" r="14" fill="#EF9F27" opacity="0.1" />
      <circle cx="24" cy="16" r="9" fill="#EF9F27" />
      {tier >= 1 && (
        <>
          <rect x="17" y="13" width="5" height="4" rx="2" fill="#0D0820" />
          <rect x="26" y="13" width="5" height="4" rx="2" fill="#0D0820" />
          <line x1="22" y1="15" x2="26" y2="15" stroke="#0D0820" strokeWidth="1.5" />
        </>
      )}
      <path d="M15 30 Q24 25 33 30 L34 48 Q24 50 14 48 Z" fill="#EF9F27" opacity="0.35" />
      <line x1="15" y1="37" x2="33" y2="37" stroke="#BA7517" strokeWidth="1.5" opacity="0.5" />
      <rect x="29" y="34" width="2.5" height="10" rx="1" fill="#633806" />
      <rect x="26" y="32" width="8" height="5" rx="1.5" fill="#BA7517" />
      <circle cx="38" cy="28" r="1.5" fill="#FAC775" opacity="0.9" />
      <circle cx="41" cy="33" r="1" fill="#FAC775" opacity="0.55" />
      <circle cx="37" cy="36" r="1" fill="#FAC775" opacity="0.35" />
      {tier >= 2 && (
        <>
          <circle cx="43" cy="26" r="1.2" fill="#FAC775" opacity="0.7" />
          <circle cx="40" cy="38" r="0.8" fill="#FAC775" opacity="0.5" />
        </>
      )}
      {tier >= 3 && (
        <>
          <circle cx="44" cy="32" r="1.5" fill="#FAC775" opacity="0.8" />
          <circle cx="35" cy="24" r="1.2" fill="#FAC775" opacity="0.6" />
          <circle cx="43" cy="40" r="1" fill="#FAC775" opacity="0.5" />
          <path
            d="M18 9 L20 6 L22 9 L24 5 L26 9 L28 6 L30 9"
            fill="none"
            stroke="#FAC775"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </motion.svg>
  )
}
