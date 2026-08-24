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
// Resolution order — Preview MUST be checked first, unconditionally:
//   1. A real Vercel Preview deployment (VERCEL_ENV === 'preview') →
//      ALWAYS use VERCEL_URL (the deployment's own unique hostname, set
//      automatically by Vercel), ignoring NEXT_PUBLIC_APP_URL entirely.
//      This branch has to come before checking the env var override: a
//      first attempt at this fix put the override check first, on the
//      assumption NEXT_PUBLIC_APP_URL would be unset on Preview — but a
//      temporary diagnostic route (GET /api/debug-env, since removed)
//      confirmed it's actually configured for "All Environments" in this
//      Vercel project, explicitly set to https://bkkclubcrawl.com even on
//      Preview. With override-first priority, that meant the "fix" did
//      nothing — verified by decoding the actual deployed QR image
//      (jsQR + pngjs against the real PNG bytes) before AND after, both
//      showing bkkclubcrawl.com. This is the corrected version.
//   2. Anything else (real production, local dev) → NEXT_PUBLIC_APP_URL if
//      set, else the production domain — this is what keeps every REAL
//      transactional email pointing at bkkclubcrawl.com.
//
// Storefront-aware (Stage 10 Phase 5): every existing call site (ticket page,
// QR route, confirmation email) calls this with no argument and gets
// EXACTLY the behavior above, unchanged — 'bcc' is the default. A caller
// that knows the request's resolved storefront (currently only
// create-checkout) can pass it explicitly to get the right return-URL host
// for a BNT-originated checkout. On Preview, storefront is deliberately
// ignored — both storefronts resolve to the SAME Preview deployment's own
// host, so a BNT-storefront Preview checkout can never bounce a tester to
// real production bestnightlifethailand.com (which, pre-cutover, doesn't
// even serve this app). NEXT_PUBLIC_BNT_APP_URL lets the real BNT domain be
// configured later without a code change; the hardcoded fallback is
// aspirational until DNS cutover — harmless today since no traffic reaches
// this branch while new-in-bkk stays Draft/invisible on both storefronts.
export function getAppUrl(storefront: 'bcc' | 'bnt' = 'bcc'): string {
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  if (storefront === 'bnt') {
    return process.env.NEXT_PUBLIC_BNT_APP_URL || 'https://bestnightlifethailand.com'
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://bkkclubcrawl.com'
}
