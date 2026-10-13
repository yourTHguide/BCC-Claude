import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import SmcLandingPage from '@/components/smc/SmcLandingPage'
import { SMC_PAGE_PUBLISHED } from '@/lib/smc/config'
import { canRenderSmcPage } from '@/lib/smc/env'

export const dynamic = 'force-dynamic'

// Single Meet Club landing page — BNT storefront only, held behind
// SMC_PAGE_PUBLISHED on production; always renders on Preview / local dev.
// The rule lives in lib/smc/env.ts so every SMC page applies the same gate.

const TITLE = 'Single Meet Club | Bangkok Singles Social Night'
const DESCRIPTION =
  'A monthly social night in Bangkok where everyone happens to be single. Not speed dating. Good people. Great nights.'

// openGraph is set explicitly — otherwise Next.js merges the root layout's
// BCC-branded og:title/og:url into shared SMC links.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://www.bestnightlifethailand.com/single-meet-club',
    type: 'website',
  },
  robots: SMC_PAGE_PUBLISHED ? undefined : { index: false, follow: false },
}

export default function SingleMeetClubPage() {
  if (!canRenderSmcPage()) notFound()
  return <SmcLandingPage />
}
