import { createBrowserClient } from '@supabase/ssr'

// Browser Supabase client for Supabase Auth (Stage 1+). Anon key only — the
// service role is never exposed to the browser. Used by the /login page and any
// client component that needs the current session.
//
// Not imported anywhere yet — scaffolding for the Stage 1 auth boundary.
export function createClientSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
