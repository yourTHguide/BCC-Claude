/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Phase 3F correction: Next.js 14.2's client-side Router Cache reuses a
    // previously-fetched RSC payload for a dynamic route for up to 30s by
    // default, even though every /operator page already sets
    // `export const dynamic = 'force-dynamic'` specifically because it reads
    // live, frequently-changing operational data. That 30s reuse window was
    // the actual root cause of Proposal Preview showing stale (pre-edit)
    // commercial terms: mutations happen via plain fetch() to Route Handlers
    // (not Server Actions), which carries no automatic router-cache
    // invalidation, so a Preview visited once, then revisited within 30s
    // after editing/regenerating the draft on another screen, served the
    // client's stale cached copy instead of asking the server again — even
    // though the underlying Postgres row (and every force-dynamic page that
    // re-renders itself, like the Working Draft screen) was already correct.
    // dynamic: 0 makes every navigation to a dynamic route always re-fetch
    // from the server, matching what `force-dynamic` already signals is the
    // intent everywhere in this app — not a Proposal-Preview-specific patch.
    staleTimes: {
      dynamic: 0,
    },
    // Phase 3G correction: the pdfkit + serverComponentsExternalPackages
    // fix attempted here did NOT resolve "Cannot find module
    // '#standard-fonts/Helvetica'" in the actual deployed Vercel runtime
    // (confirmed by a live retest) — pdfkit itself was replaced with pdf-lib
    // instead (lib/proposalPdf.ts), which needs no external-package bundling
    // workaround at all. This config entry is intentionally gone, not
    // forgotten.
  },
}
module.exports = nextConfig
