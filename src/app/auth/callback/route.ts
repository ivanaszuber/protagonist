import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const next = searchParams.get('next') ?? '/dashboard'

  if (error) {
    console.error('[auth/callback] OAuth error:', error)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !data.user) {
    console.error('[auth/callback] Exchange error:', exchangeError)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // ── Invite check ─────────────────────────────────────────────────────────
  // Use the admin (service-role) client so RLS doesn't block the lookup.
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: allowed } = await adminClient
    .from('allowed_emails')
    .select('email')
    .eq('email', data.user.email?.toLowerCase() ?? '')
    .maybeSingle()

  if (!allowed) {
    // Sign out the uninvited user and return a clear error
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=not_invited`)
  }

  // ── Upsert profile ────────────────────────────────────────────────────────
  await adminClient.from('profiles').upsert(
    {
      id: data.user.id,
      email: data.user.email,
      display_name:
        data.user.user_metadata?.full_name ??
        data.user.user_metadata?.name ??
        data.user.email?.split('@')[0] ??
        'Protagonist',
      avatar_url: data.user.user_metadata?.avatar_url ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  // Redirect to the original destination (or /dashboard)
  return NextResponse.redirect(`${origin}${next}`)
}
