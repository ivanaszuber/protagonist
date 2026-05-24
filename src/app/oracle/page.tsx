'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OraclePage() {
  const router = useRouter()

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('protagonist:open-oracle'))
    router.replace('/dashboard')
  }, [router])

  return (
    <main
      style={{
        background: '#0D0820',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ color: '#6A5A8A', fontSize: 13 }}>Opening Oracle…</span>
    </main>
  )
}
