import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import BntNewInBangkokPage from '@/components/bnt/BntNewInBangkokPage'
import { resolveStorefront } from '@/lib/storefront'
import { loadPublicProductPage } from '@/lib/publicProductPage'
import { isNibPreviewQaBranch } from '@/lib/previewQaOverride'

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

  // Stage 3A/3B — Preview-only visual-QA exception (lib/previewQaOverride.ts).
  // resolveStorefront() itself is completely untouched: production hostname
  // routing (bestnightlifethailand.com -> 'bnt', bkkclubcrawl.com -> 'bcc',
  // any other host -> 'bcc') is unaffected, and this file never calls
  // resolveStorefront() with anything other than the real Host header above.
  // isNibPreviewQaBranch() is false everywhere except this exact branch's
  // own Preview deployment — see that file for the full explanation. The
  // same helper also gates app/page.tsx and app/about/page.tsx (Stage 3B)
  // so this page's own Home/About links stay on BNT during Preview QA.
  const effectiveStorefront = isNibPreviewQaBranch() ? 'bnt' : storefront

  if (effectiveStorefront !== 'bnt') {
    notFound()
  }

  const data = await loadPublicProductPage('new-in-bkk', effectiveStorefront)
  if (!data) notFound()

  // Stage 3 (Lovable presentation port) — renders the NIB-specific
  // BntNewInBangkokPage instead of the generic ProductPage, from the exact
  // same loadPublicProductPage() data above (same gate, same shape, no
  // second fetch/data layer). BntNewInBangkokPage owns its own header/footer
  // and booking CTAs (all pointing at /book?night=<slug>), so no
  // backHref/backLabel props are needed here the way ProductPage required.
  return <BntNewInBangkokPage {...data} />
}
