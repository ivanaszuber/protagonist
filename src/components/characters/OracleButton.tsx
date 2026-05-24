'use client'

import { motion } from 'framer-motion'

interface OracleButtonProps {
  onClick?: () => void
}

export default function OracleButton({ onClick }: OracleButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      whileTap={{ scale: 0.93 }}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        flexShrink: 0,
      }}
      aria-label="Open Oracle"
    >
      <svg width="46" height="46" viewBox="0 0 46 46">
        <circle
          cx="23"
          cy="23"
          r="21"
          fill="#12082A"
          stroke="rgba(168,85,247,0.4)"
          strokeWidth="1.5"
        />
        <circle cx="23" cy="23" r="16" fill="#1A0F3A" />
        <ellipse cx="23" cy="23" rx="9" ry="6.5" fill="none" stroke="#9333EA" strokeWidth="1.2" />
        <circle cx="23" cy="23" r="3.8" fill="#7C3AED" />
        <circle cx="23" cy="23" r="1.8" fill="#E879F9" />
        <circle cx="24.3" cy="21.5" r="0.8" fill="#fff" opacity="0.65" />
        <circle cx="11" cy="15" r="0.9" fill="#C084FC" opacity="0.4" />
        <circle cx="35" cy="15" r="0.9" fill="#C084FC" opacity="0.4" />
        <circle cx="8" cy="23" r="0.7" fill="#C084FC" opacity="0.25" />
        <circle cx="38" cy="23" r="0.7" fill="#C084FC" opacity="0.25" />
        <circle cx="11" cy="31" r="0.9" fill="#C084FC" opacity="0.3" />
        <circle cx="35" cy="31" r="0.9" fill="#C084FC" opacity="0.3" />
      </svg>
      <span style={{ fontSize: 9, color: '#4A3D60', letterSpacing: '0.04em' }}>Oracle</span>
    </motion.button>
  )
}
