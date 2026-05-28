'use client'

import { usePathname } from 'next/navigation'
import { useIsDesktop } from '@/lib/useIsDesktop'
import BottomNav from './BottomNav'
import { OracleSheet } from './OracleSheet'

/** Hides bottom nav and Oracle sheet on desktop/auth pages. Desktop gets its own Oracle modal. */
export default function ConditionalNav() {
  const pathname = usePathname()
  const isDesktop = useIsDesktop()

  const isAuthPage = pathname === '/login' || pathname.startsWith('/auth/')
  if (isAuthPage) return null

  if (isDesktop) return null

  return (
    <>
      <BottomNav />
      <OracleSheet />
    </>
  )
}
