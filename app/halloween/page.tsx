import type { Metadata } from 'next'
import Script from 'next/script'
import HalloweenCrawlPage from '@/components/halloween/HalloweenCrawlPage'
import { buildPageMetadata } from '@/lib/seo'

// BEST-branded event page; bkkclubcrawl.com/halloween redirects here.
export const metadata: Metadata = buildPageMetadata('bnt', {
  path: '/halloween',
  title: 'Bangkok Halloween Crawl 2026 | BEST Nightlife Thailand',
  description:
    'Join Bangkok Halloween Crawl 2026 on October 31. A hosted nightlife route with social games, curated venues, group transport and one big Halloween finale.',
  ogDescription: 'A hosted Halloween route through Bangkok with social games, curated venues, transport and a final party stop.',
  image: '/og/halloween.jpg',
  imageAlt: 'Bangkok Halloween Crawl guests on a Bangkok street',
})

export default function Page() {
  return (
    <>
      {/* Loaded once for the whole page — every BokunButton (see HalloweenCrawlPage)
          shares this one booking-channel loader, keyed by unique per-button ids. */}
      <Script
        src="https://widgets.bokun.io/assets/javascripts/apps/build/BokunWidgetsLoader.js?bookingChannelUUID=177041bf-9290-4d5f-b92c-fca9b79e8df5"
        strategy="afterInteractive"
      />
      <HalloweenCrawlPage />
    </>
  )
}
