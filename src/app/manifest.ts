import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Protagonist',
    short_name: 'Protagonist',
    description: 'Your AI life coach. Daily quests. Real progress.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0D0820',
    theme_color: '#0D0820',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
