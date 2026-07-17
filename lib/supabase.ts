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
export function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
