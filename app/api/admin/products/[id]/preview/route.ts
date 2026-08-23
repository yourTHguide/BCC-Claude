import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { productMediaPublicUrl } from '@/lib/media'

export const dynamic = 'force-dynamic'

// Same Asia/Bangkok "today" used everywhere else availability is computed
// (see app/api/events/route.ts, app/api/admin/products/[id]/route.ts), so
// "upcoming" here means the same thing it means on the storefront.
function bangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// Admin Draft Preview data: Product + product_content + product_media +
// upcoming Event Instances, for the authenticated ProductPage preview
// (Stage 8f). Deliberately does NOT gate on status='active' or
// visible_bcc/visible_bnt — a Draft product must preview successfully, that
// is the entire point of this route. No writes anywhere.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner','admin'])
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt')
    .eq('id', params.id)
    .maybeSingle()

  if (productError) {
    console.error('admin/products preview: product query error:', productError)
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 })
  }
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const { data: content, error: contentError } = await supabase
    .from('product_content')
    .select(
      'product_id, tagline, short_description, full_description, duration_minutes, ' +
        'meeting_point, highlights, itinerary, whats_included, whats_not_included, important_info'
    )
    .eq('product_id', params.id)
    .maybeSingle()

  if (contentError) {
    console.error('admin/products preview: content query error:', contentError)
    return NextResponse.json({ error: 'Failed to load content' }, { status: 500 })
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from('product_media')
    .select('id, kind, storage_path, alt, sort_order')
    .eq('product_id', params.id)
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true })

  if (mediaError) {
    console.error('admin/products preview: media query error:', mediaError)
    return NextResponse.json({ error: 'Failed to load media' }, { status: 500 })
  }

  const today = bangkokToday()
  const { data: eventRows, error: eventsError } = await supabase
    .from('event_dates')
    .select('id, event_date, price_override, start_time_override')
    .eq('product_id', params.id)
    .eq('is_open', true)
    .gte('event_date', today)
    .order('event_date', { ascending: true })

  if (eventsError) {
    console.error('admin/products preview: events query error:', eventsError)
    return NextResponse.json({ error: 'Failed to load upcoming instances' }, { status: 500 })
  }

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

  return NextResponse.json({
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      status: product.status,
      default_price: product.default_price,
      default_start_time: product.default_start_time,
      visible_bcc: product.visible_bcc,
      visible_bnt: product.visible_bnt,
    },
    content: content ?? null,
    media,
    upcomingEvents,
  })
}
