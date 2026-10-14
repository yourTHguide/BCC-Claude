import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import SmcLandingPage from '@/components/smc/SmcLandingPage'
import { canRenderSmcPage, smcPageIndexable } from '@/lib/smc/env'

export const dynamic = 'force-dynamic'

// Single Meet Club landing page — BNT storefront only, held behind the
// SMC_PAGE_PUBLISHED environment variable on production; always renders on
// Preview / local dev. Indexable only once published on production.
// The rule lives in lib/smc/env.ts so every SMC page applies the same gate.

const TITLE = 'Single Meet Club | Bangkok Singles Social Night'
const DESCRIPTION =
  'A monthly social night in Bangkok where everyone happens to be single. Halloween Edition, Thursday 29 October at Tony\'s, Sukhumvit Soi 11. No Tricks. Just Chemistry.'
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

export default function SingleMeetClubPage() {
  if (!canRenderSmcPage()) notFound()
  return <SmcLandingPage />
}
