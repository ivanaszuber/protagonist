import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Plus_Jakarta_Sans } from 'next/font/google'
import ConditionalNav from '@/components/ConditionalNav'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-plus-jakarta-sans',
})

export const metadata: Metadata = {
  title: 'Protagonist',
  description: 'Your AI life coach. Daily quests. Real progress.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Protagonist',
  },
  applicationName: 'Protagonist',
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0D0820',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${plusJakartaSans.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif' }}
      >
        {children}
        <ConditionalNav />
      </body>
    </html>
  )
}
