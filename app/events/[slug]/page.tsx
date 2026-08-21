import { notFound } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabase'
import { productMediaPublicUrl } from '@/lib/media'
import ProductPage from '@/components/ProductPage'

export const dynamic = 'force-dynamic'

// Same Asia/Bangkok "today" used by /api/events and the admin preview route,
// so "upcoming" here matches what checkout and the calendar would show.
function bangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// Public Product Page (Stage 8e/8g). Fails closed: a Product must exist,
// be status='active', AND visible_bcc=true, mirroring the exact gates
// app/api/events/route.ts already enforces for checkout — otherwise this
// route must not reveal that the slug exists at all, so every failure path
// below is a plain 404, not a distinguishable error.
export default async function PublicProductPage({ params }: { params: { slug: string } }) {
  const supabase = getServiceSupabase()

  const { data: product } = await supabase
    .from('products')
    .select('id, slug, name, status, default_price, default_start_time, visible_bcc')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!product || product.status !== 'active' || !product.visible_bcc) {
    notFound()
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

  const upcomingEvents = (eventRows ?? []).map((row: any) => ({
    id: row.id,
    event_date: row.event_date,
    effective_price: row.price_override ?? product.default_price,
    effective_start_time: row.start_time_override ?? product.default_start_time,
  }))

  return (
    <ProductPage
      product={{
        id: product.id,
        slug: product.slug,
        name: product.name,
        default_price: product.default_price,
        default_start_time: product.default_start_time,
      }}
      content={(content as any) ?? null}
      media={media}
      upcomingEvents={upcomingEvents}
      mode="public"
    />
  )
}
