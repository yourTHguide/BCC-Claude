import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { requireRole } from '@/lib/admin-auth'
import { BOOKING_ACTION_ROLES, moveEvent } from '@/lib/bookingActions'

// Move a whole event (and every confirmed guest on it) to another date,
// emailing each website guest. Owner-only. Body: { newDate, message?, notify? }
export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(BOOKING_ACTION_ROLES)
  if ('response' in auth) return auth.response
  try {
    const body = await req.json()
    const r = await moveEvent(getServiceSupabase(), { ...body, eventId: params.id })
    return NextResponse.json(r.body, { status: r.status })
  } catch (err: any) {
    console.error('move event error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
