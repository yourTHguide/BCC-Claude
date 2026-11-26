import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { requireRole } from '@/lib/admin-auth'
import { BOOKING_ACTION_ROLES, rescheduleBooking } from '@/lib/bookingActions'

// Move one booking to another event. Owner-only (BOOKING_ACTION_ROLES).
// Body: { bookingId, newEventId? | newDate?, message?, notify? (default true), force? }
// `force` lets the owner move a guest onto a night that is already full.
export async function POST(req: NextRequest) {
  const auth = await requireRole(BOOKING_ACTION_ROLES)
  if ('response' in auth) return auth.response
  try {
    const body = await req.json()
    const r = await rescheduleBooking(getServiceSupabase(), body)
    return NextResponse.json(r.body, { status: r.status })
  } catch (err: any) {
    console.error('Reschedule-booking route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
