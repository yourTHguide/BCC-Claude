import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import ConsentManager from '@/components/consent/ConsentManager'
import { META_PIXEL_ID, earlyPixelScript } from '@/lib/consentConfig'
import { headers } from 'next/headers'
import { resolveStorefront } from '@/lib/storefront'
import { buildPageMetadata, CANONICAL_ORIGIN, isIndexableHost, organizationJsonLd } from '@/lib/seo'
import './globals.css'


// Hosts where advertising tracking may run (after consent). Previews,
// bcc-claude.vercel.app and local development never load the pixel.
const PRODUCTION_HOSTS = new Set([
  'bestnightlifethailand.com',
  'www.bestnightlifethailand.com',
  'www.bkkclubcrawl.com',
  'bkkclubcrawl.com',
])

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

// Host-aware defaults (Nov 2026 SEO Phase 1). Previously a static,
// BCC-branded export, which leaked BCC Open Graph tags onto every BEST page
// that didn't override them. Pages still set their own title/canonical via
// buildPageMetadata(); this is the fallback plus metadataBase and robots.
export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('host')
  const storefront = resolveStorefront(host)
  const base = buildPageMetadata(storefront, { path: '/' })
  // Canonical is per-page — never inherit the homepage canonical.
  delete base.alternates
  return {
    ...base,
    metadataBase: new URL(CANONICAL_ORIGIN[storefront]),
    // Non-production deployments and non-preferred hosts (e.g.
    // bcc-claude.vercel.app) are never indexed.
    ...(isIndexableHost(host) ? {} : { robots: { index: false, follow: false } }),
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The same pixel (302051565703286) is shared across both storefronts so Meta
  // retains the existing BCC signal history. Event rules scoped to
  // bestnightlifethailand.com distinguish New in Bangkok via content_id.
  //
  // Pre-release review (Nov 2026): the pixel is no longer in the server HTML.
  // ConsentManager loads it in the browser only after the visitor accepts,
  // only on the production domains (never previews or *.vercel.app), and
  // never on staff, ticket or unsubscribe pages. There is no <noscript>
  // fallback: visitors without JavaScript can't consent, so they aren't
  // tracked (the old fallback also leaked token URLs and double-counted
  // PageViews through React's image preload).
  const host = headers().get('host')
  const storefront = resolveStorefront(host)
  const trackingHost = PRODUCTION_HOSTS.has((host ?? '').toLowerCase().split(':')[0])

  return (
    <html lang="en">
      {trackingHost && (
        <head>
          {/* Loads Meta only for visitors who already accepted (cookie); see lib/consentConfig.ts. */}
          <Script id="meta-pixel-consented" strategy="beforeInteractive">
            {earlyPixelScript()}
          </Script>
        </head>
      )}
      <body style={{ overflowX: 'hidden', maxWidth: '100vw' }}>
        <script
          type="application/ld+json"
          // Static, server-built object — no user input reaches it.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(storefront)) }}
        />
        {children}
        <ConsentManager brand={storefront} trackingHost={trackingHost} pixelId={META_PIXEL_ID} />
      </body>
    </html>
  )
}
