import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { resolveStorefront } from '@/lib/storefront'
import { isNibPreviewQaBranch } from '@/lib/previewQaOverride'
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
  // isNibPreviewQaBranch() is temporary Stage 3A/3B Preview-QA scaffolding
  // (lib/previewQaOverride.ts) — always false in Production, so this
  // doesn't weaken the real bkkclubcrawl.com/other-host 404 gate below.
  if (resolveStorefront(host) !== 'bnt' && !isNibPreviewQaBranch()) {
    notFound()
  }
  return <BntAboutPage />
}
