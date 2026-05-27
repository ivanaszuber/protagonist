'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CHARACTERS, ALL_DIMENSIONS, type Dimension } from '@/lib/character'
import { getPinnedDimensions, savePinnedDimensions } from '@/lib/pinnedDimensions'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editSlot = searchParams.get('editSlot') ? Number(searchParams.get('editSlot')) : null

  const [pinned, setPinned] = useState<Dimension[]>(['career', 'social', 'wealth'])
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  useEffect(() => {
    setPinned(getPinnedDimensions())
  }, [])

  function togglePin(dim: Dimension) {
    setPinned((prev) => {
      if (prev.includes(dim)) {
        return prev
      }
      if (prev.length >= 3) {
        const slot = editSlot ?? 2
        const next = [...prev]
        next[slot] = dim
        return next
      }
      return [...prev, dim]
    })
  }

  function handleSave() {
    savePinnedDimensions(pinned)
    router.back()
  }

  return (
    <main
      style={{
        background: '#0D0820',
        minHeight: '100dvh',
        paddingBottom: 40,
        fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 4px 24px' }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: '#9333EA',
              fontSize: 18,
            }}
          >
            ←
          </button>
          <span style={{ fontSize: 22, fontWeight: 500, color: '#E8E0F0' }}>Settings</span>
        </div>

        <div style={{ marginBottom: 32 }}>
          <p
            style={{
              fontSize: 11,
              color: '#5A4A7A',
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Pinned characters · {pinned.length}/3
          </p>
          <p style={{ fontSize: 12, color: '#3D3358', marginBottom: 16 }}>
            Choose 3 characters to show in your bottom nav. Long-press a nav item anytime to swap.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ALL_DIMENSIONS.map((dim) => {
              const char = CHARACTERS[dim]
              const isPinned = pinned.includes(dim)
              const slotIndex = pinned.indexOf(dim)
              return (
                <button
                  key={dim}
                  type="button"
                  onClick={() => togglePin(dim)}
                  style={{
                    background: isPinned ? char.bgColor : '#140C28',
                    border: `1.5px solid ${isPinned ? char.color : '#2D1B55'}`,
                    borderRadius: 14,
                    padding: '14px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    position: 'relative',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {isPinned && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: char.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        color: '#0D0820',
                        fontWeight: 700,
                      }}
                    >
                      {slotIndex + 1}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: isPinned ? char.color : '#C0B0E0',
                      marginBottom: 2,
                    }}
                  >
                    {char.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: isPinned ? char.color : '#5A4A7A',
                      opacity: isPinned ? 0.8 : 1,
                    }}
                  >
                    {char.tagline}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '14px 0',
            background: '#9333EA',
            border: 'none',
            borderRadius: 12,
            color: 'white',
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginBottom: 12,
          }}
        >
          Save
        </button>

        {/* Sign out */}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          style={{
            width: '100%',
            padding: '13px 0',
            background: 'transparent',
            border: '0.5px solid rgba(239,68,68,0.25)',
            borderRadius: 12,
            color: signingOut ? '#5A4A7A' : '#F87171',
            fontSize: 13,
            fontWeight: 500,
            cursor: signingOut ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </main>
  )
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main style={{ background: '#0D0820', minHeight: '100dvh', padding: 40, color: '#3D3358' }}>
          Loading...
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  )
}
