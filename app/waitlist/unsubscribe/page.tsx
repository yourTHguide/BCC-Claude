import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { resolveStorefront } from '@/lib/storefront'
import { brandFor } from '@/lib/storefrontBrand'
import UnsubscribeClient from './UnsubscribeClient'

export const dynamic = 'force-dynamic'

// Same page for both brands' waitlists (Phase 3B): the token identifies one
// sign-up row only (one product, or one Club Crawl date), so unsubscribing
// never touches any other list. Only the brand name shown changes by host.
export async function generateMetadata(): Promise<Metadata> {
  const brand = brandFor(resolveStorefront(headers().get('host')))
  return { title: `Unsubscribe · ${brand.name}`, robots: { index: false, follow: false } }
}

export default function UnsubscribePage({ searchParams }: { searchParams: { token?: string } }) {
  const storefront = resolveStorefront(headers().get('host'))
  return <UnsubscribeClient token={searchParams.token || ''} brandName={brandFor(storefront).name} />
}
