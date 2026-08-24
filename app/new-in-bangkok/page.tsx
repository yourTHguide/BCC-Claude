import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ProductPage from '@/components/ProductPage'
import { resolveStorefront } from '@/lib/storefront'
import { loadPublicProductPage } from '@/lib/publicProductPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'New in Bangkok | BEST NIGHTLIFE THAILAND',
}

// Canonical public alias for the 'new-in-bkk' Product (Stage 10 Phase 4).
// Replaces a stale, fully hardcoded page that used to live at this same path
// (Tuesday->should've-been-Wednesday copy, a ฿1,000 price that never matched
// the canonical Supabase product, and the legacy /book?night=new-in-bangkok
// checkout lifecycle with no eventId/ticket/QR lifecycle at all) — see
// PHASE4_CHECKPOINT.md for the full audit. There is now exactly one
// customer-facing "New in Bangkok" implementation: this route, sourcing
// 100% of its content/price/schedule from products + product_content +
// event_dates via the same loadPublicProductPage() gate /events/[slug] uses.
//
// Only resolves on the BNT storefront (bestnightlifethailand.com) — this is
// New in Bangkok's intended public home. Any other host (bkkclubcrawl.com
// included) 404s here rather than serving the old hardcoded content; the
// canonical product also remains reachable internally at
// /events/new-in-bkk regardless of host, gated the same way.
//
// Fails closed exactly like /events/[slug]: 'new-in-bkk' is currently
// status='draft' with visible_bnt=false, so this 404s for every real visitor
// today, by design — do not weaken this gate to "preview" the page. Use the
// existing admin-authed /dashboard/products/[id]/preview instead.
export default async function NewInBangkokPage() {
  const host = headers().get('host')
  const storefront = resolveStorefront(host)

  if (storefront !== 'bnt') {
    notFound()
  }

  const data = await loadPublicProductPage('new-in-bkk', storefront)
  if (!data) notFound()

  return <ProductPage {...data} mode="public" />
}
