import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Stage 9j: forwards the current path to Server Components (read via
  // headers() in app/dashboard/layout.tsx) — App Router layouts have no
  // other way to know the requested pathname of a nested route. Used only
  // for the staff-role landing redirect; carries no auth information itself.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session cookie AND authenticates the request. Do not run
  // logic between createServerClient and getUser (Supabase SSR guidance).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user) {
    // API: no session -> 401 (never reaches the handler).
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Dashboard / Operator: no session -> send to /login (preserving intended path).
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/operator')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

// Authorization (admin_users membership) is enforced in the dashboard/operator
// layouts and requireAdmin(); middleware only enforces authentication on these
// subtrees. /operator (SNX Operator OS Phase 1) reuses the exact same
// authentication pattern as /dashboard — see app/operator/layout.tsx for the
// membership + role gate.
export const config = {
  matcher: ['/dashboard/:path*', '/operator/:path*', '/api/admin/:path*'],
}
