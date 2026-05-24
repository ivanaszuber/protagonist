'use client'

import { motion } from 'framer-motion'

interface VaultCharacterProps {
  tier?: 1 | 2 | 3
  size?: number
  delay?: number
}

export default function VaultCharacter({
  tier = 1,
  size = 48,
  delay = 0,
}: VaultCharacterProps) {
  return (
    <motion.svg
      width={size}
      height={Math.round(size * 1.125)}
      viewBox="0 0 48 54"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <circle cx="24" cy="16" r="14" fill="#1D9E75" opacity="0.1" />
      <circle cx="24" cy="16" r="9" fill="#1D9E75" />
      <circle cx="21" cy="15" r="1.5" fill="#fff" />
      <circle cx="27" cy="15" r="1.5" fill="#fff" />
      <line x1="20" y1="19" x2="28" y2="19" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="24" cy="6" r="4.5" fill="#FAC775" />
      <line x1="24" y1="3.5" x2="24" y2="8.5" stroke="#854F0B" strokeWidth="1.3" />
      <line x1="21.5" y1="6" x2="26.5" y2="6" stroke="#854F0B" strokeWidth="1.3" />
      <path d="M15 30 Q24 25 33 30 L34 48 Q24 50 14 48 Z" fill="#1D9E75" opacity="0.35" />
      <polyline
        points="17,44 20,38 24,41 28,33 33,35"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.65"
      />
      <line
        x1="33"
        y1="35"
        x2="33"
        y2="30"
        stroke="#FAC775"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M31 32.5 L33 29.5 L35 32.5"
        fill="none"
        stroke="#FAC775"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {tier >= 2 && (
        <>
          <circle cx="8" cy="42" r="3.5" fill="#FAC775" opacity="0.4" />
          <circle cx="8" cy="39" r="3.5" fill="#FAC775" opacity="0.3" />
          <circle cx="8" cy="36" r="3.5" fill="#FAC775" opacity="0.2" />
        </>
      )}
      {tier >= 3 && (
        <>
          <path d="M14 30 Q8 24 10 18 Q12 24 15 28" fill="#FAC775" opacity="0.25" />
          <path d="M34 30 Q40 24 38 18 Q36 24 33 28" fill="#FAC775" opacity="0.25" />
        </>
      )}
    </motion.svg>
  )
}
