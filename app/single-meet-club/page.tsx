import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import SmcLandingPage from '@/components/smc/SmcLandingPage'
import { resolveStorefront } from '@/lib/storefront'
import { SMC_PAGE_PUBLISHED } from '@/lib/smc/config'

export const dynamic = 'force-dynamic'

// Single Meet Club landing page — BNT storefront only (same host gate as
// /new-in-bangkok), and additionally held behind SMC_PAGE_PUBLISHED so it
// 404s on production until launch. Vercel Preview and local dev always
// render it, because preview hosts resolve to the 'bcc' storefront and the
// page would otherwise be unreviewable before merge. This gate is local to
// this route — lib/storefront.ts is deliberately left untouched.
function canRender(): boolean {
  if (process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development') {
    return true
  }
  return SMC_PAGE_PUBLISHED && resolveStorefront(headers().get('host')) === 'bnt'
}

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
  if (!canRender()) notFound()
  return <SmcLandingPage />
}
