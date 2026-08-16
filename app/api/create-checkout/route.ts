import { NextRequest, NextResponse } from 'next/server'
import { stripe, getPriceId, NIGHT_NAMES } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase'

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
    const { nightSlug, eventDate, quantity } = await req.json()

    // nightSlug/eventDate are required, and quantity must be *present*. A
    // supplied-but-invalid quantity (e.g. 0) is not "missing" — it flows through
    // to createDynamicCheckout below and is rejected there as "Invalid quantity".
    if (!nightSlug || !eventDate || quantity === undefined || quantity === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bkkclubcrawl.com'

    // Phase 2 rollback flag. When 'true', Supabase Product + Event Instance is
    // the source of truth for what Stripe charges. Otherwise we fall back to
    // the legacy hardcoded slug → Stripe Price ID path (unchanged). Flipping
    // this env var in Vercel is the instant rollback/cutover switch.
    if (process.env.CHECKOUT_DYNAMIC_PRICING === 'true') {
      return await createDynamicCheckout({ nightSlug, eventDate, quantity, appUrl })
    }
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
  // Basic quantity guard. The /book calendar caps at 12–24 per night; reject
  // anything outside a sane integer range rather than trusting the client.
  const qty = Number(quantity)
  if (!Number.isInteger(qty) || qty < 1 || qty > 24) {
    return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
  }

  // ── Resolve the actual event instance + its product ──
  // The static calendar only knows (night_slug, event_date), so we resolve on
  // that composite. Phase 3 (DB-driven calendar) can pass event_id directly.
  let event: any
  try {
    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .from('event_dates')
      .select(
        'id, event_date, night_slug, night_name, is_open, price_override, product_id, ' +
          'products ( id, slug, name, status, default_price, visible_bcc )'
      )
      .eq('night_slug', nightSlug)
      .eq('event_date', eventDate)
      .limit(1)
      .maybeSingle()

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

  // 5. Product is visible on the BCC storefront. This blocks a manually
  //    constructed request from checking out a product that isn't sold on BCC
  //    (e.g. a future builders-club with visible_bcc=false).
  if (product.visible_bcc !== true) {
    return NextResponse.json(
      { error: 'This experience is not available' },
      { status: 409 }
    )
  }

  // 6. Effective price is a valid positive integer (THB whole units)
  const effectivePrice = event.price_override ?? product.default_price
  if (!Number.isInteger(effectivePrice) || effectivePrice <= 0) {
    return NextResponse.json({ error: 'Pricing unavailable' }, { status: 422 })
  }

  // ── Build the Stripe session from canonical data ──
  // unit_amount is in the smallest currency unit (satang); THB is 2-decimal, so
  // ฿1,200 → 120000. This preserves the webhook's amount_total / 100 math and
  // keeps stored total_paid / price_per_person identical to the legacy path.
  const formattedDate = formatEventDate(event.event_date)

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
      // Legacy keys (unchanged contract with the webhook)
      night_slug: event.night_slug,
      night_name: event.night_name,
      event_date: event.event_date,
      quantity: String(qty),
      formatted_date: formattedDate,
    },

    custom_text: {
      submit: {
        message: `You're booking ${qty} ticket${qty > 1 ? 's' : ''} for ${event.night_name} on ${formattedDate}. Meet-up at 9:30 PM — location shared via WhatsApp by 7 PM.`,
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
  // top-level `!quantity` guard to reject falsy quantities (0, missing) as
  // "Missing required fields"; that guard now only catches truly-missing
  // quantity, so re-assert the falsy check here to keep legacy byte-identical.
  if (!quantity) {
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
        message: `You're booking ${quantity} ticket${quantity > 1 ? 's' : ''} for ${nightName} on ${formattedDate}. Meet-up at 9:30 PM — location shared via WhatsApp by 7 PM.`,
      },
    },

    // Include night + qty in success URL so Purchase pixel event can fire accurately
    success_url: `${appUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}&night=${nightSlug}&qty=${quantity}`,
    cancel_url: `${appUrl}/book?night=${nightSlug}`,
  })

  return NextResponse.json({ url: session.url })
}
