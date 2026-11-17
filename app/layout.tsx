import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { headers } from 'next/headers'
import { resolveStorefront } from '@/lib/storefront'
import { buildPageMetadata, CANONICAL_ORIGIN, isIndexableHost, organizationJsonLd } from '@/lib/seo'
import './globals.css'

const META_PIXEL_ID = '302051565703286'

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
  // retains the existing BCC signal history while we extend tracking to BNT.
  // Event rules scoped to bestnightlifethailand.com (ViewContent, InitiateCheckout,
  // Purchase) distinguish New in Bangkok traffic via content_id: new-in-bkk.
  const host = headers().get('host')
  const storefront = resolveStorefront(host)
  const hasPixel = storefront === 'bcc' || storefront === 'bnt'

  return (
    <html lang="en">
      <head>
        {hasPixel && (
          /* Meta Pixel base code — fires on both bkkclubcrawl.com and
             bestnightlifethailand.com. URL/button event rules in Meta Events
             Manager distinguish BCC vs BNT conversions by domain + content_id. */
          <Script id="meta-pixel" strategy="beforeInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
        )}
      </head>
      <body style={{ overflowX: 'hidden', maxWidth: '100vw' }}>
        {hasPixel && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}
        <script
          type="application/ld+json"
          // Static, server-built object — no user input reaches it.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(storefront)) }}
        />
        {children}
      </body>
    </html>
  )
}
