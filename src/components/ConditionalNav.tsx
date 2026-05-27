'use client'

import { usePathname } from 'next/navigation'
import { useIsDesktop } from '@/lib/useIsDesktop'
import BottomNav from './BottomNav'
import { OracleSheet } from './OracleSheet'

/** Hides bottom nav on auth pages and desktop. OracleSheet always renders (needed for desktop Oracle button). */
export default function ConditionalNav() {
  const pathname = usePathname()
  const isDesktop = useIsDesktop()

  const isAuthPage = pathname === '/login' || pathname.startsWith('/auth/')
  if (isAuthPage) return null

  return (
    <>
      {!isDesktop && <BottomNav />}
      <OracleSheet />
    </>
  )
}
