import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { headers } from 'next/headers'
import { resolveStorefront } from '@/lib/storefront'
import './globals.css'

const META_PIXEL_ID = '302051565703286'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Bangkok Club Crawl — Bangkok Nights. Done Right.',
  description: 'Premium structured nightlife experience in Bangkok. Curated venues, VIP entry, and dedicated hosts every weekend.',
  openGraph: {
    title: 'Bangkok Club Crawl — Bangkok Nights. Done Right.',
    description: 'Curated venues. VIP entry. A crowd worth meeting.',
    url: 'https://bkkclubcrawl.com',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // BNT pages (Stage 10) carry no Meta Pixel of their own in the live
  // NightlifeAntigravity source — this pixel ID belongs to Bangkok Club
  // Crawl specifically, so it must not fire (and misattribute traffic) on
  // bestnightlifethailand.com.
  const host = headers().get('host')
  const isBcc = resolveStorefront(host) === 'bcc'

  return (
    <html lang="en">
      <head>
        {isBcc && (
          /* Meta Pixel base code — loads before the page becomes interactive so the
             ViewContent/InitiateCheckout/Purchase/SelectNight fbq() calls already
             wired into the components below actually have something to fire into. */
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
        {isBcc && (
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
        {children}
      </body>
    </html>
  )
}
