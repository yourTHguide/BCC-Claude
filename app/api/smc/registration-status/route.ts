import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase'
import { formatBookingReference } from '@/lib/bookingReference'
import { smcEnvironmentIssues } from '@/lib/smc/env'

export const dynamic = 'force-dynamic'

// Status for the confirmation page. Read-only: it never creates or changes a
// booking (only the SMC webhook does). Returns no personal data — just the
// state, quantity, and, once paid, the booking reference and ticket token
// (the same token the guest's own ticket link and email already carry).

export type SmcPublicStatus =
  | 'confirming' // checkout returned, webhook not processed yet
  | 'awaiting_payment' // PromptPay still processing
  | 'confirmed'
  | 'paid_over_capacity'
  | 'failed'
  | 'expired'
  | 'not_found'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id') ?? ''
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return NextResponse.json({ status: 'not_found' satisfies SmcPublicStatus }, { status: 404 })
  }
  if (smcEnvironmentIssues().length) {
    return NextResponse.json({ status: 'not_found' satisfies SmcPublicStatus }, { status: 404 })
  }

  const supabase = getServiceSupabase()
  const { data: reg } = await supabase
    .from('smc_registrations')
    .select('status, quantity, booking_id')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()

  if (!reg) return NextResponse.json({ status: 'not_found' satisfies SmcPublicStatus }, { status: 404 })

  if (reg.status === 'paid' && reg.booking_id) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, ticket_token, status')
      .eq('id', reg.booking_id)
      .maybeSingle()
    if (booking?.status === 'confirmed' && booking.ticket_token) {
      return NextResponse.json({
        status: 'confirmed' satisfies SmcPublicStatus,
        quantity: reg.quantity,
        reference: formatBookingReference('smc', booking.id),
        ticketToken: booking.ticket_token,
      })
    }
  }

  if (reg.status === 'awaiting_payment') {
    return NextResponse.json({ status: 'awaiting_payment' satisfies SmcPublicStatus, quantity: reg.quantity })
  }
  if (reg.status === 'paid_over_capacity') {
    return NextResponse.json({ status: 'paid_over_capacity' satisfies SmcPublicStatus, quantity: reg.quantity })
  }
  if (reg.status === 'failed') return NextResponse.json({ status: 'failed' satisfies SmcPublicStatus })
  if (reg.status === 'expired' || reg.status === 'cancelled') {
    return NextResponse.json({ status: 'expired' satisfies SmcPublicStatus })
  }

  // Still 'pending' in our database: the webhook may simply not have arrived
  // yet. Ask Stripe for display purposes only, so a guest whose PromptPay is
  // processing sees the right message immediately.
  let status: SmcPublicStatus = 'confirming'
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.status === 'expired') status = 'expired'
    else if (session.status === 'complete' && session.payment_status === 'unpaid') status = 'awaiting_payment'
  } catch {
    // Stripe unreachable: keep "confirming"; the page polls again.
  }
  return NextResponse.json({ status, quantity: reg.quantity })
}
