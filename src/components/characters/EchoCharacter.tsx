'use client'

import { motion } from 'framer-motion'

interface EchoCharacterProps {
  tier?: 1 | 2 | 3
  size?: number
  delay?: number
}

export default function EchoCharacter({
  tier = 1,
  size = 48,
  delay = 0,
}: EchoCharacterProps) {
  return (
    <motion.svg
      width={size}
      height={Math.round(size * 1.125)}
      viewBox="0 0 48 54"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <circle cx="24" cy="16" r="14" fill="#F0997B" opacity="0.1" />
      <circle cx="24" cy="16" r="9" fill="#F0997B" />
      <circle cx="21" cy="15" r="1.5" fill="#fff" />
      <circle cx="27" cy="15" r="1.5" fill="#fff" />
      <path
        d="M19.5 19 Q24 22.5 28.5 19"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M15 30 Q24 25 33 30 L34 48 Q24 50 14 48 Z" fill="#F0997B" opacity="0.35" />
      <path
        d="M35 17 Q38.5 20.5 35 26"
        fill="none"
        stroke="#F0997B"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M38 14 Q43.5 20.5 38 29"
        fill="none"
        stroke="#F0997B"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="8" cy="20" r="3.5" fill="#F0997B" opacity="0.5" />
      <line x1="15" y1="25" x2="11" y2="21.5" stroke="#F0997B" strokeWidth="1" opacity="0.45" />
      {tier >= 1 && (
        <>
          <circle cx="7" cy="32" r="2.5" fill="#F0997B" opacity="0.3" />
          <line x1="15" y1="31" x2="9" y2="32" stroke="#F0997B" strokeWidth="1" opacity="0.3" />
        </>
      )}
      {tier >= 2 && (
        <>
          <circle cx="10" cy="42" r="2" fill="#F0997B" opacity="0.35" />
          <line x1="15" y1="40" x2="11.5" y2="42" stroke="#F0997B" strokeWidth="1" opacity="0.3" />
          <circle cx="4" cy="24" r="1.5" fill="#F0997B" opacity="0.2" />
        </>
      )}
      {tier >= 3 && (
        <>
          <circle cx="40" cy="32" r="2.5" fill="#F0997B" opacity="0.3" />
          <line x1="33" y1="32" x2="38" y2="32" stroke="#F0997B" strokeWidth="1" opacity="0.3" />
          <circle cx="42" cy="22" r="2" fill="#F0997B" opacity="0.2" />
          <path
            d="M20 8 Q24 5 28 8"
            fill="none"
            stroke="#F0997B"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.5"
          />
        </>
      )}
    </motion.svg>
  )
}
