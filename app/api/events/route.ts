import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

// Canonical event-availability layer (Phase 3).
//
// Supabase Product + Event Instance is the single source of truth for what the
// booking calendar may show. This endpoint resolves the same gates the checkout
// re-validates (see app/api/create-checkout/route.ts), so the calendar can
// never surface an event that checkout would reject:
//   • event_dates.is_open = true
//   • event_dates.event_date >= today (Asia/Bangkok)
//   • products.status = 'active'
//   • products.visible_<storefront> = true
//
// The response preserves Product vs Event-Instance identity explicitly.
// `nightSlug` is a legacy per-event variant identifier (e.g. 'tgif',
// 'saturday-signature'), NOT product identity — both are variants under the
// same 'bangkok-club-crawl' Product today. A future Product carries its own
// productId/productSlug and flows through this API with no redesign.

// This route depends on "today" and live DB state, so it must never be cached.
export const dynamic = 'force-dynamic'

// Storefront → product visibility column. Whitelisted so the value is only ever
// one of these two literals (never user-controlled SQL).
const VISIBILITY_COLUMN: Record<string, 'visible_bcc' | 'visible_bnt'> = {
  bcc: 'visible_bcc',
  bnt: 'visible_bnt',
}

// Today's date in Asia/Bangkok as YYYY-MM-DD. event_date is a DATE column, so
// comparing against the Bangkok *local* date keeps "tonight is still bookable"
// correct for guests regardless of server timezone (a server-UTC "today" would
// drop the current Bangkok day for part of the evening).
function bangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function GET(req: NextRequest) {
  const storefront = (req.nextUrl.searchParams.get('storefront') || 'bcc').toLowerCase()
  const visColumn = VISIBILITY_COLUMN[storefront]
  if (!visColumn) {
    return NextResponse.json({ error: 'Unknown storefront' }, { status: 400 })
  }

  const today = bangkokToday()

  let rows: any[]
  try {
    const supabase = getServiceSupabase()
    // !inner drops any event whose joined product fails the product-side gates,
    // enforcing active + visible at the DB rather than in JS.
    const { data, error } = await supabase
      .from('event_dates')
      .select(
        'id, event_date, night_slug, night_name, price_override, start_time_override, capacity, product_id, ' +
          'products!inner ( id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt )'
      )
      .eq('is_open', true)
      .gte('event_date', today)
      .eq('products.status', 'active')
      .eq(`products.${visColumn}`, true)
      .order('event_date', { ascending: true })

    if (error) {
      // A query error means we can't trust availability — fail closed rather
      // than render a stale/empty calendar as if it were authoritative.
      console.error('api/events: Supabase query error:', error)
      return NextResponse.json(
        { error: 'Events temporarily unavailable. Please try again.' },
        { status: 503 }
      )
    }
    rows = data ?? []
  } catch (err: any) {
    console.error('api/events: Supabase unavailable:', err)
    return NextResponse.json(
      { error: 'Events temporarily unavailable. Please try again.' },
      { status: 503 }
    )
  }

  const events = rows.map((row) => {
    // Supabase returns a to-one embed as an object; normalize defensively.
    const product = Array.isArray(row.products) ? row.products[0] : row.products

    // Effective values mirror checkout's resolution. Price is surfaced for
    // display only — it remains authoritatively re-validated at checkout.
    const effectivePrice = row.price_override ?? product?.default_price ?? null
    const effectiveStartTime = row.start_time_override ?? product?.default_start_time ?? null

    return {
      eventId: row.id,
      productId: product?.id ?? null,
      productSlug: product?.slug ?? null,
      productName: product?.name ?? null,

      eventDate: row.event_date,
      nightSlug: row.night_slug,
      nightName: row.night_name,

      effectivePrice,
      effectiveStartTime,
      // Per-event capacity; NULL means no defined capacity. The calendar applies
      // its own per-order transaction safeguard — this is NOT that limit.
      capacity: row.capacity ?? null,
    }
  })

  return NextResponse.json({ events })
}
