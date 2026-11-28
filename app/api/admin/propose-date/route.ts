import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { requireRole } from '@/lib/admin-auth'
import { BOOKING_ACTION_ROLES } from '@/lib/bookingActions'
import { proposeDate } from '@/lib/bookingOptions'

export const dynamic = 'force-dynamic'

// Owner: propose a new night to one guest (Bookings tab → Reschedule → Send to guest).
// Body: { bookingId, newEventId, message? }
export async function POST(req: NextRequest) {
  const auth = await requireRole(BOOKING_ACTION_ROLES)
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  const r = await proposeDate(getServiceSupabase(), { bookingId: String(body.bookingId ?? ''), targetEventId: String(body.newEventId ?? ''), message: body.message ?? null })
  return NextResponse.json(r.status === 200 ? r : { error: (r as any).error }, { status: r.status })
}
