/** @type {import('next').NextConfig} */
const nextConfig = {
  // Perf: let browsers keep site images for a day (and reuse them for a week
  // while quietly re-checking), so repeat visitors don't re-download every
  // photo. Keeps Vercel Fast Data Transfer down on the Hobby plan.
  // Retired themed nights (removed Nov 2026): their old pages send visitors
  // to the main crawl page. Permanent so search engines drop the old URLs.
  async redirects() {
    const retired = ['girls-night', 'solo-night', 'nomad-nights', '30plus-night', 'lgbtplus-night'].map((slug) => ({
      source: `/${slug}`,
      destination: '/',
      permanent: true,
    }))

    // Nov 2026 SEO Phase 1 — one canonical home per page across the two
    // storefronts this app serves. Preferred hosts:
    //   BEST: https://bestnightlifethailand.com   (apex)
    //   BCC:  https://www.bkkclubcrawl.com        (www; the apex -> www hop
    //         is a Vercel domain redirect, not code)
    // All 308 (permanent, method-preserving). /api/* is never redirected, so
    // Stripe webhooks and checkout calls are untouched; query strings carry
    // over automatically.
    const BEST_HOSTS = '(www\\.)?bestnightlifethailand\\.com'
    const BCC_HOSTS = '(www\\.)?bkkclubcrawl\\.com'
    const BEST = 'https://bestnightlifethailand.com'
    const BCC = 'https://www.bkkclubcrawl.com'

    // BCC product pages that BEST used to serve as duplicates.
    const bccOnBest = ['/weekends', '/tgif', '/saturday-signature'].map((path) => ({
      source: path,
      has: [{ type: 'host', value: BEST_HOSTS }],
      destination: `${BCC}${path}`,
      permanent: true,
    }))

    // BEST-exclusive pages requested on the BCC host go to BEST.
    const bestOnBcc = ['/halloween', '/new-in-bangkok', '/single-meet-club/:path*'].map((path) => ({
      source: path,
      has: [{ type: 'host', value: BCC_HOSTS }],
      destination: `${BEST}${path}`,
      permanent: true,
    }))

    // www.bestnightlifethailand.com -> apex, everything except /api.
    const bestWww = {
      source: '/:path((?!api/).*)',
      has: [{ type: 'host', value: 'www.bestnightlifethailand.com' }],
      destination: `${BEST}/:path`,
      permanent: true,
    }

    return [...bccOnBest, ...bestOnBcc, bestWww, ...retired]
  },
  async headers() {
    return [
      // The project's production *.vercel.app alias serves the BCC site;
      // keep it out of search so it can't compete with www.bkkclubcrawl.com.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'bcc-claude\\.vercel\\.app' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/:all*(jpg|jpeg|png|webp|gif|svg)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ]
  },
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

    // Phase 4 — Thai PDF fonts (lib/proposalPdf.ts) are read at request time
    // via fs.readFile(path.join(process.cwd(), 'assets', 'fonts', 'sarabun',
    // ...)), not imported/required, so Vercel's build-time output file
    // tracing can't discover them purely by following require()/import
    // graphs the way it does for node_modules code — this repo already has
    // one prior real incident (the pdfkit failure noted above) from a
    // font-loading mechanism that worked locally but silently wasn't
    // included in the deployed function. Explicit belt-and-braces:
    // guarantees assets/fonts/sarabun/** ships in every serverless function
    // that can reach renderProposalPdf() (currently only the Finalize
    // route), regardless of NFT's own static analysis of the dynamic
    // path.join() call. (outputFileTracingIncludes is still an
    // `experimental` key on Next.js 14.2 — it only moved to a stable
    // top-level key in Next.js 15.)
    outputFileTracingIncludes: {
      '/api/admin/proposals/**': ['./assets/fonts/sarabun/**/*'],
    },
  },
}
module.exports = nextConfig
