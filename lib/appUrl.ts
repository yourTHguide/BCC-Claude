// Canonical base URL for customer-facing links (tickets, QR check-in URLs,
// confirmation emails) — server-side only (reads non-public Vercel env vars).
//
// Root cause this fixes (Stage 9, found via a real device test): every
// caller previously hardcoded `process.env.NEXT_PUBLIC_APP_URL ||
// 'https://bkkclubcrawl.com'`, so EVERY environment — including a Stage 9
// feature-branch Preview deployment, before this code is merged to main —
// generated a QR/ticket link pointing at production. Scanning that QR from
// a preview build's own ticket page therefore hit
// `bkkclubcrawl.com/dashboard/checkin/[token]`, a route that doesn't exist
// there yet (not merged) — a 404 at best, and on the real device it
// surfaced as a client-side exception instead. This made the entire
// scan→check-in flow untestable pre-merge, by construction.
//
// Resolution order:
//   1. NEXT_PUBLIC_APP_URL, if explicitly set — manual override, always wins.
//   2. Vercel's own "production" environment (VERCEL_ENV) → the real
//      customer domain. This is what keeps every REAL transactional email
//      pointing at bkkclubcrawl.com, never a preview hostname — required
//      regardless of how this function is implemented.
//   3. Any OTHER Vercel environment (Preview) → VERCEL_URL, the current
//      deployment's own unique hostname (Vercel sets this automatically on
//      every deployment) — makes a Preview build's tickets/QR self-
//      consistent and actually scannable/testable against ITSELF.
//   4. Local dev / anything else → the production domain (harmless
//      default; matches the previous unconditional fallback).
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_ENV === 'production') return 'https://bkkclubcrawl.com'
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'https://bkkclubcrawl.com'
}
