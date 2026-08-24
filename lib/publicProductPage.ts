import { getServiceSupabase } from '@/lib/supabase'
import { productMediaPublicUrl } from '@/lib/media'
import { bangkokToday } from '@/lib/dates'
import { VISIBILITY_COLUMN, type Storefront } from '@/lib/storefront'
import { resolveEventPricing } from '@/lib/pricing'
import type { ProductPageProps } from '@/components/ProductPage'

export type PublicProductPageData = Pick<ProductPageProps, 'product' | 'content' | 'media' | 'upcomingEvents'>

// Canonical, storefront-gated Product+Event loader (Stage 10 Phase 4) shared
// by every public product route (/events/[slug], /new-in-bangkok, and any
// future storefront alias) so none of them can drift out of sync with the
// exact gates /api/products/[slug] and /api/events already enforce:
// products.status = 'active' AND products.visible_<storefront> = true.
// Returns null on any gate failure or missing product — callers must
// notFound(), never render, on a null result.
export async function loadPublicProductPage(
  slug: string,
  storefront: Storefront
): Promise<PublicProductPageData | null> {
  const visColumn = VISIBILITY_COLUMN[storefront]
  const supabase = getServiceSupabase()

  const { data: product } = await supabase
    .from('products')
    .select(
      `id, slug, name, status, default_price, default_start_time, early_bird_price, early_bird_cutoff_hours, ${visColumn}`
    )
    .eq('slug', slug)
    .maybeSingle()

  if (!product || product.status !== 'active' || (product as any)[visColumn] !== true) {
    return null
  }

  const [{ data: content }, { data: mediaRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from('product_content')
      .select(
        'tagline, short_description, full_description, duration_minutes, ' +
          'meeting_point, highlights, itinerary, whats_included, whats_not_included, important_info'
      )
      .eq('product_id', product.id)
      .maybeSingle(),
    supabase
      .from('product_media')
      .select('id, kind, storage_path, alt, sort_order')
      .eq('product_id', product.id)
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('event_dates')
      .select('id, event_date, price_override, start_time_override')
      .eq('product_id', product.id)
      .eq('is_open', true)
      .gte('event_date', bangkokToday())
      .order('event_date', { ascending: true }),
  ])

  const media = (mediaRows ?? []).map((row: any) => ({
    id: row.id,
    kind: row.kind,
    alt: row.alt,
    sort_order: row.sort_order,
    url: productMediaPublicUrl(row.storage_path),
  }))

  const upcomingEvents = (eventRows ?? []).map((row: any) => {
    const effective_start_time = row.start_time_override ?? product.default_start_time
    const pricing = resolveEventPricing({
      eventDate: row.event_date,
      effectiveStartTime: effective_start_time,
      regularPrice: row.price_override ?? product.default_price,
      earlyBirdPrice: (product as any).early_bird_price ?? null,
      earlyBirdCutoffHours: (product as any).early_bird_cutoff_hours ?? null,
    })
    return {
      id: row.id,
      event_date: row.event_date,
      effective_price: pricing.price,
      effective_start_time,
      price_tier: pricing.tier,
      regular_price: pricing.regularPrice,
      early_bird_price: pricing.earlyBirdPrice,
      early_bird_available: pricing.earlyBirdAvailable,
    }
  })

  return {
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      default_price: product.default_price,
      default_start_time: product.default_start_time,
    },
    content: (content as any) ?? null,
    media,
    upcomingEvents,
  }
}
