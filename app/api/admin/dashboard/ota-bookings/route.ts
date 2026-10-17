import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireRole } from '@/lib/admin-auth'
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

// Edit an existing OTA / direct booking from the Day Panel. Same field set
// as POST; only keys present in the body are written. Owner/admin only,
// matching /api/delete-ota-booking.
export async function PATCH(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { id, source, guestName, guestEmail, quantity, totalPaid } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const patch: Record<string, any> = {}
  if (source !== undefined) {
    if (!source) return NextResponse.json({ error: 'source cannot be empty' }, { status: 400 })
    patch.source = source
  }
  if (guestName !== undefined) patch.guest_name = guestName || null
  if (guestEmail !== undefined) patch.guest_email = guestEmail || null
  if (quantity !== undefined) patch.quantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0 ? Number(quantity) : 1
  if (totalPaid !== undefined) patch.total_paid = Number.isFinite(Number(totalPaid)) ? Number(totalPaid) : 0
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const supabase = getServiceSupabase()
  const { data, error } = await supabase.from('ota_bookings').update(patch).eq('id', id).select('id').maybeSingle()
  if (error) {
    console.error('admin/dashboard/ota-bookings: update error:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
