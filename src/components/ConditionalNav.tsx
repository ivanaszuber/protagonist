'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'
import { OracleSheet } from './OracleSheet'

/** Hides bottom nav and oracle sheet on auth pages (login, etc.) */
export default function ConditionalNav() {
  const pathname = usePathname()

  const isAuthPage = pathname === '/login' || pathname.startsWith('/auth/')
  if (isAuthPage) return null

  return (
    <>
      <BottomNav />
      <OracleSheet />
    </>
  )
}
