import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
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
    // Dashboard: no session -> send to /login (preserving intended path).
    if (pathname.startsWith('/dashboard')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

// Authorization (admin_users membership) is enforced in the dashboard layout and
// requireAdmin(); middleware only enforces authentication on these two subtrees.
export const config = {
  matcher: ['/dashboard/:path*', '/api/admin/:path*'],
}
