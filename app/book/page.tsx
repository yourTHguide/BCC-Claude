import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { resolveStorefront } from '@/lib/storefront'
import { brandFor } from '@/lib/storefrontBrand'
import { isNibPreviewQaBranch } from '@/lib/previewQaOverride'
import BookingCalendarClient from './BookingCalendarClient'

export const dynamic = 'force-dynamic'

// Storefront-aware metadata, same generateMetadata-per-request pattern
// app/page.tsx already uses for the homepage. Without this override, /book
// fell back to the root layout's static, BCC-branded <title>/description/OG
// on every host, including bestnightlifethailand.com — the actual checkout
// page New in Bangkok customers land on. The BNT branch sources its brand
// name from lib/storefrontBrand.ts (the existing single source of truth for
// per-storefront presentation facts) rather than re-hardcoding it here. The
// BCC branch restates the layout's existing values verbatim — an empty
// object wouldn't fall back to them, it would blank the title — so BCC's
// metadata is byte-for-byte unchanged.
export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('host')
  const storefront = resolveStorefront(host)

  if (storefront === 'bnt') {
    const brand = brandFor(storefront)
    const title = `Book | ${brand.shortName}`
    const description = `Select your date and book your night with ${brand.name}.`
    return {
      title,
      description,
      // openGraph must be set explicitly too, not just title/description —
      // Next.js merges an unset field from the parent layout's static
      // metadata rather than leaving it blank, so omitting this would still
      // leak the root layout's BCC og:title/og:description/og:url into any
      // BNT /book link shared on WhatsApp, iMessage, etc.
      openGraph: {
        title,
        description,
        url: `https://${brand.siteDomain}/book`,
        type: 'website',
      },
    }
  }

  return {
    title: 'Bangkok Club Crawl — Bangkok Nights. Done Right.',
    description:
      'Premium structured nightlife experience in Bangkok. Curated venues, VIP entry, and dedicated hosts every weekend.',
    openGraph: {
      title: 'Bangkok Club Crawl — Bangkok Nights. Done Right.',
      description: 'Curated venues. VIP entry. A crowd worth meeting.',
      url: 'https://bkkclubcrawl.com',
      type: 'website',
    },
  }
}

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
  // isNibPreviewQaBranch() is temporary Stage 3A/3B/5B Preview-QA scaffolding
  // (lib/previewQaOverride.ts) — always false in Production and on every
  // other Preview branch, so this never changes real bkkclubcrawl.com/
  // bestnightlifethailand.com behavior. Lets this branch's Preview exercise
  // the real BNT booking flow for New in Bangkok end-to-end.
  const storefront = isNibPreviewQaBranch() ? 'bnt' : resolveStorefront(host)
  return <BookingCalendarClient storefront={storefront} />
}
