import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { bccUpdatesOptInEnabled, soldOutWaitlistEnabled } from '@/lib/waitlist/bccInstances'
import { VISIBILITY_COLUMN } from '@/lib/storefront'
import { vanMessage } from '@/lib/vans'
import { resolveEventPricing } from '@/lib/pricing'
import { isDedicatedFlowProduct } from '@/lib/smc/config'
import { BCC_PRODUCT_SLUG, isCancelledEvent, isPastBookingCutoff, seatKey, seatsTaken } from '@/lib/bookingAvailability'

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
//   • not cancelled, not past its booking cutoff (BCC: the 9:30 PM start on
//     the night), and not full when a capacity is set — lib/bookingAvailability.ts
//
// The response preserves Product vs Event-Instance identity explicitly.
// `nightSlug` is a legacy per-event variant identifier (e.g. 'tgif',
// 'saturday-signature'), NOT product identity — both are variants under the
// same 'bangkok-club-crawl' Product today. A future Product carries its own
// productId/productSlug and flows through this API with no redesign.

// This route depends on "today" and live DB state, so it must never be cached.
export const dynamic = 'force-dynamic'

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
  let taken: Map<string, number> = new Map()
  try {
    const supabase = getServiceSupabase()
    // !inner drops any event whose joined product fails the product-side gates,
    // enforcing active + visible at the DB rather than in JS.
    const { data, error } = await supabase
      .from('event_dates')
      .select(
        'id, event_date, night_slug, night_name, price_override, start_time_override, capacity, van_count, van2_state, product_id, operation_verdict, ' +
          'products!inner ( id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt, ' +
          'early_bird_price, early_bird_cutoff_hours )'
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
    // Seats already taken, only for dates that have a capacity set.
    const capped = rows.filter((r: any) => r.capacity != null)
    taken = capped.length ? await seatsTaken(supabase, capped) : new Map()
  } catch (err: any) {
    console.error('api/events: Supabase unavailable:', err)
    return NextResponse.json(
      { error: 'Events temporarily unavailable. Please try again.' },
      { status: 503 }
    )
  }

  // Phase 3B: genuinely full Bangkok Club Crawl nights, any day (BCC
  // storefront only). Listed separately so the calendar can show "sold out"
  // with a next-night offer and a waitlist; `events` is unchanged and still
  // holds only bookable instances. Every other gate has already passed for
  // these rows — they are closed ONLY because every seat is taken.
  const soldOut: { eventId: string; eventDate: string; nightSlug: string; nightName: string; productSlug: string }[] = []

  const events = rows.flatMap((row) => {
    // Supabase returns a to-one embed as an object; normalize defensively.
    const product = Array.isArray(row.products) ? row.products[0] : row.products

    // Single Meet Club has its own booking flow; never list it in the generic calendar.
    if (isDedicatedFlowProduct(product?.slug)) return []

    // Regular price mirrors checkout's resolution (price_override ??
    // default_price). Drop any event whose price is missing / non-integer /
    // non-positive: checkout rejects those (gate 6), so the calendar must not
    // surface them either. Checkout stays the final authority on price.
    const regularPrice = row.price_override ?? product?.default_price ?? null
    if (!Number.isInteger(regularPrice) || regularPrice <= 0) return []

    const effectiveStartTime = row.start_time_override ?? product?.default_start_time ?? null

    // Phase 2 availability gates — same functions checkout enforces.
    if (isCancelledEvent(row)) return []
    if (isPastBookingCutoff(row.event_date, effectiveStartTime, product?.slug)) return []
    const remaining = row.capacity != null ? Math.max(0, row.capacity - (taken.get(seatKey(row)) ?? 0)) : null
    if (remaining === 0) {
      if (
        storefront === 'bcc' &&
        product?.slug === BCC_PRODUCT_SLUG &&
        row.capacity > 0
      ) {
        soldOut.push({ eventId: row.id, eventDate: row.event_date, nightSlug: row.night_slug, nightName: row.night_name, productSlug: product.slug })
      }
      return []
    }

    // Same tiering resolver checkout uses (lib/pricing.ts) — the calendar's
    // displayed price is always exactly what checkout would charge right
    // now for this event, including Early Bird when the product has one and
    // it hasn't closed yet for this specific date's start time.
    const pricing = resolveEventPricing({
      eventDate: row.event_date,
      effectiveStartTime,
      regularPrice,
      earlyBirdPrice: product?.early_bird_price ?? null,
      earlyBirdCutoffHours: product?.early_bird_cutoff_hours ?? null,
    })

    return [{
      eventId: row.id,
      productId: product?.id ?? null,
      productSlug: product?.slug ?? null,
      productName: product?.name ?? null,

      eventDate: row.event_date,
      nightSlug: row.night_slug,
      nightName: row.night_name,

      effectivePrice: pricing.price,
      priceTier: pricing.tier,
      regularPrice: pricing.regularPrice,
      // Tier-selector UX (Gate B pricing refinement): lets a caller offer
      // both tiers explicitly instead of only the auto-resolved default.
      // earlyBirdPrice is null for any product without early-bird pricing
      // configured (e.g. Bangkok Club Crawl) — exactly resolveEventPricing's
      // own signal for "this product has no second tier at all," reused
      // here rather than re-deriving it.
      earlyBirdPrice: pricing.earlyBirdPrice,
      earlyBirdAvailable: pricing.earlyBirdAvailable,
      effectiveStartTime,
      // Per-event capacity; NULL = no defined capacity (no limit).
      capacity: row.capacity ?? null,
      // Seats left when a capacity is set (null = no limit). The calendar
      // caps the ticket quantity at this; checkout re-checks it.
      remaining,
      // Phase 3D: shown to guests only when seats run low (4 or fewer) or
      // when van 2 is waiting to unlock. Never "x/10 booked".
      seatsMessage: product?.slug === BCC_PRODUCT_SLUG ? vanMessage(row.van_count ?? null, row.van2_state ?? 'open', row.capacity ?? null, taken.get(seatKey(row)) ?? 0) : null,
    }]
  })

  return NextResponse.json({
    events,
    soldOut,
    waitlistEnabled: storefront === 'bcc' && soldOutWaitlistEnabled(),
    updatesOptIn: storefront === 'bcc' && soldOutWaitlistEnabled() && bccUpdatesOptInEnabled(),
  })
}
