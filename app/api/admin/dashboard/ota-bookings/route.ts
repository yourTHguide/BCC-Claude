import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Security migration (Phase 2A): the Day Panel's manual OTA-booking entry
// previously inserted directly with the anon key (permissive public INSERT
// policy — see PHASE4_CHECKPOINT.md's RLS audit). Same insert, now behind
// requireAdmin() + the service role.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { eventDate, nightSlug, source, guestName, guestEmail, quantity, totalPaid } = body
  if (!eventDate || !nightSlug || !source) {
    return NextResponse.json({ error: 'eventDate, nightSlug, and source are required' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const { error } = await supabase.from('ota_bookings').insert({
    event_date: eventDate,
    night_slug: nightSlug,
    source,
    guest_name: guestName || null,
    guest_email: guestEmail || null,
    quantity: Number.isInteger(Number(quantity)) ? Number(quantity) : 1,
    total_paid: Number.isFinite(Number(totalPaid)) ? Number(totalPaid) : 0,
  })

  if (error) {
    console.error('admin/dashboard/ota-bookings: insert error:', error)
    return NextResponse.json({ error: 'Failed to add OTA booking' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
