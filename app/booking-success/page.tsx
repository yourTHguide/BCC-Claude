import { headers } from 'next/headers'
import { resolveStorefront } from '@/lib/storefront'
import { isNibPreviewQaBranch } from '@/lib/previewQaOverride'
import BookingSuccessClient from './BookingSuccessClient'

export const dynamic = 'force-dynamic'

// Storefront-aware (Stage 10 Phase 6). Same server/client split as
// app/book/page.tsx — resolves storefront from the request's own Host
// header and passes it down as a prop, purely for BRAND PRESENTATION
// (logo, copy, support links). This is not a purchase-security boundary:
// the booking itself was already created (and its own storefront persisted)
// by create-checkout/webhook, independently, before the customer ever lands
// here. bkkclubcrawl.com resolves 'bcc' exactly as this page's content
// always implicitly was — zero behavior change for BCC.
export default function BookingSuccessPage() {
  const host = headers().get('host')
  // isNibPreviewQaBranch() is temporary Stage 3A/3B/5B/5C Preview-QA
  // scaffolding (lib/previewQaOverride.ts) — always false in Production and
  // on every other Preview branch. Lets this branch's Preview render the
  // BNT success-page color treatment for visual verification.
  const storefront = isNibPreviewQaBranch() ? 'bnt' : resolveStorefront(host)
  return <BookingSuccessClient storefront={storefront} />
}
