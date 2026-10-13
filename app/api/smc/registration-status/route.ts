import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase'
import { formatBookingReference } from '@/lib/bookingReference'
import { smcEnvironmentIssues } from '@/lib/smc/env'
import {
  fulfilVerifiedSmcSession,
  smcSessionProblem,
  stripeKeyIsLive,
  type SmcRegistrationRef,
} from '@/lib/smc/fulfilment'
import { dispatchSmcOutbox } from '@/lib/smc/outbox'

export const dynamic = 'force-dynamic'

// Status for the confirmation page.
//
// The Stripe webhook is the primary way a booking is confirmed. As a
// fallback for a delayed webhook, this route asks Stripe directly (server to
// server, never trusting the browser) and, only if Stripe reports this exact
// SMC registration as complete and paid in THB for the exact amount, runs the
// same idempotent booking function the webhook uses. A repeat or a race with
// the webhook returns the existing booking; no ticket is ever issued before
// Stripe confirms payment.
//
// Privacy: the caller must already hold the Stripe Checkout Session id (only
// the paying guest is redirected here with it). The response carries no
// personal data — only the state, quantity and, once confirmed, the booking
// reference and ticket token that the guest's own email and ticket link
// already contain.

export type SmcPublicStatus =
  | 'confirming' // checkout returned, payment not yet confirmed
  | 'awaiting_payment' // PromptPay still processing
  | 'confirmed'
  | 'paid_over_capacity'
  | 'failed'
  | 'expired'
  | 'not_found'

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/

function json(status: SmcPublicStatus, extra: Record<string, unknown> = {}, http = 200) {
  return NextResponse.json({ status, ...extra }, { status: http, headers: { 'Cache-Control': 'no-store' } })
}

async function readState(sessionId: string) {
  const supabase = getServiceSupabase()
  const { data: reg, error } = await supabase
    .from('smc_registrations')
    .select('id, status, quantity, total_amount, booking_id')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  // A query failure is transient: never report it as "not found".
  if (error) throw new Error(`smc_lookup_failed: ${error.message}`)
  if (!reg) return null

  if (reg.status === 'paid' && reg.booking_id) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, ticket_token, status')
      .eq('id', reg.booking_id)
      .maybeSingle()
    if (booking?.status === 'confirmed' && booking.ticket_token) {
      return { reg, confirmed: { reference: formatBookingReference('smc', booking.id), ticketToken: booking.ticket_token } }
    }
  }
  return { reg, confirmed: null }
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id') ?? ''
  if (!SESSION_ID_RE.test(sessionId) || smcEnvironmentIssues().length) return json('not_found', {}, 404)

  let state
  try {
    state = await readState(sessionId)
  } catch (err: any) {
    // Database temporarily unavailable: keep the guest's page polling.
    console.error(`SMC status: lookup failed for ${sessionId}: ${err?.message ?? err}`)
    return json('confirming', {}, 503)
  }
  if (!state) return json('not_found', {}, 404)

  const { reg } = state
  if (state.confirmed) return json('confirmed', { quantity: reg.quantity, ...state.confirmed })
  if (reg.status === 'paid_over_capacity') return json('paid_over_capacity', { quantity: reg.quantity })

  // Not confirmed in our database yet: ask Stripe directly.
  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    // Stripe unreachable: report what our database knows; the page polls again.
    return fallbackStatus(reg)
  }

  const ref: SmcRegistrationRef = { id: reg.id, total_amount: reg.total_amount, status: reg.status }
  const problem = smcSessionProblem(session, ref, stripeKeyIsLive())

  if (!problem) {
    // Verified paid by Stripe: confirm through the same idempotent function as the webhook.
    try {
      const outcome = await fulfilVerifiedSmcSession(session)
      if (outcome === 'fulfilled' || outcome === 'over_capacity') {
        dispatchSmcOutbox(5).catch((err) => console.error('SMC status: email dispatch error (will retry):', err))
      }
    } catch (err: any) {
      console.error(`SMC status: fallback fulfilment failed for ${sessionId}: ${err?.message ?? err}`)
      return json('confirming', { quantity: reg.quantity })
    }
    state = await readState(sessionId).catch(() => null)
    if (state?.confirmed) return json('confirmed', { quantity: reg.quantity, ...state.confirmed })
    if (state?.reg.status === 'paid_over_capacity') return json('paid_over_capacity', { quantity: reg.quantity })
    return json('confirming', { quantity: reg.quantity })
  }

  // Integrity problems are logged and never shown in detail to the browser.
  if (['registration_mismatch', 'mode_mismatch', 'currency_mismatch', 'amount_mismatch', 'unexpected_mode', 'not_smc_session'].includes(problem)) {
    console.error(`SMC status: session ${sessionId} rejected: ${problem}`)
    return json('not_found', {}, 404)
  }

  // Not paid yet: describe the state for display only.
  if (session.status === 'expired') return json('expired')
  if (session.status === 'complete' && session.payment_status === 'unpaid') {
    return json('awaiting_payment', { quantity: reg.quantity })
  }
  return fallbackStatus(reg)
}

function fallbackStatus(reg: { status: string; quantity: number }) {
  if (reg.status === 'awaiting_payment') return json('awaiting_payment', { quantity: reg.quantity })
  if (reg.status === 'failed') return json('failed')
  if (reg.status === 'expired' || reg.status === 'cancelled') return json('expired')
  return json('confirming', { quantity: reg.quantity })
}
