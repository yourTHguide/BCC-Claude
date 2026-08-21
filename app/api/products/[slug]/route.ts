import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { productMediaPublicUrl } from '@/lib/media'
import { bangkokToday } from '@/lib/dates'
import { VISIBILITY_COLUMN } from '@/lib/storefront'

// Public, read-only Product detail — Phase 4 Stage A. The canonical read
// boundary an external storefront (BNT today, others later) consumes instead
// of ever touching Supabase directly. Mirrors the exact gates /api/events and
// /events/[slug]/page.tsx already enforce (status='active' AND
// visible_<storefront>=true) so this can never reveal a Draft or
// wrong-storefront Product — every failure path returns the same 404 shape,
// never a distinguishable error, so a caller can't probe for a hidden slug.
//
// Response is a hand-picked contract, not a table dump: no product UUID,
// schedule ids, status, raw visible_bcc/visible_bnt flags, capacity, or
// storage_path ever leave this route. See PHASE4_CHECKPOINT.md for the
// full contract.

export const dynamic = 'force-dynamic'

type SanitizedMeetingPoint =
  | {
      visibility: 'public'
      display_name: string | null
      address: string | null
      maps_url: string | null
      instructions: string | null
    }
  | { visibility: 'after_booking' }
  | null

// Enforces the meeting-point disclosure rule server-side, not left to the
// renderer: 'public' -> full location, 'after_booking' -> visibility flag
// only (no location fields at all), 'private'/unset/invalid -> null. Actual
// post-booking location disclosure is a separate confirmation-flow concern,
// out of scope here.
function sanitizeMeetingPoint(raw: unknown): SanitizedMeetingPoint {
  if (!raw || typeof raw !== 'object') return null
  const mp = raw as Record<string, unknown>

  if (mp.visibility === 'public') {
    return {
      visibility: 'public',
      display_name: typeof mp.display_name === 'string' ? mp.display_name : null,
      address: typeof mp.address === 'string' ? mp.address : null,
      maps_url: typeof mp.maps_url === 'string' ? mp.maps_url : null,
      instructions: typeof mp.instructions === 'string' ? mp.instructions : null,
    }
  }

  if (mp.visibility === 'after_booking') {
    return { visibility: 'after_booking' }
  }

  // 'private', unset ('{}'), or any invalid/unrecognized value — fail closed.
  return null
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const storefrontParam = (req.nextUrl.searchParams.get('storefront') || '').toLowerCase()
  const visColumn = VISIBILITY_COLUMN[storefrontParam]
  if (!visColumn) {
    return NextResponse.json({ error: 'Unknown storefront' }, { status: 400 })
  }

  const supabase = getServiceSupabase()

  const { data: product, error: productError } = await supabase
    .from('products')
    .select(`id, slug, name, status, default_price, default_start_time, ${visColumn}`)
    .eq('slug', params.slug)
    .maybeSingle()

  if (productError) {
    // A query error means we can't trust the gate — fail closed as a system
    // error, distinct from "doesn't exist" (matches /api/events' convention).
    console.error('api/products/[slug]: Supabase query error (product):', productError)
    return NextResponse.json(
      { error: 'Product temporarily unavailable. Please try again.' },
      { status: 503 }
    )
  }

  const gated = !product || product.status !== 'active' || (product as any)[visColumn] !== true
  if (gated) {
    // Deliberately identical response whether the slug doesn't exist, is
    // Draft, or isn't visible on this storefront — never lets a caller
    // distinguish "hidden" from "absent".
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const today = bangkokToday()

  const [
    { data: content, error: contentError },
    { data: mediaRows, error: mediaError },
    { data: eventRows, error: eventError },
  ] = await Promise.all([
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
      .select('kind, storage_path, alt, sort_order')
      .eq('product_id', product.id)
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('event_dates')
      .select('id, event_date, price_override, start_time_override')
      .eq('product_id', product.id)
      .eq('is_open', true)
      .gte('event_date', today)
      .order('event_date', { ascending: true }),
  ])

  if (contentError || mediaError || eventError) {
    console.error(
      'api/products/[slug]: Supabase query error:',
      contentError || mediaError || eventError
    )
    return NextResponse.json(
      { error: 'Product temporarily unavailable. Please try again.' },
      { status: 503 }
    )
  }

  const media = (mediaRows ?? []).map((row: any) => ({
    kind: row.kind,
    alt: row.alt,
    sort_order: row.sort_order,
    url: productMediaPublicUrl(row.storage_path),
  }))

  const upcomingEvents = (eventRows ?? []).map((row: any) => ({
    eventId: row.id,
    eventDate: row.event_date,
    effectivePrice: row.price_override ?? product.default_price,
    effectiveStartTime: row.start_time_override ?? product.default_start_time,
  }))

  return NextResponse.json({
    product: {
      slug: product.slug,
      name: product.name,
      default_price: product.default_price,
      default_start_time: product.default_start_time,
    },
    content: content
      ? {
          tagline: (content as any).tagline,
          short_description: (content as any).short_description,
          full_description: (content as any).full_description,
          duration_minutes: (content as any).duration_minutes,
          highlights: (content as any).highlights,
          itinerary: (content as any).itinerary,
          whats_included: (content as any).whats_included,
          whats_not_included: (content as any).whats_not_included,
          important_info: (content as any).important_info,
          meeting_point: sanitizeMeetingPoint((content as any).meeting_point),
        }
      : null,
    media,
    upcomingEvents,
  })
}
