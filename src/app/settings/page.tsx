'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CHARACTERS, ALL_DIMENSIONS, type Dimension } from '@/lib/character'
import { getPinnedDimensions, savePinnedDimensions } from '@/lib/pinnedDimensions'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { UserProfile } from '@/app/api/user-profile/route'

const ZODIAC_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#E8E0F0',
  fontSize: 13,
  fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
  outline: 'none',
  boxSizing: 'border-box' as const,
}

const labelStyle = {
  fontSize: 10,
  color: 'rgba(255,255,255,0.38)',
  fontWeight: 600 as const,
  letterSpacing: '1.3px',
  textTransform: 'uppercase' as const,
  display: 'block' as const,
  marginBottom: 6,
}

const fieldStyle = { marginBottom: 14 }

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editSlot = searchParams.get('editSlot') ? Number(searchParams.get('editSlot')) : null

  const [pinned, setPinned] = useState<Dimension[]>(['career', 'social', 'wealth'])
  const [signingOut, setSigningOut] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [userId, setUserId] = useState('')

  // Google Calendar connection state
  const [calStatus, setCalStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [calEmail, setCalEmail] = useState('')
  const [calCalendars, setCalCalendars] = useState<Array<{ name: string; primary: boolean }>>([])
  const [calDisconnecting, setCalDisconnecting] = useState(false)

  // Profile fields
  const [displayName,         setDisplayName]         = useState('')
  const [location,            setLocation]            = useState('')
  const [age,                 setAge]                 = useState('')
  const [familyInfo,          setFamilyInfo]          = useState('')
  const [financialStatus,     setFinancialStatus]     = useState('')
  const [relationshipStatus,  setRelationshipStatus]  = useState('')
  const [enneagram,           setEnneagram]           = useState('')
  const [sunSign,             setSunSign]             = useState('')
  const [risingSign,          setRisingSign]          = useState('')
  const [neurodivergentNotes, setNeurodivergentNotes] = useState('')

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Load userId from cookie
  useEffect(() => {
    const uid = document.cookie
      .split('; ')
      .find(r => r.startsWith('protagonist_user_id='))
      ?.split('=')[1] ?? ''
    setUserId(uid)
  }, [])

  // Load existing profile
  const loadProfile = useCallback(async (uid: string) => {
    if (!uid) return
    try {
      const r = await fetch(`/api/user-profile?userId=${uid}`)
      const d = await r.json() as { profile?: UserProfile }
      if (d.profile) {
        setDisplayName(d.profile.displayName ?? '')
        setLocation(d.profile.location ?? '')
        setAge(d.profile.age != null ? String(d.profile.age) : '')
        setFamilyInfo(d.profile.familyInfo ?? '')
        setFinancialStatus(d.profile.financialStatus ?? '')
        setRelationshipStatus(d.profile.relationshipStatus ?? '')
        setEnneagram(d.profile.enneagram ?? '')
        setSunSign(d.profile.sunSign ?? '')
        setRisingSign(d.profile.risingSign ?? '')
        setNeurodivergentNotes(d.profile.neurodivergentNotes ?? '')
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    setPinned(getPinnedDimensions())
  }, [])

  useEffect(() => {
    if (userId) void loadProfile(userId)
  }, [userId, loadProfile])

  const loadCalStatus = useCallback(async (uid: string) => {
    if (!uid) return
    try {
      const r = await fetch(`/api/calendar/debug?userId=${encodeURIComponent(uid)}`)
      const d = await r.json() as { connected: boolean; account?: { email?: string }; calendars?: Array<{ name: string; primary: boolean }> }
      if (d.connected) {
        setCalStatus('connected')
        setCalEmail(d.account?.email ?? '')
        setCalCalendars(d.calendars ?? [])
      } else {
        setCalStatus('disconnected')
      }
    } catch {
      setCalStatus('disconnected')
    }
  }, [])

  useEffect(() => {
    if (userId) void loadCalStatus(userId)
  }, [userId, loadCalStatus])

  async function handleDisconnectGoogle() {
    if (!userId) return
    setCalDisconnecting(true)
    try {
      await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      setCalStatus('disconnected')
      setCalEmail('')
      setCalCalendars([])
    } finally {
      setCalDisconnecting(false)
    }
  }

  function handleConnectGoogle() {
    window.location.href = `/api/calendar/connect?userId=${encodeURIComponent(userId)}`
  }

  async function handleSaveProfile() {
    if (!userId) return
    setSavingProfile(true)
    setProfileError('')
    try {
      const r = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          displayName,
          location,
          age: age ? parseInt(age) : null,
          familyInfo,
          financialStatus,
          relationshipStatus,
          enneagram,
          sunSign,
          risingSign,
          neurodivergentNotes,
        } satisfies UserProfile),
      })
      const json = await r.json() as { ok?: boolean; error?: string }
      if (!r.ok || json.error) {
        setProfileError(json.error ?? 'Save failed — check console')
        return
      }
      // Bust sidebar cache so it re-fetches
      try {
        localStorage.removeItem(`protagonist-profile-${userId}`)
        localStorage.removeItem(`protagonist-archetype-insights-${userId}`)
      } catch { /* ignore */ }

      // Fire archetype insights regeneration in background (enneagram/astro/neurodivergent changed)
      if (enneagram || sunSign || neurodivergentNotes) {
        void fetch('/api/user-profile/archetype-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }).catch(() => {/* silent — background op */})
      }

      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Network error')
    } finally { setSavingProfile(false) }
  }

  function togglePin(dim: Dimension) {
    setPinned((prev) => {
      if (prev.includes(dim)) return prev
      if (prev.length >= 3) {
        const slot = editSlot ?? 2
        const next = [...prev]
        next[slot] = dim
        return next
      }
      return [...prev, dim]
    })
  }

  function handleSavePinned() {
    savePinnedDimensions(pinned)
    router.back()
  }

  const sectionHead = (label: string) => (
    <p style={{
      fontSize: 11, color: '#5A4A7A', fontWeight: 500,
      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
      marginBottom: 14, marginTop: 0,
    }}>{label}</p>
  )

  return (
    <main style={{
      background: '#0D0820',
      minHeight: '100dvh',
      paddingBottom: 60,
      fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 4px 28px' }}>
          <button type="button" onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9333EA', fontSize: 18 }}>
            ←
          </button>
          <span style={{ fontSize: 22, fontWeight: 500, color: '#E8E0F0' }}>Settings</span>
        </div>

        {/* ── MY PROFILE ── */}
        <div style={{
          background: 'rgba(123,63,228,0.07)', border: '1px solid rgba(123,63,228,0.18)',
          borderRadius: 16, padding: '18px 18px 20px', marginBottom: 28,
        }}>
          {sectionHead('My Profile')}

          {/* Personal facts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Display Name</label>
              <input style={inputStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Ivana" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="London" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Age</label>
              <input style={inputStyle} type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="42" min="1" max="120" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Relationship Status</label>
              <input style={inputStyle} value={relationshipStatus} onChange={e => setRelationshipStatus(e.target.value)} placeholder="Divorced" />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Family</label>
            <input style={inputStyle} value={familyInfo} onChange={e => setFamilyInfo(e.target.value)} placeholder="Mum of Zara" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Financial Status</label>
            <input style={inputStyle} value={financialStatus} onChange={e => setFinancialStatus(e.target.value)} placeholder="Financially independent" />
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '10px 0 14px' }} />

          {/* Personality archetypes */}
          <p style={{ ...labelStyle, marginBottom: 12 }}>Personality Archetypes</p>

          <div style={fieldStyle}>
            <label style={labelStyle}>Enneagram</label>
            <input style={inputStyle} value={enneagram} onChange={e => setEnneagram(e.target.value)} placeholder="3w4" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Sun Sign</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={sunSign} onChange={e => setSunSign(e.target.value)}>
                <option value="">— select —</option>
                {ZODIAC_SIGNS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Rising Sign</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={risingSign} onChange={e => setRisingSign(e.target.value)}>
                <option value="">— select —</option>
                {ZODIAC_SIGNS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Neurodivergent / Wiring</label>
            <input style={inputStyle} value={neurodivergentNotes} onChange={e => setNeurodivergentNotes(e.target.value)}
              placeholder="AuDHD, ADHD traits, etc." />
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 5, lineHeight: 1.5 }}>
              Arc uses this to personalise how it understands and speaks to you.
            </p>
          </div>

          {profileError && (
            <p style={{ fontSize: 11, color: '#F87171', marginBottom: 10, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
              ⚠ {profileError}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={savingProfile}
            style={{
              padding: '10px 22px',
              background: profileSaved ? 'rgba(110,231,164,0.15)' : '#7B3FE4',
              border: profileSaved ? '1px solid rgba(110,231,164,0.3)' : 'none',
              borderRadius: 10,
              color: profileSaved ? '#6EE7A4' : 'white',
              fontSize: 13, fontWeight: 600,
              cursor: savingProfile ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.2s',
            }}
          >
            {savingProfile ? 'Saving…' : profileSaved ? '✓ Saved' : 'Save Profile'}
          </button>
        </div>

        {/* ── CONNECTED ACCOUNTS ── */}
        <div style={{
          background: 'rgba(123,63,228,0.07)', border: '1px solid rgba(123,63,228,0.18)',
          borderRadius: 16, padding: '18px 18px 20px', marginBottom: 28,
        }}>
          {sectionHead('Connected Accounts')}

          {/* Google Calendar */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: calStatus === 'connected' ? 10 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Google Calendar icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="4" width="18" height="17" rx="2" stroke="#5A4A7A" strokeWidth="1.5"/>
                  <path d="M3 9h18" stroke="#5A4A7A" strokeWidth="1.5"/>
                  <path d="M8 2v4M16 2v4" stroke="#5A4A7A" strokeWidth="1.5" strokeLinecap="round"/>
                  <rect x="7" y="12" width="4" height="4" rx="0.5" fill="#9333EA" opacity="0.6"/>
                </svg>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#E8E0F0' }}>Google Calendar</div>
                  {calStatus === 'loading' && <div style={{ fontSize: 11, color: '#5A4A7A', marginTop: 2 }}>Checking…</div>}
                  {calStatus === 'connected' && <div style={{ fontSize: 11, color: '#6EE7A4', marginTop: 2 }}>● Connected · {calEmail}</div>}
                  {calStatus === 'disconnected' && <div style={{ fontSize: 11, color: '#F87171', marginTop: 2 }}>○ Not connected</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {calStatus === 'connected' && (
                  <>
                    <button type="button" onClick={handleConnectGoogle}
                      style={{ fontSize: 11, color: '#9333EA', background: 'rgba(147,51,234,0.1)', border: '0.5px solid rgba(147,51,234,0.3)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Switch account
                    </button>
                    <button type="button" onClick={() => void handleDisconnectGoogle()} disabled={calDisconnecting}
                      style={{ fontSize: 11, color: '#F87171', background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {calDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  </>
                )}
                {calStatus === 'disconnected' && (
                  <button type="button" onClick={handleConnectGoogle}
                    style={{ fontSize: 12, color: 'white', background: '#9333EA', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                    Connect
                  </button>
                )}
              </div>
            </div>

            {/* Calendar list */}
            {calStatus === 'connected' && calCalendars.length > 0 && (
              <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                <div style={{ fontSize: 9, color: '#5A4A7A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Syncing from</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {calCalendars.map((cal, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: cal.primary ? '#9333EA' : '#5A4A7A', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: cal.primary ? '#C0B0E0' : '#5A4A7A' }}>
                        {cal.name}{cal.primary ? ' (primary)' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── PINNED CHARACTERS ── */}
        <div style={{ marginBottom: 28 }}>
          {sectionHead(`Pinned characters · ${pinned.length}/3`)}
          <p style={{ fontSize: 12, color: '#3D3358', marginBottom: 16 }}>
            Choose 3 characters to show in your bottom nav. Long-press a nav item anytime to swap.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ALL_DIMENSIONS.map((dim) => {
              const char = CHARACTERS[dim]
              const isPinned = pinned.includes(dim)
              const slotIndex = pinned.indexOf(dim)
              return (
                <button key={dim} type="button" onClick={() => togglePin(dim)}
                  style={{
                    background: isPinned ? char.bgColor : '#140C28',
                    border: `1.5px solid ${isPinned ? char.color : '#2D1B55'}`,
                    borderRadius: 14, padding: '14px 12px',
                    cursor: 'pointer', textAlign: 'left', position: 'relative',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {isPinned && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 18, height: 18, borderRadius: '50%',
                      background: char.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#0D0820', fontWeight: 700,
                    }}>
                      {slotIndex + 1}
                    </div>
                  )}
                  <div style={{ fontSize: 15, fontWeight: 500, color: isPinned ? char.color : '#C0B0E0', marginBottom: 2 }}>
                    {char.name}
                  </div>
                  <div style={{ fontSize: 11, color: isPinned ? char.color : '#5A4A7A', opacity: isPinned ? 0.8 : 1 }}>
                    {char.tagline}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <button type="button" onClick={handleSavePinned}
          style={{
            width: '100%', padding: '14px 0',
            background: '#9333EA', border: 'none', borderRadius: 12,
            color: 'white', fontSize: 15, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12,
          }}
        >
          Save
        </button>

        {/* Sign out */}
        <button type="button" onClick={() => void handleSignOut()} disabled={signingOut}
          style={{
            width: '100%', padding: '13px 0',
            background: 'transparent',
            border: '0.5px solid rgba(239,68,68,0.25)',
            borderRadius: 12,
            color: signingOut ? '#5A4A7A' : '#F87171',
            fontSize: 13, fontWeight: 500,
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
    <Suspense fallback={
      <main style={{ background: '#0D0820', minHeight: '100dvh', padding: 40, color: '#3D3358' }}>Loading...</main>
    }>
      <SettingsContent />
    </Suspense>
  )
}
