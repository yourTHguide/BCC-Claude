import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cookie-bound Supabase client for Supabase Auth (Stage 1+). Reads the signed-in
// user's session from request cookies and uses the ANON key — the user's JWT and
// RLS govern access. This is NEVER the service role: privileged writes stay in
// getServiceSupabase() (lib/supabase.ts) and run only AFTER an admin
// authorization check (see lib/admin-auth.ts).
//
// Not imported anywhere yet — scaffolding for the Stage 1 auth boundary.
export function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // In a Server Component cookies() is read-only and this throws; that's
          // fine — the Stage 1 middleware refreshes the session cookie on the
          // next request. In Route Handlers / Server Actions the writes apply.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            /* read-only context; safe to ignore */
          }
        },
      },
    }
  )
}
