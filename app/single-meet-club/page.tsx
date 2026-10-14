import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import SmcLandingPage from '@/components/smc/SmcLandingPage'
import { canRenderSmcPage, smcPageIndexable } from '@/lib/smc/env'
import { loadNextSmcEvent } from '@/lib/smc/event'

export const dynamic = 'force-dynamic'

// Single Meet Club landing page — BNT storefront only, held behind the
// SMC_PAGE_PUBLISHED environment variable on production; always renders on
// Preview / local dev. Indexable only once published on production.
// The rule lives in lib/smc/env.ts so every SMC page applies the same gate.

const TITLE = 'Single Meet Club | Bangkok Singles Social Night'
const DESCRIPTION =
  "A monthly social night in Bangkok where everyone happens to be single. The last Thursday of every month at Tony's, Sukhumvit Soi 11."
const URL = 'https://www.bestnightlifethailand.com/single-meet-club'

// openGraph is set explicitly — otherwise Next.js merges the root layout's
// BCC-branded og:title/og:url into shared SMC links.
export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: URL },
    openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: 'website' },
    robots: smcPageIndexable() ? { index: true, follow: true } : { index: false, follow: false },
  }
}

export default async function SingleMeetClubPage() {
  if (!canRenderSmcPage()) notFound()
  return <SmcLandingPage next={await loadNextSmcEvent()} />
}
