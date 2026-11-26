import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { requireRole } from '@/lib/admin-auth'
import { BOOKING_ACTION_ROLES, previewEmail } from '@/lib/bookingActions'

// Renders the exact email a booking action would send, without sending it
// or changing anything. Body: { action: 'reschedule' | 'cancel' | 'move_event', bookingId?, eventId?, newEventId?, newDate?, refundMode?, message? }
export async function POST(req: NextRequest) {
  const auth = await requireRole(BOOKING_ACTION_ROLES)
  if ('response' in auth) return auth.response
  try {
    const r = await previewEmail(getServiceSupabase(), await req.json())
    return NextResponse.json(r.body, { status: r.status })
  } catch (err: any) {
    console.error('booking-email-preview error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
