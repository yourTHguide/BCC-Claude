import { headers } from 'next/headers'
import { resolveStorefront } from '@/lib/storefront'
import BookingCalendarClient from './BookingCalendarClient'

export const dynamic = 'force-dynamic'

// Storefront-aware (Stage 10 Phase 5). Resolves the request's storefront
// server-side from its own Host header — the same resolveStorefront() every
// other public route uses (/, /about, /contact, /events/[slug],
// /new-in-bangkok) — and passes it down as a prop to the client calendar,
// which uses it only to pick which /api/events visibility column to list.
// This does NOT make /book itself a purchase-security boundary: the real
// gate is create-checkout independently re-resolving storefront from its
// OWN request's Host header, so nothing this page passes down can be used
// to buy something the requesting host isn't allowed to sell.
//
// bkkclubcrawl.com resolves 'bcc' here exactly as it always implicitly did
// (the fetch used to hardcode ?storefront=bcc) — zero behavior change for
// BCC. bestnightlifethailand.com now resolves 'bnt' and lists BNT-visible
// events instead of always listing BCC's, fixing the gap Phase 4's
// checkpoint flagged ("/book's checkout flow is still BCC-storefront-
// hardcoded"). The page's visual chrome (BCC logo/nav) is unchanged this
// session — see PHASE4_CHECKPOINT.md's Phase 5 entry for why that's
// deliberately out of scope right now (new-in-bkk stays Draft/invisible on
// both storefronts throughout Phase 5, so no real BNT visitor can reach
// this page yet either way).
export default function BookPage() {
  const host = headers().get('host')
  const storefront = resolveStorefront(host)
  return <BookingCalendarClient storefront={storefront} />
}
