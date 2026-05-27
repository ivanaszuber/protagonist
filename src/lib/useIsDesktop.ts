'use client'

import { useEffect, useState } from 'react'

export function useIsDesktop(breakpoint = 1024): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= breakpoint)
    check()
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`)
    mq.addEventListener('change', check)
    return () => mq.removeEventListener('change', check)
  }, [breakpoint])

  return isDesktop
}
