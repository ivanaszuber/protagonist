'use client'

import dynamic from 'next/dynamic'

const DesktopJournalPage = dynamic(
  () => import('@/components/desktop/DesktopJournalPage'),
  { ssr: false }
)

export default function JournalPage() {
  return <DesktopJournalPage />
}
