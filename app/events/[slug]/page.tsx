import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ProductPage from '@/components/ProductPage'
import { resolveStorefront } from '@/lib/storefront'
import { loadPublicProductPage } from '@/lib/publicProductPage'

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
export default async function PublicProductPage({ params }: { params: { slug: string } }) {
  const host = headers().get('host')
  const storefront = resolveStorefront(host)
  const data = await loadPublicProductPage(params.slug, storefront)

  if (!data) notFound()

  return <ProductPage {...data} mode="public" />
}
