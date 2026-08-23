import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

// bookings and ota_bookings only have public INSERT/SELECT policies (see
// supabase-schema.sql) — no public UPDATE — so attendance changes must go
// through a server route with the service role, the same pattern already
// used by cancel-booking and reschedule-booking.
//
// Stage 9e: this route had NO auth check at all (pre-existing gap — not
// under /api/admin, so middleware.ts's matcher never covered it either) —
// anyone who found the endpoint could flip any booking's attendance status.
// Now gated by requireAdmin() because the Stage 9d QR check-in flow
// explicitly keeps this route's dropdown as its manual fallback ("scanning
// failed, check the guest in by hand"), which makes it part of the
// check-in lifecycle for the first time. requireAdmin() reads the Supabase
// Auth session directly (independent of middleware.ts's path matcher — see
// lib/admin-auth.ts), so gating it here doesn't require moving this route
// under /api/admin or touching middleware.ts. The other 5 known-
// unauthenticated legacy ops routes (cancel-booking, reschedule-booking,
// delete-ota-booking, resend-confirmation, send-confirmed-meetup) are NOT
// used by this lifecycle and are deliberately left unchanged — see
// PHASE4_CHECKPOINT.md for that tracked debt.
const VALID_STATUSES = ['expected', 'checked_in', 'no_show']
const VALID_TABLES = ['bookings', 'ota_bookings']

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  try {
    const { table, id, status } = await req.json()

    if (!VALID_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
    }
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const { error } = await supabase.from(table).update({ attendance_status: status }).eq('id', id)

    if (error) {
      console.error('Update-attendance error:', error)
      return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Update-attendance route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
