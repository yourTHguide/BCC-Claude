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
    // Phase 3F correction: pdfkit's Node entry point resolves its 14
    // standard PDF fonts (Helvetica, Times, Courier, ...) through Node's
    // package.json `imports` field (`#standard-fonts/*`) rather than plain
    // relative requires. Next's webpack bundling of a Route Handler doesn't
    // preserve/trace that resolution correctly, which crashed
    // Finalize & Generate PDF on Vercel with
    // "Cannot find module '#standard-fonts/Helvetica'". Marking pdfkit as an
    // external package tells Next to leave require()/import() calls for it
    // untouched instead of bundling it, so Node's own module resolver (which
    // understands package.json `imports`) handles it at runtime, and
    // Vercel's file tracer includes the whole package — including every
    // standard-fonts/*.cjs file pdfkit already ships — in the deployed
    // function. No font files were added to this repo; nothing needed to be.
    serverComponentsExternalPackages: ['pdfkit'],
  },
}
module.exports = nextConfig
