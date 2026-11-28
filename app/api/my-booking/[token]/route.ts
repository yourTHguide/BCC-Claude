import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { chooseOption, moveDates } from '@/lib/bookingOptions'

export const dynamic = 'force-dynamic'

// The guest's personal booking page behind the link in the "not enough
// guests" email. The token is the only key: shows that one booking, the
// guest's open credit, and the nights they can move to.
//   GET  → booking, reason, current choice, credit, nights with enough seats
//   POST { choice, preferredEventId?, note? }

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const db = getServiceSupabase()
  const { data: opt } = await db.from('booking_options').select('*').eq('token', params.token).maybeSingle()
  const o = opt as any
  if (!o) return NextResponse.json({ error: 'This link is not valid.' }, { status: 404 })
  const { data: b } = await db.from('bookings').select('guest_name, night_name, event_date, quantity, total_paid, status, booking_status').eq('id', o.booking_id).maybeSingle()
  const booking = b as any
  const credits = o.guest_id ? ((await db.from('guest_credits').select('amount, used_amount, status, expires_at').eq('guest_id', o.guest_id)).data ?? []) as any[] : []
  // Dates to move to: nights on sale or confirmed with room, plus every
  // Friday/Saturday in the next 3 months.
  const dates = o.status === 'resolved' || o.reason === 'date_proposal' ? [] : await moveDates(db, o.event_id, booking?.quantity ?? 1)
  const { data: prop } = o.proposed_event_id ? await db.from('event_dates').select('event_date, night_name').eq('id', o.proposed_event_id).maybeSingle() : { data: null }
  return NextResponse.json({
    reason: o.reason, status: o.status, choice: o.choice, preferredDate: o.preferred_date, note: o.preference_note, resolution: o.resolution,
    booking: booking ? { guestName: booking.guest_name, nightName: booking.night_name, date: booking.event_date, quantity: booking.quantity, totalPaid: booking.total_paid } : null,
    credit: credits.filter((c) => c.status === 'active').reduce((s, c) => s + c.amount - c.used_amount, 0),
    creditExpires: credits.filter((c) => c.status === 'active').map((c) => c.expires_at).sort()[0] ?? null,
    dates,
    proposed: prop ? { date: (prop as any).event_date, nightName: (prop as any).night_name } : null,
    message: o.owner_message ?? null,
  })
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => ({}))
  const r = await chooseOption(getServiceSupabase(), params.token, body)
  return NextResponse.json(r.status === 200 ? { ok: true, done: !!(r as any).done } : { error: r.error }, { status: r.status })
}
