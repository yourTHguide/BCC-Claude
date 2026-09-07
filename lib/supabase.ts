import { createClient } from '@supabase/supabase-js'

// Client-side (anon key) — created lazily. Previously this was instantiated
// eagerly at module scope, which meant simply importing this file (e.g. to
// use getServiceSupabase) ran createClient() during Next.js's build-time
// "collecting page data" step, before env vars are guaranteed to be present —
// crashing the whole production build. Lazy init defers it to actual runtime use.
let _client: ReturnType<typeof createClient> | undefined

function getClient() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const client = getClient() as any
    const val = client[prop]
    return typeof val === 'function' ? val.bind(client) : val
  },
})

// Server-side (service role — never expose to client)
//
// Phase 3F correction: every server read in this app goes through this
// client, and its requests were subject to Next.js's automatic fetch
// caching heuristics (governed by each route's `dynamic`/`staleTimes`
// config) — which proved unreliable for exactly the case that matters most
// here: a page rendered immediately after a mutation made on a *different*
// page (e.g. Proposal Preview, opened right after Save Terms + Regenerate
// Draft on the Working Draft screen, rendering a draft_revision that
// predated those edits — confirmed live: the Postgres row was already at
// revision 3 with the correct terms, but the Preview page's server render
// used stale data). `staleTimes.dynamic = 0` (next.config.js) was meant to
// close this and didn't fully. Passing an explicit `cache: 'no-store'` on
// every request this client makes is the authoritative, lowest-level fix —
// it tells the fetch layer directly never to cache, independent of
// per-route config or any staleTimes edge case.
export function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
      },
    }
  )
}
