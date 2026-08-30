import { NextRequest, NextResponse } from 'next/server'
import { stripe, getPriceId, NIGHT_NAMES } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase'
import { getAppUrl } from '@/lib/appUrl'
import { resolveStorefront, VISIBILITY_COLUMN } from '@/lib/storefront'
import { resolveEventPricing } from '@/lib/pricing'
import { isNibPreviewQaBranch } from '@/lib/previewQaOverride'

// Format the YYYY-MM-DD string into a friendly label.
// Parse into LOCAL date components (not new Date(eventDate), which parses as
// UTC midnight and can roll the date back a day depending on server TZ).
function formatEventDate(eventDate: string): string {
  const [dY, dM, dD] = eventDate.split('-').map(Number)
  const dateObj = new Date(dY, dM - 1, dD)
  return dateObj.toLocaleDateString('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export async function POST(req: NextRequest) {
  try {
    const { eventId, nightSlug, eventDate, quantity, priceTier } = await req.json()

    // Identity: prefer the canonical event-instance id (event_id) when the
    // caller supplies it; otherwise fall back to the legacy (night_slug,
    // event_date) composite. Require at least one usable identifier, plus a
    // *present* quantity. A supplied-but-invalid quantity (e.g. 0) is not
    // "missing" — it flows through to createDynamicCheckout below and is
    // rejected there as "Invalid quantity".
    const hasComposite = Boolean(nightSlug && eventDate)
    if ((!eventId && !hasComposite) || quantity === undefined || quantity === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Phase 2 rollback flag. When 'true', Supabase Product + Event Instance is
    // the source of truth for what Stripe charges. Otherwise we fall back to
    // the legacy hardcoded slug → Stripe Price ID path (unchanged). Flipping
    // this env var in Vercel is the instant rollback/cutover switch.
    if (process.env.CHECKOUT_DYNAMIC_PRICING === 'true') {
      // Storefront-aware (Stage 10 Phase 5): resolved from the REQUEST'S OWN
      // Host header, never from anything the client's JSON body could claim
      // — a forged/absent storefront in the body can't buy BNT-only pricing
      // or bypass BCC visibility, because the body never carries one at all.
      // isNibPreviewQaBranch() (Stage 5D) is temporary Preview-QA scaffolding
      // (lib/previewQaOverride.ts, already used by /, /about, /new-in-bangkok,
      // /book, /booking-success) — always false in Production and on every
      // other Preview branch, so it never changes real bkkclubcrawl.com/
      // bestnightlifethailand.com checkout behavior. Lets this branch's
      // Preview exercise the real BNT checkout path for New in Bangkok.
      const storefront = isNibPreviewQaBranch() ? 'bnt' : resolveStorefront(req.headers.get('host'))
      return await createDynamicCheckout({ eventId, nightSlug, eventDate, quantity, storefront, priceTier })
    }
    // Same resolver every other URL-building call site uses (ticket page, QR
    // route, confirmation email, dynamic checkout above) — Preview deployments
    // get their own success/cancel redirect instead of always pointing at
    // production (main's Blocker-A fix, carried into the legacy/rollback path).
    const appUrl = getAppUrl()
    return await createLegacyCheckout({ nightSlug, eventDate, quantity, appUrl })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic path (Phase 2): Supabase Product + Event Instance is authoritative.
// ─────────────────────────────────────────────────────────────────────────
async function createDynamicCheckout({
  eventId,
  nightSlug,
  eventDate,
  quantity,
  storefront,
  priceTier,
}: {
  eventId?: string | null
  nightSlug?: string | null
  eventDate?: string | null
  quantity: any
  storefront: 'bcc' | 'bnt'
  priceTier?: string | null
}) {
  // Basic quantity guard. The /book calendar caps at 12–24 per night; reject
  // anything outside a sane integer range rather than trusting the client.
  const qty = Number(quantity)
  if (!Number.isInteger(qty) || qty < 1 || qty > 24) {
    return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
  }

  // Tier-selector UX (Gate B pricing refinement): the client may express a
  // PREFERENCE for which tier it wants, but never a price. undefined/null
  // means "no preference" — falls through to the exact auto-resolved
  // behavior this endpoint always had (pricing.tier/pricing.price below),
  // unchanged for every caller that doesn't send this (Bangkok Club Crawl's
  // flat-price checkout included, since it never sends priceTier at all).
  if (priceTier !== undefined && priceTier !== null && priceTier !== 'early_bird' && priceTier !== 'regular') {
    return NextResponse.json({ error: 'Invalid priceTier' }, { status: 400 })
  }

  // ── Resolve the actual event instance + its product ──
  // Prefer the canonical primary key (event_id) when the caller supplies it;
  // otherwise fall back to the legacy (night_slug, event_date) composite for
  // callers that don't (e.g. the static-calendar path). Either way we resolve a
  // single event_dates row and then run the identical storefront gates below —
  // how the row is found never changes what is charged or the webhook metadata.
  let event: any
  try {
    const supabase = getServiceSupabase()
    let query = supabase
      .from('event_dates')
      .select(
        'id, event_date, night_slug, night_name, is_open, price_override, start_time_override, product_id, ' +
          'products ( id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt, ' +
          'early_bird_price, early_bird_cutoff_hours )'
      )

    if (eventId) {
      query = query.eq('id', eventId)
    } else {
      query = query.eq('night_slug', nightSlug).eq('event_date', eventDate)
    }

    const { data, error } = await query.limit(1).maybeSingle()

    if (error) {
      // A query error means we couldn't validate — fail closed, never charge.
      console.error('create-checkout: Supabase query error:', error)
      return NextResponse.json(
        { error: 'Booking temporarily unavailable. Please try again.' },
        { status: 503 }
      )
    }
    event = data
  } catch (err: any) {
    console.error('create-checkout: Supabase unavailable:', err)
    return NextResponse.json(
      { error: 'Booking temporarily unavailable. Please try again.' },
      { status: 503 }
    )
  }

  // ── Storefront validation — every gate rejects BEFORE any Stripe call, so a
  // nonexistent, closed, hidden, or mispriced event can never be charged. ──

  // 1. Event exists
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // 1b. Identity consistency — when the caller supplies BOTH the canonical
  //     event_id AND the legacy composite, they must agree. We resolved
  //     canonically by event_id above; a composite naming a different night or
  //     date is a contradictory request, rejected here before any Stripe call
  //     rather than silently honoring one identifier over the other.
  if (eventId && nightSlug && eventDate) {
    if (event.night_slug !== nightSlug || event.event_date !== eventDate) {
      return NextResponse.json(
        { error: 'Event identifiers do not match' },
        { status: 409 }
      )
    }
  }

  // 2. Event is open for booking
  if (event.is_open !== true) {
    return NextResponse.json(
      { error: 'This date is not open for booking' },
      { status: 409 }
    )
  }

  // Supabase returns a to-one embed as an object, but normalize defensively.
  const product = Array.isArray(event.products) ? event.products[0] : event.products

  // 3. Linked product exists
  if (!product) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // 4. Product is active
  if (product.status !== 'active') {
    return NextResponse.json(
      { error: 'This experience is not available' },
      { status: 409 }
    )
  }

  // 5. Product is visible on the REQUEST'S OWN storefront (resolved from the
  //    Host header, step above — never from client-supplied data). This
  //    blocks a manually constructed request from checking out a product
  //    that isn't sold on the storefront it was actually requested from
  //    (e.g. bkkclubcrawl.com trying to buy a BNT-only product, or vice
  //    versa) — the same gate /api/events already enforces for listing, now
  //    enforced here too, for both storefronts, not just BCC.
  const visColumn = VISIBILITY_COLUMN[storefront]
  if (!visColumn || product[visColumn] !== true) {
    return NextResponse.json(
      { error: 'This experience is not available' },
      { status: 409 }
    )
  }

  // 6. Regular price is a valid positive integer (THB whole units)
  const regularPrice = event.price_override ?? product.default_price
  if (!Number.isInteger(regularPrice) || regularPrice <= 0) {
    return NextResponse.json({ error: 'Pricing unavailable' }, { status: 422 })
  }

  // 7. Resolve the AUTHORITATIVE current price/tier server-side, from the DB
  //    + the server's own clock — never from anything the client sent (the
  //    client never even has a way to send a price; this just makes the
  //    tiering explicit). A stale Early Bird page left open past its cutoff
  //    silently reprices to the correct current amount here — the browser
  //    can never force a ฿390 charge once Early Bird has closed, because the
  //    unit_amount below is 100% server-computed.
  const pricing = resolveEventPricing({
    eventDate: event.event_date,
    effectiveStartTime: event.start_time_override ?? product.default_start_time,
    regularPrice,
    earlyBirdPrice: product.early_bird_price ?? null,
    earlyBirdCutoffHours: product.early_bird_cutoff_hours ?? null,
  })

  // 8. Honor an explicit tier PREFERENCE, still never trusting a client-sent
  //    price — every number charged below is re-derived here from the same
  //    server-resolved `pricing`/`regularPrice`, never from the request body.
  //    - No preference (priceTier omitted): unchanged — exactly today's
  //      auto-resolved pricing.tier/pricing.price, e.g. Bangkok Club Crawl's
  //      flat-price flow, which never sends this field.
  //    - 'regular' requested: General Admission is always a valid choice,
  //      before or after the Early Bird cutoff, as long as this event has a
  //      price at all — already guaranteed by gate 6 above.
  //    - 'early_bird' requested: only honored if `pricing.earlyBirdAvailable`
  //      is true for THIS event at THIS exact moment (the same resolver the
  //      calendar and this route always used) — a request replaying an
  //      Early Bird selection made before the cutoff, submitted after it has
  //      passed, is rejected here rather than silently charging the stale
  //      ฿390. This is the one and only place tier eligibility is decided.
  let effectiveTier = pricing.tier
  let effectivePrice = pricing.price
  if (priceTier === 'regular') {
    effectiveTier = 'regular'
    effectivePrice = regularPrice
  } else if (priceTier === 'early_bird') {
    if (!pricing.earlyBirdAvailable || pricing.earlyBirdPrice == null) {
      return NextResponse.json(
        { error: 'Early Bird pricing is no longer available for this date' },
        { status: 409 }
      )
    }
    effectiveTier = 'early_bird'
    effectivePrice = pricing.earlyBirdPrice
  }

  // ── Build the Stripe session from canonical data ──
  // unit_amount is in the smallest currency unit (satang); THB is 2-decimal, so
  // ฿1,200 → 120000. This preserves the webhook's amount_total / 100 math and
  // keeps stored total_paid / price_per_person identical to the legacy path.
  const formattedDate = formatEventDate(event.event_date)
  const appUrl = getAppUrl(storefront)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',

    line_items: [
      {
        quantity: qty,
        price_data: {
          currency: 'thb',
          unit_amount: effectivePrice * 100,
          product_data: {
            name: `${event.night_name} — ${formattedDate}`,
          },
        },
      },
    ],

    // Collect name, email, phone at checkout
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: true },

    // Allow promo codes (managed in Stripe dashboard)
    allow_promotion_codes: true,

    // Preserve all legacy metadata (the webhook still depends on these) and add
    // the canonical identifiers. Legacy keys are sourced from the DB row so the
    // metadata reflects the authoritative record, not the raw request.
    metadata: {
      // Canonical identifiers (new)
      product_id: product.id,
      product_slug: product.slug,
      event_id: event.id,
      // Storefront/pricing-tier identity (Stage 10 Phase 5) — lets the
      // webhook record which brand and which price tier this booking
      // belongs to without trusting anything from the browser; also the
      // foundation Phase 6 needs to pick BCC vs BNT transactional-email
      // branding per booking.
      storefront,
      price_tier: effectiveTier,
      // Legacy keys (unchanged contract with the webhook)
      night_slug: event.night_slug,
      night_name: event.night_name,
      event_date: event.event_date,
      quantity: String(qty),
      formatted_date: formattedDate,
    },

    custom_text: {
      submit: {
        message: `You're booking ${qty} ticket${qty > 1 ? 's' : ''} for ${event.night_name} on ${formattedDate}.`,
      },
    },

    success_url: `${appUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}&night=${event.night_slug}&qty=${qty}`,
    cancel_url: `${appUrl}/book?night=${event.night_slug}`,
  })

  return NextResponse.json({ url: session.url })
}

// ─────────────────────────────────────────────────────────────────────────
// Legacy path: hardcoded slug → Stripe Price ID. Retained behind the rollback
// flag until the dynamic path is proven in production, then removed separately.
// ─────────────────────────────────────────────────────────────────────────
async function createLegacyCheckout({
  nightSlug,
  eventDate,
  quantity,
  appUrl,
}: {
  nightSlug: string
  eventDate: string
  quantity: any
  appUrl: string
}) {
  // Preserve the legacy path's original behavior. It previously relied on the
  // top-level guard to guarantee nightSlug/eventDate/quantity; that guard now
  // also accepts eventId-only requests (dynamic path), so re-assert the legacy
  // path's own requirements here. The legacy path can't resolve an event_id
  // (no DB lookup — it maps slug → Stripe Price), so a request that reaches it
  // without the composite is "Missing required fields", byte-identical to before.
  if (!nightSlug || !eventDate || !quantity) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const nightName = NIGHT_NAMES[nightSlug] || nightSlug
  const priceId = getPriceId(nightSlug)
  const formattedDate = formatEventDate(eventDate)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',

    line_items: [
      {
        price: priceId,
        quantity: quantity,
      },
    ],

    // Collect name, email, phone at checkout
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: true },

    // Allow promo codes (managed in Stripe dashboard)
    allow_promotion_codes: true,

    // Pass all booking data as metadata — retrieved in webhook
    metadata: {
      night_slug: nightSlug,
      night_name: nightName,
      event_date: eventDate,
      quantity: String(quantity),
      formatted_date: formattedDate,
    },

    // Pre-fill description so guest sees the night name
    custom_text: {
      submit: {
        message: `You're booking ${quantity} ticket${quantity > 1 ? 's' : ''} for ${nightName} on ${formattedDate}.`,
      },
    },

    // Include night + qty in success URL so Purchase pixel event can fire accurately
    success_url: `${appUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}&night=${nightSlug}&qty=${quantity}`,
    cancel_url: `${appUrl}/book?night=${nightSlug}`,
  })

  return NextResponse.json({ url: session.url })
}
