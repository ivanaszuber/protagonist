'use client'

import { motion } from 'framer-motion'

interface ProtagonistCharacterProps {
  size?: number
}

export default function ProtagonistCharacter({ size = 50 }: ProtagonistCharacterProps) {
  return (
    <motion.svg
      width={size}
      height={Math.round(size * 1.16)}
      viewBox="0 0 50 58"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
    >
      <circle cx="25" cy="20" r="17" fill="#7C3AED" opacity="0.08" />
      <circle cx="25" cy="20" r="11" fill="#2D1B69" stroke="#9333EA" strokeWidth="1.5" />
      <circle cx="21.5" cy="19" r="1.8" fill="#E879F9" />
      <circle cx="28.5" cy="19" r="1.8" fill="#E879F9" />
      <path
        d="M21 23 Q25 26 29 23"
        fill="none"
        stroke="#C084FC"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M17 15 L18.5 12 L21 15.5 L25 11 L29 15.5 L31.5 12 L33 15"
        fill="none"
        stroke="#FAC775"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy="11" r="1.5" fill="#FAC775" />
      <circle cx="18.5" cy="12" r="1" fill="#FAC775" />
      <circle cx="31.5" cy="12" r="1" fill="#FAC775" />
      <path
        d="M14 34 Q25 29 36 34 L37 55 Q25 57 13 55 Z"
        fill="#2D1B69"
        opacity="0.85"
        stroke="#9333EA"
        strokeWidth="0.5"
      />
      <path
        d="M25 40 L26.3 43.8 L30.3 43.8 L27 46 L28.3 49.8 L25 47.5 L21.7 49.8 L23 46 L19.7 43.8 L23.7 43.8 Z"
        fill="#FAC775"
        opacity="0.6"
      />
      <path
        d="M14 34 Q10 43 11 55"
        fill="none"
        stroke="#9333EA"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M36 34 Q40 43 39 55"
        fill="none"
        stroke="#9333EA"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
    </motion.svg>
  )
}
