import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Security migration (Phase 2A): the owner dashboard's Bookings tab previously
// read bookings directly with the anon key (permissive public SELECT policy —
// see PHASE4_CHECKPOINT.md's RLS audit, which flags this table's guest
// PII/ticket_token exposure as critical). Same query/shape/order as that
// direct read, just behind requireAdmin() + the service role now.
// Cancelled bookings are included (shown labelled, without actions) so the
// tab keeps a full record; totals elsewhere still count confirmed only.
export async function GET() {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .in('status', ['confirmed', 'cancelled'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('admin/dashboard/bookings: query error:', error)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }
  // WhatsApp for the Bookings tab: the booking's own number, else the one the
  // guest left on /night (matched to this booking).
  const rows = (data ?? []) as any[]
  try {
    const ids = rows.filter((b) => !b.guest_whatsapp && !b.guest_phone).map((b) => b.id)
    if (ids.length) {
      const { data: joins } = await supabase.from('night_joins').select('booking_id, phone').eq('match_kind', 'bookings').in('booking_id', ids)
      const byId = new Map(((joins ?? []) as any[]).map((j) => [j.booking_id, j.phone]))
      for (const b of rows) if (byId.has(b.id)) b.night_phone = byId.get(b.id)
    }
  } catch { /* table not on this database yet */ }
  return NextResponse.json({ bookings: rows })
}
