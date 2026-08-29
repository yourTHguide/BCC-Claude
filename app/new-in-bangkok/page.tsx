import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import BntNewInBangkokPage from '@/components/bnt/BntNewInBangkokPage'
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

  // Stage 3A — Preview-only visual-QA exception, LOCAL TO THIS ROUTE.
  // resolveStorefront() itself is completely untouched: production hostname
  // routing (bestnightlifethailand.com -> 'bnt', bkkclubcrawl.com -> 'bcc',
  // any other host -> 'bcc') is unaffected, and this file never calls
  // resolveStorefront() with anything other than the real Host header above.
  //
  // Vercel serves this feature branch's Preview deployment from a
  // *.vercel.app hostname, which resolveStorefront() correctly does NOT
  // recognize as BNT — and must not: a blanket "*.vercel.app -> bnt" rule
  // would misclassify every OTHER Preview deployment this app will ever
  // have, including main's own. Instead this is a narrow, dual-keyed
  // exception that only evaluates true when BOTH hold simultaneously:
  //   1. VERCEL_ENV === 'preview' — never true in Production, where Vercel
  //      always sets this to 'production'.
  //   2. VERCEL_GIT_COMMIT_REF === this exact branch name — never true for
  //      any other branch's Preview build.
  // Both are Vercel System Environment Variables this project already reads
  // server-side elsewhere (lib/appUrl.ts's VERCEL_ENV/VERCEL_URL check), so
  // this relies on no new infrastructure. Remove this block once visual QA
  // on this branch is done and before merging to main.
  const isThisPreviewBranch =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.VERCEL_GIT_COMMIT_REF === 'claude/new-in-bangkok-lovable-port'
  const effectiveStorefront = isThisPreviewBranch ? 'bnt' : storefront

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
