import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { chooseOption } from '@/lib/bookingOptions'
import { BCC_PRODUCT_SLUG, bangkokNow } from '@/lib/bookingAvailability'
import { loadBccInstancesByIds } from '@/lib/waitlist/bccInstances'

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
  // Nights to move to: Club Crawl, on sale, future, with seats for this party.
  const { data: product } = await db.from('products').select('id').eq('slug', BCC_PRODUCT_SLUG).maybeSingle()
  let nights: any[] = []
  if (product && o.status !== 'resolved') {
    const { data: rows } = await db.from('event_dates').select('id').eq('product_id', (product as any).id).eq('is_open', true).gte('event_date', bangkokNow().date).limit(60)
    const ids = ((rows ?? []) as any[]).map((r) => r.id).filter((id) => id !== o.event_id)
    const inst = ids.length ? await loadBccInstancesByIds(db, ids) : []
    nights = inst.filter((i) => i.state === 'bookable' && (i.remaining == null || i.remaining >= (booking?.quantity ?? 1)))
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate)).slice(0, 30)
      .map((i) => ({ eventId: i.id, date: i.eventDate, nightName: i.nightName }))
  }
  return NextResponse.json({
    reason: o.reason, status: o.status, choice: o.choice, preferredEventId: o.preferred_event_id, note: o.preference_note, resolution: o.resolution,
    booking: booking ? { guestName: booking.guest_name, nightName: booking.night_name, date: booking.event_date, quantity: booking.quantity, totalPaid: booking.total_paid } : null,
    credit: credits.filter((c) => c.status === 'active').reduce((s, c) => s + c.amount - c.used_amount, 0),
    creditExpires: credits.filter((c) => c.status === 'active').map((c) => c.expires_at).sort()[0] ?? null,
    nights,
  })
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => ({}))
  const r = await chooseOption(getServiceSupabase(), params.token, body)
  return NextResponse.json(r.status === 200 ? { ok: true } : { error: r.error }, { status: r.status })
}
