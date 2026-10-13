import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase'
import { smcEnvironmentIssues } from '@/lib/smc/env'
import { fulfilVerifiedSmcSession, loadRegistrationBySession, smcSessionProblem } from '@/lib/smc/fulfilment'
import { dispatchSmcOutbox } from '@/lib/smc/outbox'

export const dynamic = 'force-dynamic'

// SMC-only Stripe webhook (registered as its own endpoint with its own
// signing secret, STRIPE_SMC_WEBHOOK_SECRET). The shared /api/webhook skips
// every session labelled metadata.flow = 'smc', so SMC bookings are created
// here and only here.
//
// Guarantees:
// - A booking + QR ticket is created only when Stripe reports
//   payment_status = 'paid' (checkout.session.completed or
//   checkout.session.async_payment_succeeded).
// - Processing is idempotent: events are logged by id, and
//   smc_fulfill_registration locks the registration and returns the
//   existing booking on any repeat.
// - Confirmation emails are queued in the same transaction as the booking;
//   a send failure never fails the webhook and never re-creates the booking.

const HANDLED = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
])

// Errors that will never succeed on retry: log and acknowledge.
const PERMANENT = new Set(['smc_registration_not_found', 'smc_amount_mismatch'])
const isPermanent = (m: string) => PERMANENT.has(m) || m.startsWith('smc_session_rejected:')

function ok(extra: Record<string, unknown> = {}) {
  return NextResponse.json({ received: true, ...extra })
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SMC_WEBHOOK_SECRET
  if (!secret) {
    console.error('SMC webhook: STRIPE_SMC_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'missing_signature' }, { status: 400 })

  let event: any
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (err: any) {
    console.error('SMC webhook signature verification failed:', err?.message)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  if (!HANDLED.has(event.type)) return ok({ ignored: 'event_type' })

  const session = event.data.object as any
  if (session?.metadata?.flow !== 'smc') return ok({ ignored: 'not_smc' })

  // Environment isolation: test events only with a test key, live only with a live key,
  // and never against production data until live SMC payments are approved.
  const keyIsLive = (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_')
  if (event.livemode !== keyIsLive) {
    console.error(`SMC webhook: livemode mismatch (event ${event.livemode}, key live=${keyIsLive})`)
    return NextResponse.json({ error: 'mode_mismatch' }, { status: 400 })
  }
  const issues = smcEnvironmentIssues()
  if (issues.length) {
    console.error('SMC webhook refused:', issues.join('; '))
    return NextResponse.json({ error: 'environment_not_ready' }, { status: 503 })
  }

  const supabase = getServiceSupabase()

  // Event log: a fully processed event is acknowledged without re-running.
  await supabase
    .from('stripe_webhook_events')
    .upsert({ event_id: event.id, type: event.type, livemode: event.livemode }, { onConflict: 'event_id', ignoreDuplicates: true })
  const { data: logged } = await supabase
    .from('stripe_webhook_events')
    .select('processed_at')
    .eq('event_id', event.id)
    .maybeSingle()
  if (logged?.processed_at) return ok({ duplicate: true })

  const sessionId: string = session.id
  const paymentIntent: string | null = typeof session.payment_intent === 'string' ? session.payment_intent : null

  try {
    let outcome = 'noop'

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (session.payment_status === 'paid') {
        // Same checks as the confirmation page's server-side verification:
        // this exact registration, THB, exact amount, complete and paid.
        const reg = await loadRegistrationBySession(sessionId)
        if (!reg) throw new Error('smc_registration_not_found')
        const problem = smcSessionProblem(session, reg, event.livemode)
        if (problem) throw new Error(`smc_session_rejected:${problem}`)
        outcome = await fulfilVerifiedSmcSession(session)
      } else {
        // Checkout finished but the money has not arrived (PromptPay processing).
        // Keep the seats held; no booking, no ticket.
        const { error } = await supabase.rpc('smc_mark_awaiting_payment', {
          p_session_id: sessionId,
          p_payment_intent: paymentIntent,
        })
        if (error) throw new Error(error.message)
        outcome = 'awaiting_payment'
      }
    } else if (event.type === 'checkout.session.async_payment_failed') {
      const { error } = await supabase.rpc('smc_release_registration', {
        p_session_id: sessionId,
        p_status: 'failed',
        p_reason: 'async_payment_failed',
      })
      if (error) throw new Error(error.message)
      outcome = 'released_failed'
    } else if (event.type === 'checkout.session.expired') {
      const { error } = await supabase.rpc('smc_release_registration', {
        p_session_id: sessionId,
        p_status: 'expired',
        p_reason: 'session_expired',
      })
      if (error) throw new Error(error.message)
      outcome = 'released_expired'
    }

    await supabase
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString(), last_error: null })
      .eq('event_id', event.id)

    // Try the queued emails straight away; anything that fails is retried later.
    if (outcome === 'fulfilled' || outcome === 'over_capacity') {
      try {
        await dispatchSmcOutbox(5)
      } catch (err: any) {
        console.error('SMC webhook: email dispatch error (will retry):', err?.message ?? err)
      }
    }

    return ok({ outcome })
  } catch (err: any) {
    const message = String(err?.message ?? err)
    await supabase.from('stripe_webhook_events').update({ last_error: message.slice(0, 500) }).eq('event_id', event.id)

    if (isPermanent(message)) {
      console.error(`SMC webhook: permanent error for ${event.id} (${sessionId}): ${message}`)
      await supabase
        .from('stripe_webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('event_id', event.id)
      return ok({ error: message })
    }

    // Transient: let Stripe retry the delivery.
    console.error(`SMC webhook: processing failed for ${event.id}: ${message}`)
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }
}
