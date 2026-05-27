import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass through public routes — login, auth callback, static assets
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico'

  if (isPublic) return NextResponse.next()

  // Build a mutable response we can attach cookies to
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write updated auth cookies to both request and response
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() refreshes the session token if needed
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Not authenticated — redirect to /login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Preserve the original destination so we can redirect back after login
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Keep protagonist_user_id cookie in sync with the Supabase auth UUID.
  // This lets the existing getUserId() helper work without any changes —
  // it reads this cookie and returns the real auth user ID.
  response.cookies.set('protagonist_user_id', user.id, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false, // must be readable by client JS
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, icons, manifests, images
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
