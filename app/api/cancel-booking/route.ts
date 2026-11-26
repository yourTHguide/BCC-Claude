import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { requireRole } from '@/lib/admin-auth'
import { BOOKING_ACTION_ROLES, cancelBooking } from '@/lib/bookingActions'

// Cancel one booking. Owner-only (BOOKING_ACTION_ROLES).
// Body: { bookingId, refundMode?: 'stripe' | 'manual' | 'none', refundNote?, message?, notify? (default true) }
// refundMode omitted = the original /dashboard behaviour (Stripe refund when
// there is a payment on file). 'manual' on an already-cancelled booking just
// marks it refunded.
export async function POST(req: NextRequest) {
  const auth = await requireRole(BOOKING_ACTION_ROLES)
  if ('response' in auth) return auth.response
  try {
    const body = await req.json()
    const r = await cancelBooking(getServiceSupabase(), body)
    return NextResponse.json(r.body, { status: r.status })
  } catch (err: any) {
    console.error('Cancel-booking route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
