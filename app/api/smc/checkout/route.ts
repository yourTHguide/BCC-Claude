import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase'
import { getAppUrl } from '@/lib/appUrl'
import { resolveStorefront } from '@/lib/storefront'
import { isPreviewOrDev, isProductionDeployment, smcCheckoutAudienceAllowed, smcCheckoutReadiness } from '@/lib/smc/env'
import { SMC_MAX_TICKETS_PER_BOOKING, SMC_TERMS_VERSION } from '@/lib/smc/terms'

export const dynamic = 'force-dynamic'

// Stripe Checkout sessions last at least 30 minutes; the seat hold covers the
// session plus a grace period for payments that complete at the last moment.
const SESSION_MINUTES = 30
const HOLD_GRACE_MINUTES = 15

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Database errors raised by smc_create_registration that are safe to return.
const KNOWN_DB_ERRORS = new Set([
  'smc_event_not_found',
  'smc_event_closed',
  'smc_event_started',
  'smc_product_unavailable',
  'smc_invalid_quantity',
  'smc_invalid_attendees',
  'smc_age_not_confirmed',
  'smc_sold_out',
])

function fail(code: string, status: number) {
  return NextResponse.json({ code }, { status })
}

function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().replace(/\s+/g, ' ')
  return s.length >= 2 && s.length <= 80 ? s : null
}

export async function POST(req: NextRequest) {
  // 1. Environment isolation — checked on every request.
  const readiness = smcCheckoutReadiness()
  if (!readiness.ready) {
    console.warn('SMC checkout refused:', readiness.internalReasons.join('; '))
    return fail('checkout_not_ready', 503)
  }

  // 2. BNT storefront only (Preview hosts resolve to 'bcc', so they are allowed explicitly).
  if (!isPreviewOrDev() && resolveStorefront(req.headers.get('host')) !== 'bnt') {
    return fail('not_found', 404)
  }

  // 2b. Before publishing, production checkout is limited to a browser that
  //     entered the private access code. Every rule below still applies.
  if (!smcCheckoutAudienceAllowed()) {
    return fail('not_found', 404)
  }

  // 3. Validate the request. The client never sends a price.
  let body: any
  try {
    body = await req.json()
  } catch {
    return fail('invalid_request', 400)
  }

  const eventId = typeof body?.eventId === 'string' ? body.eventId : null
  const quantity = Number(body?.quantity)
  const leadName = cleanName(body?.leadName)
  const leadEmail = typeof body?.leadEmail === 'string' ? body.leadEmail.trim().toLowerCase() : ''
  const leadWhatsapp = typeof body?.leadWhatsapp === 'string' ? body.leadWhatsapp.trim() : ''
  const whatsappDigits = leadWhatsapp.replace(/\D/g, '')
  const attendeeNames = Array.isArray(body?.attendeeNames) ? body.attendeeNames.map(cleanName) : []
  const paymentMethod = body?.paymentMethod

  if (
    !eventId ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > SMC_MAX_TICKETS_PER_BOOKING ||
    !leadName ||
    !EMAIL_RE.test(leadEmail) ||
    leadEmail.length > 120 ||
    whatsappDigits.length < 8 ||
    whatsappDigits.length > 15 ||
    attendeeNames.length !== quantity ||
    attendeeNames.some((n: string | null) => !n) ||
    (paymentMethod !== 'card' && paymentMethod !== 'promptpay') ||
    body?.ageConfirmed !== true ||
    body?.termsAccepted !== true
  ) {
    return fail('invalid_request', 400)
  }

  // 4. Create the registration and hold seats (atomic, inside the database).
  const supabase = getServiceSupabase()
  const { data: reg, error: regError } = await supabase.rpc('smc_create_registration', {
    p_event_id: eventId,
    p_quantity: quantity,
    p_lead_name: leadName,
    p_lead_email: leadEmail,
    p_lead_whatsapp: leadWhatsapp,
    p_attendee_names: attendeeNames,
    p_payment_method: paymentMethod,
    p_terms_version: SMC_TERMS_VERSION,
    p_age_confirmed: true,
    p_marketing_opt_in: body?.marketingOptIn === true,
    // Draft products are bookable only away from production (readiness has
    // already confirmed staging Supabase + Stripe test mode there).
    p_allow_draft: !isProductionDeployment(),
    p_hold_minutes: SESSION_MINUTES + HOLD_GRACE_MINUTES,
  })

  if (regError || !reg) {
    const code = regError?.message && KNOWN_DB_ERRORS.has(regError.message) ? regError.message : 'unavailable'
    if (code === 'unavailable') console.error('smc_create_registration failed:', regError)
    return fail(code, code === 'smc_sold_out' ? 409 : code === 'unavailable' ? 503 : 422)
  }

  // 5. Create the Stripe Checkout Session — only the chosen payment method.
  // Return the guest to the exact host they booked on (www or apex). The
  // private-access cookie is host-only, so bouncing between the two would
  // 404 the confirmation page before launch. Only known BNT hosts qualify.
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0]
  const appUrl =
    isProductionDeployment() && resolveStorefront(host) === 'bnt' ? `https://${host}` : getAppUrl('bnt')
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60
  const metadata = {
    flow: 'smc',
    registration_id: reg.id,
    event_id: reg.event_id,
    product_id: reg.product_id,
    storefront: 'bnt',
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: [paymentMethod],
      line_items: [
        {
          quantity: reg.quantity,
          price_data: {
            currency: 'thb',
            unit_amount: reg.unit_price * 100, // satang
            product_data: { name: 'Single Meet Club' },
          },
        },
      ],
      customer_email: reg.lead_email,
      expires_at: expiresAt,
      metadata,
      payment_intent_data: { metadata, description: 'Single Meet Club' },
      success_url: `${appUrl}/single-meet-club/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/single-meet-club/book?cancelled=1`,
    })

    const { error: attachError } = await supabase.rpc('smc_attach_checkout_session', {
      p_registration_id: reg.id,
      p_session_id: session.id,
      p_session_expires: new Date(expiresAt * 1000).toISOString(),
      p_grace_minutes: HOLD_GRACE_MINUTES,
    })
    if (attachError) {
      // Without the link the webhook cannot match this session, so do not send the guest to pay.
      console.error('smc_attach_checkout_session failed:', attachError)
      await stripe.checkout.sessions.expire(session.id).catch(() => {})
      await supabase.from('smc_registrations').update({ status: 'cancelled', last_error: 'attach_failed' }).eq('id', reg.id)
      return fail('unavailable', 503)
    }

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('SMC Stripe session creation failed:', err?.message ?? err)
    await supabase
      .from('smc_registrations')
      .update({ status: 'cancelled', last_error: `stripe_session_failed: ${String(err?.code ?? err?.type ?? 'error')}` })
      .eq('id', reg.id)
      .eq('status', 'pending')
    return fail('unavailable', 502)
  }
}
