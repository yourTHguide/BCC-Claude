import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { resolveStorefront } from '@/lib/storefront'
import BntAboutPage from '@/components/bnt/BntAboutPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'The Heart behind the Night. | BEST NIGHTLIFE THAILAND',
}

// bkkclubcrawl.com has no /about page today, so this route only exists for
// the BNT storefront — fail closed (404) for any other host rather than
// exposing BNT content as a de facto BCC page.
export default function AboutPage() {
  const host = headers().get('host')
  if (resolveStorefront(host) !== 'bnt') {
    notFound()
  }
  return <BntAboutPage />
}
