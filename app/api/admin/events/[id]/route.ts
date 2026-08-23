import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/

// Update ONE Event Instance (close/reopen, price/start-time override, capacity).
// Only the fields present in the body are changed, and only this event_dates row
// is touched — the Product and other instances are untouched.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner','admin'])
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, any> = {}

  if ('isOpen' in body) {
    if (typeof body.isOpen !== 'boolean') return NextResponse.json({ error: 'isOpen must be true/false' }, { status: 400 })
    patch.is_open = body.isOpen
  }
  if ('priceOverride' in body) {
    const v = body.priceOverride
    if (v !== null && (!Number.isInteger(Number(v)) || Number(v) <= 0)) {
      return NextResponse.json({ error: 'Price override must be a positive whole number, or empty to clear it' }, { status: 400 })
    }
    patch.price_override = v === null ? null : Number(v)
  }
  if ('startTimeOverride' in body) {
    const v = body.startTimeOverride
    if (v !== null && !TIME_RE.test(String(v))) {
      return NextResponse.json({ error: 'Start time override must be HH:MM, or empty to clear it' }, { status: 400 })
    }
    patch.start_time_override = v === null ? null : String(v)
  }
  if ('capacity' in body) {
    const v = body.capacity
    if (v !== null && (!Number.isInteger(Number(v)) || Number(v) < 1)) {
      return NextResponse.json({ error: 'Capacity must be a whole number of 1 or more, or empty to clear it' }, { status: 400 })
    }
    patch.capacity = v === null ? null : Number(v)
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('event_dates')
    .update(patch)
    .eq('id', params.id)
    .select('id, event_date, is_open, price_override, start_time_override, capacity, schedule_id, night_slug')
    .maybeSingle()

  if (error) {
    console.error('event patch error:', error)
    return NextResponse.json({ error: 'Failed to update instance' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Instance not found' }, { status: 404 })
  return NextResponse.json({ event: data })
}

// Hard-delete ONE Event Instance — guarded: allowed ONLY when the date is in the
// future AND it has zero bookings (website + OTA). Otherwise 409 (soft-close
// via PATCH is_open=false instead).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner','admin'])
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  const { data: ev } = await supabase
    .from('event_dates')
    .select('id, event_date, night_slug')
    .eq('id', params.id)
    .maybeSingle()
  if (!ev) return NextResponse.json({ error: 'Instance not found' }, { status: 404 })

  if ((ev as any).event_date < bangkokToday()) {
    return NextResponse.json({ error: 'Only future dates can be deleted. Close this one instead.' }, { status: 409 })
  }

  let bookings = 0
  for (const table of ['bookings', 'ota_bookings']) {
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('night_slug', (ev as any).night_slug)
      .eq('event_date', (ev as any).event_date)
    bookings += count ?? 0
  }
  if (bookings > 0) {
    return NextResponse.json(
      { error: `This date has ${bookings} booking(s) and cannot be deleted. Close it instead.` },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('event_dates').delete().eq('id', params.id)
  if (error) {
    console.error('event delete error:', error)
    return NextResponse.json({ error: 'Failed to delete instance' }, { status: 500 })
  }
  return NextResponse.json({ deleted: true })
}
