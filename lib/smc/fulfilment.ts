import type Stripe from 'stripe'
import { getServiceSupabase } from '@/lib/supabase'
import { generateTicketToken } from '@/lib/tickets'

// One verification + fulfilment path for every way an SMC payment can be
// confirmed: the Stripe webhook (primary) and the confirmation page's
// server-side check with Stripe (fallback when a webhook is delayed).
// Both call this; neither trusts anything the browser sends.

export interface SmcRegistrationRef {
  id: string
  total_amount: number // THB
  status: string
}

// Reasons a session must never produce a booking. Returns null when the
// session is a genuine, fully paid checkout for exactly this registration.
export function smcSessionProblem(
  session: Stripe.Checkout.Session,
  reg: SmcRegistrationRef,
  expectedLivemode: boolean
): string | null {
  if (session.metadata?.flow !== 'smc') return 'not_smc_session'
  if (session.metadata?.registration_id !== reg.id) return 'registration_mismatch'
  if (session.livemode !== expectedLivemode) return 'mode_mismatch'
  if (session.mode !== 'payment') return 'unexpected_mode'
  if ((session.currency ?? '').toLowerCase() !== 'thb') return 'currency_mismatch'
  if (session.amount_total !== reg.total_amount * 100) return 'amount_mismatch'
  if (session.status !== 'complete') return 'session_not_complete'
  if (session.payment_status !== 'paid') return 'payment_not_paid'
  return null
}

export function stripeKeyIsLive(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_')
}

export async function loadRegistrationBySession(sessionId: string): Promise<SmcRegistrationRef | null> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('smc_registrations')
    .select('id, total_amount, status')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  // A query failure is transient (the caller must retry), never "not found".
  if (error) throw new Error(`smc_lookup_failed: ${error.message}`)
  return (data as SmcRegistrationRef | null) ?? null
}

// Creates the booking + QR ticket via the transactional, idempotent database
// function. Call only after smcSessionProblem() returned null. Safe to call
// repeatedly and concurrently: a repeat returns the existing booking.
export async function fulfilVerifiedSmcSession(session: Stripe.Checkout.Session): Promise<string> {
  const supabase = getServiceSupabase()
  const paymentIntent =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null

  const { data, error } = await supabase.rpc('smc_fulfill_registration', {
    p_session_id: session.id,
    p_payment_intent: paymentIntent,
    p_amount_total: session.amount_total,
    p_livemode: session.livemode,
    p_ticket_token: generateTicketToken(),
    p_admin_recipient: process.env.ADMIN_NOTIFY_EMAIL ?? null,
  })
  if (error) throw new Error(error.message)
  return String((data as any)?.outcome ?? 'fulfilled')
}
