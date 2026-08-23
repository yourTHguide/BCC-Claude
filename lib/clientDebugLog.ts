'use client'

// TEMPORARY -- diagnosing the real-iPhone /dashboard/checkin/[token] crash
// (PHASE4_CHECKPOINT.md Stage 9). Fires a best-effort, non-blocking POST to
// /api/debug-client-log so a breadcrumb survives even if the page crashes
// immediately after. keepalive keeps the request alive through a page
// teardown. Never throws -- a logging call must not itself cause a crash.
// Delete alongside /api/debug-client-log once the real root cause is found.
export function clientDebugLog(event: string, data?: Record<string, unknown>) {
  try {
    fetch('/api/debug-client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        data,
        ts: Date.now(),
        path: typeof window !== 'undefined' ? window.location.pathname : null,
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // never throw from a logging call
  }
}

// Preview/dev only -- never show raw error detail on the real production
// domain. bkkclubcrawl.com is the only production hostname; every Preview
// deployment is a *.vercel.app hostname.
export function isDiagnosticEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname !== 'bkkclubcrawl.com'
}
