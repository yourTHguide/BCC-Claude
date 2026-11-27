import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import ConsentManager from '@/components/consent/ConsentManager'
import { META_PIXEL_ID, earlyPixelScript, isProductionHost } from '@/lib/consentConfig'
import { PRIVACY_PATH, privacyAvailable } from '@/lib/privacy/publish'
import { headers } from 'next/headers'
import { resolveStorefront } from '@/lib/storefront'
import { buildPageMetadata, CANONICAL_ORIGIN, isIndexableHost, organizationJsonLd } from '@/lib/seo'
import './globals.css'



export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom allowed (accessibility, WCAG 1.4.4). Form fields are 16px+
  // so iOS Safari doesn't auto-zoom when one is focused.
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
    // Brand logo as the browser tab icon and home-screen app icon.
    icons: {
      icon: [
        { url: `/icons/${storefront}-32.png?v=2`, sizes: '32x32', type: 'image/png' },
        { url: `/icons/${storefront}-192.png?v=2`, sizes: '192x192', type: 'image/png' },
      ],
      apple: [{ url: `/icons/${storefront}-apple.png?v=2`, sizes: '180x180' }],
    },
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: storefront === 'bnt' ? 'BEST Nightlife' : 'Bangkok Club Crawl', statusBarStyle: 'black' },
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
  const trackingHost = isProductionHost(host)
  const privacyHref = privacyAvailable(host, storefront) ? PRIVACY_PATH : null

  return (
    <html lang="en">
      <head>
        {/* Self-hosted fonts (same files Google Fonts served; no request to Google). */}
        <link rel="stylesheet" href="/fonts/google-fonts-base.css" />
        {trackingHost && (
          /* Loads Meta only for visitors who already accepted (cookie); see lib/consentConfig.ts. */
          <Script id="meta-pixel-consented" strategy="beforeInteractive">
            {earlyPixelScript()}
          </Script>
        )}
      </head>
      <body style={{ overflowX: 'hidden', maxWidth: '100vw' }} data-privacy-href={privacyHref ?? undefined}>
        <script
          type="application/ld+json"
          // Static, server-built object — no user input reaches it.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(storefront)) }}
        />
        {children}
        <ConsentManager brand={storefront} trackingHost={trackingHost} pixelId={META_PIXEL_ID} privacyHref={privacyHref} />
      </body>
    </html>
  )
}
