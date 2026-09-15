import type { Metadata } from 'next'
import Script from 'next/script'
import HalloweenCrawlPage from '@/components/halloween/HalloweenCrawlPage'

export const metadata: Metadata = {
  title: 'Bangkok Halloween Crawl 2026 | BEST Nightlife Thailand',
  description:
    'Join Bangkok Halloween Crawl 2026 on October 31. A hosted nightlife route with social games, curated venues, group transport and one big Halloween finale.',
  openGraph: {
    title: 'Bangkok Halloween Crawl 2026 | BEST Nightlife Thailand',
    description: 'A hosted Halloween route through Bangkok with social games, curated venues, transport and a final party stop.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

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
