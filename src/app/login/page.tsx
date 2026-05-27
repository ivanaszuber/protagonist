'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

const ERROR_MESSAGES: Record<string, string> = {
  not_invited: "You haven't been invited yet. Reach out to get access.",
  auth_failed: 'Authentication failed. Please try again.',
  no_code: 'Invalid login link. Please try again.',
  OAuthSignin: 'Could not start sign-in. Please try again.',
  OAuthCallback: 'Sign-in was interrupted. Please try again.',
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorKey = searchParams.get('error')
  const next = searchParams.get('next') ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'google' | 'email' | null>(null)
  const [formError, setFormError] = useState('')

  const supabase = createSupabaseBrowserClient()

  // If already logged in, go straight to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGoogle() {
    setLoading('google')
    setFormError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })
    if (error) {
      setFormError(error.message)
      setLoading(null)
    }
    // On success the browser will redirect — no need to setLoading(null)
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setFormError('Please enter your email and password.')
      return
    }
    setLoading('email')
    setFormError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })

    if (error) {
      setFormError(error.message)
      setLoading(null)
      return
    }

    if (data.user) {
      // Verify invite server-side via callback (reuse logic)
      // For email auth we do the check here client-side too
      const { data: allowed } = await supabase
        .from('allowed_emails')
        .select('email')
        .eq('email', data.user.email?.toLowerCase() ?? '')
        .maybeSingle()

      if (!allowed) {
        await supabase.auth.signOut()
        setFormError("You haven't been invited yet. Reach out to get access.")
        setLoading(null)
        return
      }
    }

    router.replace(next)
  }

  const displayError = formError || (errorKey ? ERROR_MESSAGES[errorKey] ?? 'Something went wrong.' : '')

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0D0820',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif',
      }}
    >
      {/* Logo + tagline */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        {/* Protagonist character */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <svg width="58" height="70" viewBox="0 0 58 70" fill="none">
            <path d="M18 14 L21 8 L24 12 L29 6 L34 12 L37 8 L40 14Z" fill="#A855F7" opacity={0.9} />
            <rect x="16" y="13" width="26" height="4" rx="2" fill="#7C3AED" />
            <rect x="12" y="18" width="34" height="26" rx="10" fill="#7C3AED" />
            <circle cx="22" cy="31" r="6.5" fill="#1A0030" />
            <circle cx="36" cy="31" r="6.5" fill="#1A0030" />
            <circle cx="20" cy="29" r="2.2" fill="white" opacity={0.65} />
            <circle cx="34" cy="29" r="2.2" fill="white" opacity={0.65} />
            <path d="M12 26 Q4 34 8 46 L12 44Z" fill="#5B21B6" opacity={0.7} />
            <path d="M46 26 Q54 34 50 46 L46 44Z" fill="#5B21B6" opacity={0.7} />
            <rect x="16" y="46" width="26" height="20" rx="6" fill="#5B21B6" />
            <path
              d="M29 52 L30.5 56 L34.5 56 L31.5 58.5 L32.7 62.5 L29 60 L25.3 62.5 L26.5 58.5 L23.5 56 L27.5 56Z"
              fill="#A855F7"
              opacity={0.7}
            />
          </svg>
        </div>
        <div
          style={{
            fontSize: 13,
            letterSpacing: '4px',
            color: '#C084FC',
            fontWeight: 500,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          PROTAGONIST
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.02em' }}>
          Your AI second brain. Invite only.
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#110828',
          border: '0.5px solid #2D1B55',
          borderRadius: 16,
          padding: '28px 24px',
        }}
      >
        {/* Error banner */}
        {displayError && (
          <div
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '0.5px solid rgba(239,68,68,0.3)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 11,
              color: '#F87171',
              marginBottom: 20,
              lineHeight: 1.5,
            }}
          >
            {displayError}
          </div>
        )}

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading !== null}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: loading === 'google' ? 'rgba(147,51,234,0.08)' : 'rgba(147,51,234,0.12)',
            border: '0.5px solid rgba(147,51,234,0.4)',
            borderRadius: 10,
            padding: '12px 16px',
            color: '#C084FC',
            fontSize: 13,
            fontWeight: 500,
            cursor: loading !== null ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: loading !== null && loading !== 'google' ? 0.5 : 1,
            transition: 'opacity 0.15s',
            marginBottom: 20,
          }}
        >
          {loading === 'google' ? (
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '2px solid rgba(192,132,252,0.3)',
                borderTopColor: '#C084FC',
                animation: 'spin 0.7s linear infinite',
              }}
            />
          ) : (
            /* Google 'G' SVG */
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, height: '0.5px', background: '#2D1B55' }} />
          <span style={{ fontSize: 10, color: '#3D2878', letterSpacing: '0.08em' }}>OR</span>
          <div style={{ flex: 1, height: '0.5px', background: '#2D1B55' }} />
        </div>

        {/* Email / password form */}
        <form onSubmit={handleEmailSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={{
              width: '100%',
              background: '#0D0820',
              border: '0.5px solid #2D1B55',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              color: '#E8E0F0',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{
              width: '100%',
              background: '#0D0820',
              border: '0.5px solid #2D1B55',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              color: '#E8E0F0',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={loading !== null}
            style={{
              width: '100%',
              background: '#1A0D40',
              border: '0.5px solid #4A2080',
              borderRadius: 8,
              padding: '10px 16px',
              color: '#A78BFA',
              fontSize: 12,
              fontWeight: 500,
              cursor: loading !== null ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: loading !== null && loading !== 'email' ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading === 'email' ? (
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px solid rgba(167,139,250,0.3)',
                  borderTopColor: '#A78BFA',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
            ) : (
              'Sign in with email'
            )}
          </button>
        </form>
      </div>

      <p style={{ marginTop: 24, fontSize: 10, color: '#3D2878', textAlign: 'center', maxWidth: 300 }}>
        Access is by invitation only. Contact Ivana to request an invite.
      </p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: '#0D0820', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '3px', color: '#3D2878', textTransform: 'uppercase' }}>Loading…</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
