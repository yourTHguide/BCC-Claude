import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ProductPage from '@/components/ProductPage'
import { resolveStorefront } from '@/lib/storefront'
import { loadPublicProductPage } from '@/lib/publicProductPage'
import { brandFor } from '@/lib/storefrontBrand'
import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo'
import { cache } from 'react'

// One DB load per request, shared by generateMetadata and the page.
const loadProductPage = cache(loadPublicProductPage)

export const dynamic = 'force-dynamic'

// Public Product Page (Stage 8e/8g; made storefront-aware in Stage 10 Phase
// 4). Fails closed: a Product must exist, be status='active', AND
// visible_<storefront>=true for whichever storefront the request's Host
// header resolves to (bkkclubcrawl.com -> visible_bcc, unchanged behavior;
// bestnightlifethailand.com -> visible_bnt, new) — otherwise this route must
// not reveal that the slug exists at all, so every failure path is a plain
// 404, not a distinguishable error. Shares its query logic with
// /new-in-bangkok via lib/publicProductPage.ts so the two routes can never
// drift out of sync on what "canonical and visible" means.
// Nov 2026 SEO Phase 1. Generic DB-driven product pages duplicate each
// product's dedicated landing page, so their canonical points there and they
// are left out of the sitemaps. Unknown/hidden slugs fall through to the
// page's own notFound().
const DEDICATED_PAGE: Record<string, string> = {
  'bangkok-club-crawl': '/weekends',
  'new-in-bkk': '/new-in-bangkok',
  smc: '/single-meet-club',
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const storefront = resolveStorefront(headers().get('host'))
  const data = await loadProductPage(params.slug, storefront)
  if (!data) return {}
  return buildPageMetadata(storefront, {
    path: DEDICATED_PAGE[params.slug] ?? `/events/${params.slug}`,
    title: `${data.product.name} | ${brandFor(storefront).name}`,
  })
}

export default async function PublicProductPage({ params }: { params: { slug: string } }) {
  const host = headers().get('host')
  const storefront = resolveStorefront(host)
  const data = await loadProductPage(params.slug, storefront)

  if (!data) notFound()

  // Stage 10 Phase 6 — a "back to home" link is only added for the BNT
  // storefront (closing the gap Phase 4 flagged for New in Bangkok's
  // canonical alternate route, /events/new-in-bkk). BCC's existing
  // /events/[slug] rendering stays byte-identical — no backHref passed, same
  // as before this change — deliberately, since Phase 4/5 both established
  // BCC's live behavior on this route must not change.
  const brand = storefront === 'bnt' ? brandFor(storefront) : null
  return (
    <ProductPage
      {...data}
      mode="public"
      backHref={brand?.homeHref}
      backLabel={brand?.name}
    />
  )
}
